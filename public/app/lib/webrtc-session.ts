import type {
  AnswerSignal,
  IceSignal,
  OfferSignal,
  OutgoingSignal,
  PeerState,
  PlaybackState,
  Role,
  SignalMessage,
} from '../types.ts';
import { applyAudioEncoding, applyVideoEncoding, type VideoQuality } from './encoding.ts';
import { describeConnectionPath, getIceConfig } from './ice.ts';
import { randomId } from './random-id.ts';

export interface WebRtcSessionOptions {
  roomId: string;
  role: Role;
  forceRelay: boolean;
  quality: VideoQuality;
  getHostStream: () => MediaStream | null;
  onRemoteStream: (stream: MediaStream) => void;
  onRemoteState: (state: PlaybackState) => void;
  onStatus: (status: string) => void;
  onPath: (path: string) => void;
}

const CONTROL_CHANNEL = 'control';

export class WebRtcSession {
  private socket: WebSocket | null = null;
  private iceServers: RTCIceServer[] = [];
  private readonly hostPeers = new Map<string, PeerState>();
  private viewerPeer: PeerState | null = null;
  private quality: VideoQuality;

  readonly peerId = randomId();

  constructor(private readonly options: WebRtcSessionOptions) {
    this.quality = options.quality;
  }

  async connect(): Promise<void> {
    const ice = await getIceConfig();

    this.iceServers = ice.iceServers;
    this.options.onStatus(`ICE: ${ice.providers.join(', ')}`);

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const roomId = encodeURIComponent(this.options.roomId);
    const peerId = encodeURIComponent(this.peerId);

    const socket = new WebSocket(
      `${protocol}//${location.host}/signal/${roomId}/${peerId}/${this.options.role}`,
    );

    this.socket = socket;
    socket.addEventListener('message', event => this.onSocketMessage(event));
    socket.addEventListener('close', () => this.options.onStatus('信令连接已断开'));

    await new Promise<void>((resolve, reject) => {
      socket.addEventListener('open', () => resolve(), { once: true });
      socket.addEventListener('error', () => reject(new Error('信令连接失败')), { once: true });
    });
  }

  /** 房主切换画质时热更新所有观看者的发送参数。 */
  setVideoQuality(quality: VideoQuality): void {
    this.quality = quality;

    for (const peer of this.hostPeers.values()) {
      void this.applyHostEncoding(peer);
    }
  }

  broadcastState(state: PlaybackState): void {
    const data = JSON.stringify(state);

    for (const peer of this.hostPeers.values()) {
      if (peer.channel?.readyState !== 'open') {
        continue;
      }

      peer.channel.send(data);
    }
  }

  async replaceHostStream(stream: MediaStream): Promise<void> {
    const videoTrack = stream.getVideoTracks()[0] ?? null;
    const audioTrack = stream.getAudioTracks()[0] ?? null;

    for (const peer of this.hostPeers.values()) {
      await peer.senders.video?.replaceTrack(videoTrack);
      await peer.senders.audio?.replaceTrack(audioTrack);
      await this.applyHostEncoding(peer);
    }
  }

  close(): void {
    this.socket?.close();
    this.socket = null;

    for (const peer of this.hostPeers.values()) {
      peer.pc.close();
    }

    this.viewerPeer?.pc.close();
    this.hostPeers.clear();
    this.viewerPeer = null;
  }

  private onSocketMessage(event: MessageEvent): void {
    let message: SignalMessage;

    try {
      message = JSON.parse(String(event.data)) as SignalMessage;
    } catch {
      return;
    }

    void this.handleSignal(message);
  }

  private async handleSignal(message: SignalMessage): Promise<void> {
    switch (message.type) {
      case 'error': {
        this.options.onStatus(message.message);

        return;
      }

      case 'waiting-host': {
        this.options.onStatus('等待房主进入...');

        return;
      }

      case 'ready': {
        return;
      }

      case 'peer-joined': {
        await this.handlePeerJoined(message.peerId);

        return;
      }

      case 'peer-left': {
        this.handlePeerLeft(message.peerId);

        return;
      }

      case 'host-left': {
        this.handleHostLeft();

        return;
      }

      case 'offer': {
        await this.handleOffer(message);

        return;
      }

      case 'answer': {
        await this.handleAnswer(message);

        return;
      }

      case 'ice': {
        await this.handleIce(message);

        return;
      }
    }
  }

  private async handlePeerJoined(peerId: string): Promise<void> {
    if (this.options.role !== 'host') {
      return;
    }

    await this.createHostPeer(peerId);
  }

  private handlePeerLeft(peerId: string): void {
    if (this.options.role !== 'host') {
      return;
    }

    const peer = this.hostPeers.get(peerId);

    peer?.pc.close();
    this.hostPeers.delete(peerId);
  }

  private handleHostLeft(): void {
    this.options.onStatus('房主已离开');

    this.viewerPeer?.pc.close();
    this.viewerPeer = null;
  }

  private async handleOffer(message: OfferSignal): Promise<void> {
    if (this.options.role !== 'viewer') {
      return;
    }

    const peer = await this.ensureViewerPeer(message.from);

    await peer.pc.setRemoteDescription(message.sdp);
    await this.flushCandidates(peer);

    const answer = await peer.pc.createAnswer();

    await peer.pc.setLocalDescription(answer);
    this.sendSignal({ type: 'answer', target: message.from, sdp: peer.pc.localDescription });
  }

  private async handleAnswer(message: AnswerSignal): Promise<void> {
    if (this.options.role !== 'host') {
      return;
    }

    const peer = this.hostPeers.get(message.from);

    if (!peer) {
      return;
    }

    await peer.pc.setRemoteDescription(message.sdp);
    await this.flushCandidates(peer);
  }

  private async handleIce(message: IceSignal): Promise<void> {
    if (this.options.role === 'host') {
      const peer = this.hostPeers.get(message.from);

      if (!peer) {
        return;
      }

      await this.addCandidate(peer, message.candidate);

      return;
    }

    const peer = await this.ensureViewerPeer(message.from);

    await this.addCandidate(peer, message.candidate);
  }

  private sendSignal(message: OutgoingSignal): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(JSON.stringify(message));
  }

  private createConnection(): RTCPeerConnection {
    const pc = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceTransportPolicy: this.options.forceRelay ? 'relay' : 'all',
    });

    pc.addEventListener('icecandidateerror', event => {
      console.warn('[ICE error]', {
        url: event.url,
        code: event.errorCode,
        text: event.errorText,
      });
    });

    pc.addEventListener('connectionstatechange', () => {
      this.options.onStatus(`WebRTC: ${pc.connectionState}`);

      if (pc.connectionState === 'connected') {
        void describeConnectionPath(pc).then(path => this.options.onPath(path));
      }
    });

    return pc;
  }

  private attachIce(pc: RTCPeerConnection, peerId: string): void {
    pc.addEventListener('icecandidate', event => {
      if (!event.candidate) {
        return;
      }

      this.sendSignal({
        type: 'ice',
        target: peerId,
        candidate: event.candidate.toJSON(),
      });
    });
  }

  private async addCandidate(peer: PeerState, candidate: RTCIceCandidateInit): Promise<void> {
    if (!peer.pc.remoteDescription) {
      peer.pendingCandidates.push(candidate);

      return;
    }

    await peer.pc.addIceCandidate(candidate);
  }

  private async flushCandidates(peer: PeerState): Promise<void> {
    for (const candidate of peer.pendingCandidates) {
      await peer.pc.addIceCandidate(candidate);
    }

    peer.pendingCandidates = [];
  }

  private async applyHostEncoding(peer: PeerState): Promise<void> {
    if (peer.senders.video) {
      await applyVideoEncoding(peer.senders.video, this.quality);
    }

    if (peer.senders.audio) {
      await applyAudioEncoding(peer.senders.audio);
    }
  }

  private async createHostPeer(peerId: string): Promise<void> {
    if (this.hostPeers.has(peerId)) {
      return;
    }

    const stream = this.options.getHostStream();

    if (!stream) {
      throw new Error('房主还没有可发送的媒体流');
    }

    const pc = this.createConnection();
    const video = pc.addTransceiver('video', { direction: 'sendonly', streams: [stream] });
    const audio = pc.addTransceiver('audio', { direction: 'sendonly', streams: [stream] });

    await video.sender.replaceTrack(stream.getVideoTracks()[0] ?? null);
    await audio.sender.replaceTrack(stream.getAudioTracks()[0] ?? null);

    const channel = pc.createDataChannel(CONTROL_CHANNEL, { ordered: true });

    const peer: PeerState = {
      pc,
      channel,
      pendingCandidates: [],
      senders: {
        video: video.sender,
        audio: audio.sender,
      },
    };

    this.hostPeers.set(peerId, peer);
    this.attachIce(pc, peerId);

    channel.addEventListener('open', () => this.options.onStatus('观看者已连接'));

    pc.addEventListener('connectionstatechange', () => {
      if (pc.connectionState === 'connected') {
        void this.applyHostEncoding(peer);
      }
    });

    const offer = await pc.createOffer();

    await pc.setLocalDescription(offer);
    await this.applyHostEncoding(peer);

    this.sendSignal({ type: 'offer', target: peerId, sdp: pc.localDescription });
  }

  private async ensureViewerPeer(hostId: string): Promise<PeerState> {
    if (this.viewerPeer) {
      return this.viewerPeer;
    }

    const pc = this.createConnection();
    const remoteStream = new MediaStream();

    const peer: PeerState = {
      pc,
      remoteStream,
      pendingCandidates: [],
      senders: {},
    };

    this.viewerPeer = peer;
    this.attachIce(pc, hostId);

    pc.addEventListener('track', event => this.onRemoteTrack(peer, event.track));
    pc.addEventListener('datachannel', event => this.onDataChannel(peer, event));

    return peer;
  }

  private onRemoteTrack(peer: PeerState, track: MediaStreamTrack): void {
    const stream = peer.remoteStream;

    if (!stream) {
      return;
    }

    if (!stream.getTracks().some(current => current.id === track.id)) {
      stream.addTrack(track);
    }

    this.options.onRemoteStream(stream);
  }

  private onDataChannel(peer: PeerState, event: RTCDataChannelEvent): void {
    if (event.channel.label !== CONTROL_CHANNEL) {
      return;
    }

    peer.channel = event.channel;
    event.channel.addEventListener('message', messageEvent => this.onControlMessage(messageEvent));
  }

  private onControlMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(String(event.data)) as Partial<PlaybackState> & {
        type?: string;
      };

      if (message.type === 'state') {
        this.options.onRemoteState(message as PlaybackState);
      }
    } catch {
      // 忽略无法解析的控制消息
    }
  }
}

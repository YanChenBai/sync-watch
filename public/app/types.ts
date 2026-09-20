export type Role = 'host' | 'viewer';

export interface PlaylistItem {
  title: string;
  src: string;
}

export interface Playlist {
  items: PlaylistItem[];
}

/** 房主通过 DataChannel 广播的播放状态。 */
export interface PlaybackState {
  type: 'state';
  index: number;
  title: string;
  paused: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
}

export interface IceResponse {
  iceServers: RTCIceServer[];
  providers: string[];
}

export interface PeerState {
  pc: RTCPeerConnection;
  pendingCandidates: RTCIceCandidateInit[];
  channel?: RTCDataChannel;
  senders: {
    video?: RTCRtpSender;
    audio?: RTCRtpSender;
  };
  remoteStream?: MediaStream;
  /** 片源真实高度，缓存下来避免重复读取时把降采样倍数算回 1。 */
  sourceHeight?: number;
}

/*
 * 信令协议与 src/types.ts 中的服务端定义保持一致。
 * 这里刻意重复声明，避免把服务端代码打进浏览器包。
 */

export interface ErrorSignal {
  type: 'error';
  message: string;
}

export interface WaitingHostSignal {
  type: 'waiting-host';
}

export interface ReadySignal {
  type: 'ready';
  peerId: string;
}

export interface PeerJoinedSignal {
  type: 'peer-joined';
  peerId: string;
}

export interface PeerLeftSignal {
  type: 'peer-left';
  peerId: string;
}

export interface HostLeftSignal {
  type: 'host-left';
}

export interface OfferSignal {
  type: 'offer';
  from: string;
  sdp: RTCSessionDescriptionInit;
}

export interface AnswerSignal {
  type: 'answer';
  from: string;
  sdp: RTCSessionDescriptionInit;
}

export interface IceSignal {
  type: 'ice';
  from: string;
  candidate: RTCIceCandidateInit;
}

export type SignalMessage =
  | ErrorSignal
  | WaitingHostSignal
  | ReadySignal
  | PeerJoinedSignal
  | PeerLeftSignal
  | HostLeftSignal
  | OfferSignal
  | AnswerSignal
  | IceSignal;

export type OutgoingSignal =
  | { type: 'offer'; target: string; sdp: RTCSessionDescriptionInit | null }
  | { type: 'answer'; target: string; sdp: RTCSessionDescriptionInit | null }
  | { type: 'ice'; target: string; candidate: RTCIceCandidateInit };

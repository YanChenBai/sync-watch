import { resolveScaleDownBy, VIDEO_QUALITY_PROFILES, type VideoQuality } from './encoding.ts';

/**
 * 把 video 元素采集成一路可以交给 WebRTC 的流。
 *
 * 为什么不用 video.captureStream()：
 * Chrome 在采集 4K 片源时会直接打在 GPU 进程的 CHECK 上，
 * 表现就是整页崩溃「错误代码：STATUS_BREAKPOINT」。
 * 只要调一次 captureStream() 就崩，和有没有观看者、编码参数都无关。
 *
 * 这里的做法是：先把画面缩放绘制到目标分辨率的 canvas 上，再采 canvas。
 * WebRTC 侧永远只看到 <=1080p 的帧，绕开那条会崩的 4K 采集路径。
 * 音频用 Web Audio 单独取。注意 createMediaElementSource() 会把元素的声音
 * 改道进音频图，所以必须同时接回 context.destination，房主自己才听得到。
 */

interface AudioGraph {
  context: AudioContext;
  destination: MediaStreamAudioDestinationNode;
}

const audioGraphs = new WeakMap<HTMLMediaElement, AudioGraph>();

function ensureAudioGraph(element: HTMLMediaElement): AudioGraph {
  const existing = audioGraphs.get(element);

  if (existing) {
    return existing;
  }

  const context = new AudioContext();
  const source = context.createMediaElementSource(element);
  const destination = context.createMediaStreamDestination();

  // 一路接回扬声器（房主自己听），一路送去 WebRTC
  source.connect(context.destination);
  source.connect(destination);

  const graph: AudioGraph = { context, destination };

  audioGraphs.set(element, graph);

  return graph;
}

function alignToEven(value: number): number {
  return Math.max(2, Math.round(value / 2) * 2);
}

function resolveCanvasSize(
  element: HTMLVideoElement,
  quality: VideoQuality,
): { width: number; height: number } {
  const profile = VIDEO_QUALITY_PROFILES[quality];
  const sourceWidth = element.videoWidth || 1280;
  const sourceHeight = element.videoHeight || 720;
  const scale = resolveScaleDownBy(sourceHeight, profile.maxHeight);

  return {
    width: alignToEven(sourceWidth / scale),
    height: alignToEven(sourceHeight / scale),
  };
}

class HostCapture {
  private readonly canvas = document.createElement('canvas');
  private readonly context: CanvasRenderingContext2D;
  private readonly videoTrack: MediaStreamTrack;
  private readonly stream: MediaStream;
  private frameHandle: number | null = null;
  private lastFrameAt = 0;
  private quality: VideoQuality;

  constructor(
    private readonly element: HTMLVideoElement,
    quality: VideoQuality,
  ) {
    const context = this.canvas.getContext('2d');

    if (!context) {
      throw new Error('无法创建 canvas 上下文');
    }

    this.context = context;
    this.quality = quality;

    const size = resolveCanvasSize(element, quality);

    this.canvas.width = size.width;
    this.canvas.height = size.height;

    const canvasStream = this.canvas.captureStream(VIDEO_QUALITY_PROFILES[quality].maxFramerate);
    const videoTrack = canvasStream.getVideoTracks()[0];

    if (!videoTrack) {
      throw new Error('无法从 canvas 采集视频轨道');
    }

    this.videoTrack = videoTrack;

    let audioTrack: MediaStreamTrack | null = null;

    try {
      const graph = ensureAudioGraph(element);

      audioTrack = graph.destination.stream.getAudioTracks()[0] ?? null;

      void graph.context.resume();
    } catch (cause) {
      console.warn('[capture] 音频图创建失败，本次只发送画面', cause);
    }

    this.stream = new MediaStream(audioTrack ? [videoTrack, audioTrack] : [videoTrack]);

    this.start();
  }

  getStream(): MediaStream {
    return this.stream;
  }

  setQuality(quality: VideoQuality): void {
    this.quality = quality;

    const size = resolveCanvasSize(this.element, quality);

    this.canvas.width = size.width;
    this.canvas.height = size.height;
  }

  stop(): void {
    if (this.frameHandle !== null) {
      cancelAnimationFrame(this.frameHandle);
      this.frameHandle = null;
    }

    // 只停自己这条视频轨：音频轨来自共享的音频图，下一次采集还要复用它
    this.videoTrack.stop();
  }

  private start(): void {
    const tick = (now: number): void => {
      this.frameHandle = requestAnimationFrame(tick);
      this.draw(now);
    };

    this.frameHandle = requestAnimationFrame(tick);
  }

  private draw(now: number): void {
    const interval = 1000 / VIDEO_QUALITY_PROFILES[this.quality].maxFramerate;

    if (now - this.lastFrameAt < interval) {
      return;
    }

    this.lastFrameAt = now;

    if (this.element.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }

    try {
      this.context.drawImage(this.element, 0, 0, this.canvas.width, this.canvas.height);
    } catch (cause) {
      console.warn('[capture] 绘制画面失败', cause);
    }
  }
}

const captures = new WeakMap<HTMLMediaElement, HostCapture>();

/** 取得（必要时创建）该视频元素的采集流，重复调用会复用同一个流。 */
export function acquireCapture(
  element: HTMLVideoElement | null,
  quality: VideoQuality,
): MediaStream {
  if (!element) {
    throw new Error('播放器尚未准备好');
  }

  if (!element.videoWidth || !element.videoHeight) {
    throw new Error('还没有读到视频画面，请先播放一下再创建房间');
  }

  const existing = captures.get(element);

  if (existing) {
    // 换片源或换画质都要按当前片源重新计算 canvas 尺寸
    existing.setQuality(quality);

    return existing.getStream();
  }

  const capture = new HostCapture(element, quality);

  captures.set(element, capture);

  return capture.getStream();
}

export function releaseCapture(element: HTMLMediaElement | null): void {
  if (!element) {
    return;
  }

  const capture = captures.get(element);

  if (!capture) {
    return;
  }

  captures.delete(element);
  capture.stop();
}

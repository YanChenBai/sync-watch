/**
 * 发送端编码参数。
 *
 * WebRTC 默认的发送参数非常保守：码率上限低、带宽不足时优先掉分辨率，
 * 结果就是「画质很差」。这里显式设置码率上限、分辨率上限与 contentHint。
 *
 * ⚠️ 分辨率上限是必须的：`scaleResolutionDownBy = 1` + `maintain-resolution`
 * 会让浏览器直接编码片源原始分辨率，4K60 片源会吃掉大量显存，
 * 直接把 GPU 进程打崩（Windows 上表现为 STATUS_BREAKPOINT）。
 */

export type VideoQuality = 'high' | 'balanced' | 'saver';

export interface VideoQualityProfile {
  label: string;
  hint: string;
  maxBitrate: number;
  maxFramerate: number;
  /** 编码高度上限，用于换算 scaleResolutionDownBy。 */
  maxHeight: number;
  degradationPreference: RTCDegradationPreference;
}

export const VIDEO_QUALITY_PROFILES: Record<VideoQuality, VideoQualityProfile> = {
  high: {
    label: '高清 1080p',
    hint: '最长边 1080p，最高 8 Mbps',
    maxBitrate: 8_000_000,
    maxFramerate: 30,
    maxHeight: 1080,
    degradationPreference: 'maintain-resolution',
  },
  balanced: {
    label: '均衡 720p',
    hint: '最长边 720p，最高 4 Mbps',
    maxBitrate: 4_000_000,
    maxFramerate: 30,
    maxHeight: 720,
    degradationPreference: 'balanced',
  },
  saver: {
    label: '省流量 480p',
    hint: '最长边 480p，最高 1.5 Mbps',
    maxBitrate: 1_500_000,
    maxFramerate: 24,
    maxHeight: 480,
    degradationPreference: 'maintain-framerate',
  },
};

export const VIDEO_QUALITY_ORDER: VideoQuality[] = ['high', 'balanced', 'saver'];

/** 电影音轨用 music 提示，Opus 会给更高的码率预算。 */
const AUDIO_MAX_BITRATE = 192_000;

/**
 * 把片源高度换算成 WebRTC 的降采样倍数。
 *
 * 片源本来就不超过上限时返回 1，不做无谓的重采样。
 */
export function resolveScaleDownBy(sourceHeight: number, maxHeight: number): number {
  if (sourceHeight <= 0 || maxHeight <= 0 || sourceHeight <= maxHeight) {
    return 1;
  }

  return sourceHeight / maxHeight;
}

/** 从发送端读取片源真实高度（captureStream 的 track 会带上）。 */
export function readTrackHeight(sender: RTCRtpSender): number {
  const track = sender.track;

  if (!track) {
    return 0;
  }

  return track.getSettings().height ?? 0;
}

export async function applyVideoEncoding(
  sender: RTCRtpSender,
  quality: VideoQuality,
  sourceHeight: number,
): Promise<void> {
  const profile = VIDEO_QUALITY_PROFILES[quality];
  const track = sender.track;

  if (track) {
    track.contentHint = 'motion';
  }

  const parameters = sender.getParameters();

  if (parameters.encodings.length === 0) {
    parameters.encodings = [{}];
  }

  const scaleResolutionDownBy = resolveScaleDownBy(sourceHeight, profile.maxHeight);

  parameters.degradationPreference = profile.degradationPreference;

  for (const encoding of parameters.encodings) {
    encoding.maxBitrate = profile.maxBitrate;
    encoding.maxFramerate = profile.maxFramerate;
    encoding.scaleResolutionDownBy = scaleResolutionDownBy;
    encoding.networkPriority = 'high';
  }

  try {
    await sender.setParameters(parameters);
  } catch (cause) {
    console.warn('[encoding] 视频编码参数应用失败', cause);
  }
}

export async function applyAudioEncoding(sender: RTCRtpSender): Promise<void> {
  const track = sender.track;

  if (track) {
    track.contentHint = 'music';
  }

  const parameters = sender.getParameters();

  if (parameters.encodings.length === 0) {
    return;
  }

  for (const encoding of parameters.encodings) {
    encoding.maxBitrate = AUDIO_MAX_BITRATE;
    encoding.networkPriority = 'high';
  }

  try {
    await sender.setParameters(parameters);
  } catch (cause) {
    console.warn('[encoding] 音频编码参数应用失败', cause);
  }
}

function alignToEven(value: number): number {
  return Math.max(2, Math.round(value / 2) * 2);
}

/** 给房主界面用的一句话说明，4K 片源会明确写出降采样前后尺寸。 */
export function describeEncodingHint(
  quality: VideoQuality,
  sourceWidth: number,
  sourceHeight: number,
): string {
  const profile = VIDEO_QUALITY_PROFILES[quality];

  if (sourceHeight <= 0 || sourceHeight <= profile.maxHeight) {
    return `画质：${profile.hint}，切换后立即生效。`;
  }

  const scale = resolveScaleDownBy(sourceHeight, profile.maxHeight);
  const targetWidth = alignToEven(sourceWidth / scale);
  const targetHeight = alignToEven(sourceHeight / scale);

  return [
    `画质：源 ${sourceWidth}×${sourceHeight} → 编码 ${targetWidth}×${targetHeight}。`,
    'WebRTC 直接编码 4K 会占用大量显存并可能让浏览器崩溃，已自动降采样。',
  ].join('');
}

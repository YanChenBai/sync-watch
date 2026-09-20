/**
 * 发送端编码参数。
 *
 * WebRTC 默认的发送参数非常保守：码率上限低、带宽不足时优先掉分辨率，
 * 结果就是「画质很差」。这里显式设置码率上限、保分辨率策略与
 * contentHint，让编码器按视频内容而非屏幕内容来分配码率。
 */

export type VideoQuality = 'source' | 'balanced' | 'saver';

export interface VideoQualityProfile {
  label: string;
  hint: string;
  maxBitrate: number;
  maxFramerate: number;
  scaleResolutionDownBy: number;
  degradationPreference: RTCDegradationPreference;
}

export const VIDEO_QUALITY_PROFILES: Record<VideoQuality, VideoQualityProfile> = {
  source: {
    label: '原始画质',
    hint: '保分辨率，最高 8 Mbps',
    maxBitrate: 8_000_000,
    maxFramerate: 30,
    scaleResolutionDownBy: 1,
    degradationPreference: 'maintain-resolution',
  },
  balanced: {
    label: '均衡',
    hint: '最高 4 Mbps',
    maxBitrate: 4_000_000,
    maxFramerate: 30,
    scaleResolutionDownBy: 1,
    degradationPreference: 'balanced',
  },
  saver: {
    label: '省流量',
    hint: '半分辨率，最高 1.5 Mbps',
    maxBitrate: 1_500_000,
    maxFramerate: 24,
    scaleResolutionDownBy: 2,
    degradationPreference: 'maintain-framerate',
  },
};

export const VIDEO_QUALITY_ORDER: VideoQuality[] = ['source', 'balanced', 'saver'];

/** 电影音轨用 music 提示，Opus 会给更高的码率预算。 */
const AUDIO_MAX_BITRATE = 192_000;

export async function applyVideoEncoding(
  sender: RTCRtpSender,
  quality: VideoQuality,
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

  parameters.degradationPreference = profile.degradationPreference;

  for (const encoding of parameters.encodings) {
    encoding.maxBitrate = profile.maxBitrate;
    encoding.maxFramerate = profile.maxFramerate;
    encoding.scaleResolutionDownBy = profile.scaleResolutionDownBy;
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

import type { IceResponse } from '../types.ts';

export async function getIceConfig(): Promise<IceResponse> {
  const response = await fetch('/api/ice');

  if (!response.ok) {
    throw new Error('无法获取 ICE 配置');
  }

  const data = (await response.json()) as IceResponse;

  return data;
}

interface TransportStats {
  type?: string;
  selectedCandidatePairId?: string;
}

interface CandidatePairStats {
  localCandidateId?: string;
  remoteCandidateId?: string;
}

interface CandidateStats {
  candidateType?: string;
  url?: string;
}

/**
 * 通过 getStats() 推断当前链路是直连还是走了 TURN 中继，
 * 只用于界面展示。
 */
export async function describeConnectionPath(pc: RTCPeerConnection): Promise<string> {
  const stats = await pc.getStats();
  const pairId = findCandidatePairId(stats);

  if (!pairId) {
    return 'unknown';
  }

  const pair = stats.get(pairId) as unknown as CandidatePairStats | undefined;

  return describePair(stats, pair);
}

function findCandidatePairId(stats: RTCStatsReport): string | undefined {
  for (const report of stats.values()) {
    const transport = report as TransportStats;

    if (transport.type === 'transport' && typeof transport.selectedCandidatePairId === 'string') {
      return transport.selectedCandidatePairId;
    }
  }

  for (const report of stats.values()) {
    const pair = report as unknown as CandidatePairStats & {
      type?: string;
      state?: string;
      nominated?: boolean;
    };

    if (pair.type === 'candidate-pair' && pair.state === 'succeeded' && pair.nominated) {
      return report.id;
    }
  }

  return undefined;
}

function describePair(stats: RTCStatsReport, pair: CandidatePairStats | undefined): string {
  if (!pair) {
    return 'unknown';
  }

  const local = readCandidate(stats, pair.localCandidateId);
  const remote = readCandidate(stats, pair.remoteCandidateId);

  if (!isRelay(local) && !isRelay(remote)) {
    return 'P2P Direct';
  }

  return describeRelayUrl(`${local?.url ?? ''} ${remote?.url ?? ''}`);
}

function readCandidate(stats: RTCStatsReport, id: string | undefined): CandidateStats | undefined {
  if (!id) {
    return undefined;
  }

  return stats.get(id) as unknown as CandidateStats | undefined;
}

function isRelay(candidate: CandidateStats | undefined): boolean {
  return candidate?.candidateType === 'relay';
}

function describeRelayUrl(url: string): string {
  if (url.includes('cloudflare')) {
    return 'TURN / Cloudflare';
  }

  if (url.includes('openrelay') || url.includes('metered')) {
    return 'TURN / OpenRelay';
  }

  return 'TURN Relay';
}

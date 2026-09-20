import { config, hasCloudflareTurn } from './config.ts';
import { logWarn } from './logger.ts';

export interface IceConfig {
  iceServers: RTCIceServer[];

  providers: string[];
}

const STUN_PROVIDERS = ['cloudflare-stun', 'google-stun', 'openrelay-stun'];

const OPENRELAY_CREDENTIAL = {
  username: 'openrelayproject',
  credential: 'openrelayproject',
};

/**
 * Cloudflare TURN 是可选的。
 *
 * TURN Key 永远不能下发给浏览器，浏览器只拿临时 credentials。
 */
async function getCloudflareIceServers(): Promise<RTCIceServer[]> {
  const response = await fetch(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${config.cloudflareTurn.keyId}/credentials/generate-ice-servers`,
    {
      method: 'POST',

      headers: {
        Authorization: `Bearer ${config.cloudflareTurn.apiToken}`,

        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        // 6 hours
        ttl: 60 * 60 * 6,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const data = (await response.json()) as { iceServers: RTCIceServer[] };

  return data.iceServers;
}

function createOpenRelayServers(): RTCIceServer[] {
  return [
    { urls: 'turn:openrelay.metered.ca:80', ...OPENRELAY_CREDENTIAL },

    { urls: 'turn:openrelay.metered.ca:443', ...OPENRELAY_CREDENTIAL },

    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      ...OPENRELAY_CREDENTIAL,
    },
  ];
}

export async function createIceConfig(): Promise<IceConfig> {
  const iceServers: RTCIceServer[] = [
    //
    // Public STUN
    //
    {
      urls: [
        'stun:stun.cloudflare.com:3478',

        'stun:stun.l.google.com:19302',

        'stun:openrelay.metered.ca:80',
      ],
    },
  ];

  const providers = new Set<string>(STUN_PROVIDERS);

  if (hasCloudflareTurn()) {
    try {
      iceServers.push(...(await getCloudflareIceServers()));

      providers.add('cloudflare-turn');
    } catch (cause) {
      logWarn('[ICE] Cloudflare TURN 不可用', cause);
    }
  }

  if (config.publicOpenRelay) {
    iceServers.push(...createOpenRelayServers());

    providers.add('openrelay-turn');
  }

  return {
    iceServers,

    providers: [...providers],
  };
}

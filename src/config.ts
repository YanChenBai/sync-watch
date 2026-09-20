/** 读取端口，非法值回退到默认端口。 */
function readPort(): number {
  const raw = Bun.env.PORT;

  if (!raw) {
    return 3000;
  }

  const parsed = Number.parseInt(raw, 10);

  return Number.isFinite(parsed) ? parsed : 3000;
}

export const config = {
  cloudflareTurn: {
    keyId: Bun.env.CF_TURN_KEY_ID,
    apiToken: Bun.env.CF_TURN_KEY_API_TOKEN,
  },
  /** 公共 OpenRelay 只作为最后兜底，不能当 SLA 使用。 */
  publicOpenRelay: Bun.env.PUBLIC_OPENRELAY !== 'false',
  hostname: Bun.env.HOST ?? '0.0.0.0',
  port: readPort(),
} as const;

export function hasCloudflareTurn(): boolean {
  return Boolean(config.cloudflareTurn.keyId && config.cloudflareTurn.apiToken);
}

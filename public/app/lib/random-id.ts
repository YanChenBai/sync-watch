/**
 * `crypto.randomUUID()` 只在安全上下文（HTTPS / localhost）中存在。
 * 手机通过局域网 HTTP 打开时它是 `undefined`，直接调用会抛错，
 * 因此这里提供带降级的 UUID v4 生成器。
 */
export function randomId(): string {
  const webCrypto = globalThis.crypto;

  if (typeof webCrypto?.randomUUID === 'function') {
    return webCrypto.randomUUID();
  }

  return formatUuidV4(fillRandomBytes(new Uint8Array(16)));
}

function fillRandomBytes(bytes: Uint8Array): Uint8Array {
  const webCrypto = globalThis.crypto;

  if (typeof webCrypto?.getRandomValues === 'function') {
    webCrypto.getRandomValues(bytes);

    return bytes;
  }

  for (let index = 0; index < bytes.length; index++) {
    bytes[index] = Math.floor(Math.random() * 256);
  }

  return bytes;
}

function formatUuidV4(bytes: Uint8Array): string {
  // 设置 RFC 4122 版本号与 variant 位
  bytes[6] = (bytes[6] % 16) + 0x40;
  bytes[8] = (bytes[8] % 64) + 0x80;

  const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0'));

  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}

/** 统一日志出口，避免各处直接使用 console.log。 */
export function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

export function logWarn(message: string, cause?: unknown): void {
  console.warn(message, cause);
}

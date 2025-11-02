export function runWithIdleCallback(callback: () => void): void {
  const runtime = globalThis as typeof globalThis & {
    requestIdleCallback?: (cb: IdleRequestCallback, options?: IdleRequestOptions) => number;
  };
  if (runtime.requestIdleCallback) {
    runtime.requestIdleCallback(callback, { timeout: 32 });
    return;
  }
  globalThis.setTimeout(callback, 16);
}

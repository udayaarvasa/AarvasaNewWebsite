/**
 * "Latest request wins" for asynchronous source loads. Starting a load aborts
 * the previous one (so its download stops) and makes it stale (so a result
 * that arrives anyway is discarded instead of replacing the newer room).
 */
export type LoadTicket = {
  readonly signal: AbortSignal;
  /** False once a newer load started or the gate was closed. */
  isCurrent(): boolean;
};

export class LoadGate {
  private serial = 0;
  private controller: AbortController | null = null;
  private closed = false;

  begin(): LoadTicket {
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    const id = ++this.serial;
    if (this.closed) controller.abort();
    return { signal: controller.signal, isCurrent: () => !this.closed && id === this.serial };
  }

  /** Aborts the current load and rejects every later one (viewer destroyed). */
  close(): void {
    this.closed = true;
    this.controller?.abort();
  }
}

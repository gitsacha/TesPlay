// Tesla's embedded browser may have WebCodecs but lack AbortSignal.any.
// Install before the player loads so its own media requests share cancellation.
if (typeof AbortSignal.any !== 'function') {
  AbortSignal.any = (signals: AbortSignal[]) => {
    const controller = new AbortController();
    const listeners: Array<() => void> = [];
    const abort = (signal: AbortSignal) => {
      controller.abort(signal.reason);
      for (const remove of listeners) remove();
      listeners.length = 0;
    };
    for (const signal of signals) {
      if (signal.aborted) { abort(signal); break; }
      const listener = () => abort(signal);
      signal.addEventListener('abort', listener, { once: true });
      listeners.push(() => signal.removeEventListener('abort', listener));
    }
    return controller.signal;
  };
}

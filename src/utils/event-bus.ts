interface EventMap {
  [key: string]: EventListener[];
}

export function createEventBus() {
  const listeners: EventMap = {};

  function on(event: string, handler: EventListener) {
    if (!listeners[event]) {
      listeners[event] = [];
    }
    listeners[event].push(handler);
    return () => off(event, handler);
  }

  function off(event: string, handler: EventListener) {
    const handlers = listeners[event];
    if (!handlers) return;
    const index = handlers.indexOf(handler);
    if (index >= 0) {
      handlers.splice(index, 1);
    }
  }

  function dispatch(event: string, detail: unknown) {
    const handlers = listeners[event];
    if (!handlers) return;
    const evt = new CustomEvent(event, { detail });
    handlers.forEach((handler) => handler(evt));
  }

  return {
    on,
    off,
    dispatch,
  };
}

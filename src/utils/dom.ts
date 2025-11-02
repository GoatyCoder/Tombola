export function qs<T extends Element = Element>(selector: string, root: ParentNode = document): T {
  const el = root.querySelector(selector);
  if (!el) {
    throw new Error(`Elemento non trovato: ${selector}`);
  }
  return el as T;
}

export function qsa<T extends Element = Element>(selector: string, root: ParentNode = document): T[] {
  return Array.from(root.querySelectorAll(selector)) as T[];
}

export function setAriaBusy(element: Element | null, busy: boolean): void {
  if (!element) return;
  if (busy) {
    element.setAttribute('aria-busy', 'true');
  } else {
    element.removeAttribute('aria-busy');
  }
}

export function toggleHidden(element: HTMLElement | null, hidden: boolean): void {
  if (!element) return;
  element.toggleAttribute('hidden', hidden);
  element.setAttribute('aria-hidden', hidden ? 'true' : 'false');
}

export function setStatusMessage(element: HTMLElement | null, message: string): void {
  if (!element) return;
  element.textContent = message;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function formatNumberWithLeadingZero(value: number): string {
  return value.toString().padStart(2, '0');
}

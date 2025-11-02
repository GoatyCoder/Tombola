export function trapFocus(container: HTMLElement): () => void {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([type="hidden"]):not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ];
  const elements = Array.from(
    container.querySelectorAll<HTMLElement>(focusableSelectors.join(',')),
  );

  if (elements.length === 0) {
    return () => {};
  }

  let previousFocus: HTMLElement | null = document.activeElement as HTMLElement | null;
  elements[0].focus();

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;
    const first = elements[0];
    const last = elements[elements.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    } else if (document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  container.addEventListener('keydown', handleKeyDown);

  return () => {
    container.removeEventListener('keydown', handleKeyDown);
    previousFocus?.focus();
    previousFocus = null;
  };
}

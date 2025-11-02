import { SELECTORS } from '../../core/constants';
import { DrawHistoryEntry, TombolaState } from '../../core/types';
import { qs, toggleHidden } from '../../utils/dom';

export class HistoryController {
  #list: HTMLOListElement;
  #empty: HTMLElement;
  #panel: HTMLElement;
  #toggle: HTMLButtonElement;
  #label: HTMLElement;
  #scrim: HTMLElement;
  #disposers: Array<() => void> = [];
  #onToggle: ((open: boolean) => void) | null = null;

  constructor() {
    this.#list = qs<HTMLOListElement>(SELECTORS.historyList);
    this.#empty = qs<HTMLElement>(SELECTORS.historyEmpty);
    this.#panel = qs<HTMLElement>(SELECTORS.historyPanel);
    this.#toggle = qs<HTMLButtonElement>(SELECTORS.historyToggle);
    this.#label = qs<HTMLElement>(SELECTORS.historyLabel);
    this.#scrim = qs<HTMLElement>(SELECTORS.historyScrim);
  }

  bind(onToggle: (open: boolean) => void): void {
    this.#onToggle = onToggle;
    const handleToggle = () => {
      const nextOpen = this.#panel.getAttribute('aria-hidden') !== 'false';
      this.setOpen(nextOpen);
    };
    const handleScrim = (event: MouseEvent) => {
      event.preventDefault();
      this.setOpen(false);
    };

    this.#toggle.addEventListener('click', handleToggle);
    this.#scrim.addEventListener('click', handleScrim);
    this.#disposers.push(
      () => this.#toggle.removeEventListener('click', handleToggle),
      () => this.#scrim.removeEventListener('click', handleScrim),
    );
  }

  setOpen(open: boolean): void {
    toggleHidden(this.#panel, !open);
    toggleHidden(this.#scrim as HTMLElement, !open);
    this.#toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    this.#label.textContent = open
      ? this.#toggle.dataset.labelMobileOpen ?? 'Chiudi cronologia'
      : this.#toggle.dataset.labelMobileClosed ?? 'Cronologia';
    this.#panel.classList.toggle('history--open', open);
    this.#scrim.classList.toggle('history-scrim--visible', open);
    this.#onToggle?.(open);
    if (!open) {
      this.#toggle.focus();
    }
  }

  update(state: TombolaState): void {
    this.#empty.toggleAttribute('hidden', state.history.length > 0);
    this.#list.replaceChildren(...state.history.map((entry) => this.#createItem(entry)));
    this.#toggle.disabled = state.history.length === 0;
    this.#panel.setAttribute('aria-hidden', state.historyOpen ? 'false' : 'true');
    this.#panel.toggleAttribute('hidden', !state.historyOpen);
    this.#scrim.setAttribute('aria-hidden', state.historyOpen ? 'false' : 'true');
    this.#scrim.toggleAttribute('hidden', !state.historyOpen);
    this.#toggle.setAttribute('aria-expanded', state.historyOpen ? 'true' : 'false');
    this.#panel.classList.toggle('history--open', state.historyOpen);
    this.#scrim.classList.toggle('history-scrim--visible', state.historyOpen);
  }

  dispose(): void {
    this.#disposers.forEach((dispose) => dispose());
    this.#disposers = [];
    this.#onToggle = null;
  }

  #createItem(entry: DrawHistoryEntry): HTMLElement {
    const item = document.createElement('li');
    item.className = 'history__item';
    const time = new Date(entry.drawnAt);
    const formatter = new Intl.DateTimeFormat('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const timeLabel = formatter.format(time);

    item.innerHTML = `
      <div class="history__item-number">${entry.number}</div>
      <div class="history__item-meta">
        <span class="history__item-time" aria-label="Estratto alle ${timeLabel}">${timeLabel}</span>
        ${entry.sponsor ? `<span class="history__item-sponsor">${entry.sponsor.name ?? 'Sponsor'}</span>` : ''}
      </div>
    `;
    return item;
  }
}

import { BOARD_BATCH_SIZE, FALLBACK_IMAGE, SELECTORS } from '../../core/constants';
import { TombolaEntry, TombolaState } from '../../core/types';
import { qs } from '../../utils/dom';
import { runWithIdleCallback } from '../../utils/idle';

interface BoardCellElements {
  root: HTMLButtonElement;
  media: HTMLImageElement;
  token: HTMLElement;
  sr: HTMLElement;
}

export class BoardController {
  #boardElement: HTMLElement;
  #template: HTMLTemplateElement;
  #cells = new Map<number, BoardCellElements>();

  constructor() {
    this.#boardElement = qs<HTMLElement>(SELECTORS.board);
    this.#template = qs<HTMLTemplateElement>(SELECTORS.boardTemplate);
  }

  get element(): HTMLElement {
    return this.#boardElement;
  }

  render(entries: TombolaEntry[]): void {
    this.#boardElement.replaceChildren();
    this.#cells.clear();

    const fragment = document.createDocumentFragment();
    let index = 0;

    const renderBatch = () => {
      const end = Math.min(index + BOARD_BATCH_SIZE, entries.length);
      for (; index < end; index += 1) {
        const entry = entries[index];
        const clone = this.#template.content.firstElementChild?.cloneNode(true) as HTMLButtonElement;
        if (!clone) continue;
        const media = clone.querySelector<HTMLImageElement>('.board-cell__media');
        const tokenNumber = clone.querySelector<HTMLElement>('[data-board-token-number]');
        const sr = clone.querySelector<HTMLElement>('[data-board-cell-sr]');
        if (!media || !tokenNumber || !sr) continue;

        clone.dataset.number = String(entry.number);
        clone.dataset.state = 'idle';
        clone.setAttribute('aria-pressed', 'false');
        clone.setAttribute('aria-label', `${entry.number}. ${entry.italian}`);
        clone.setAttribute('tabindex', '0');

        media.loading = 'lazy';
        media.decoding = 'async';
        media.alt = '';
        media.src = entry.image ?? FALLBACK_IMAGE;
        media.srcset = this.#buildSrcSet(entry.image);
        media.sizes = '(max-width: 56.25rem) 20vw, 10vw';
        media.addEventListener('error', () => {
          media.src = FALLBACK_IMAGE;
          media.removeAttribute('srcset');
        });

        tokenNumber.textContent = entry.number.toString();
        sr.textContent = `${entry.number}. ${entry.italian}`;

        clone.addEventListener('focus', () => this.#boardElement.dispatchEvent(
          new CustomEvent('board:focus', { detail: { number: entry.number } }),
        ));

        this.#cells.set(entry.number, {
          root: clone,
          media,
          token: tokenNumber,
          sr,
        });

        fragment.appendChild(clone);
      }

      if (index < entries.length) {
        runWithIdleCallback(renderBatch);
      } else {
        this.#boardElement.appendChild(fragment);
      }
    };

    renderBatch();
  }

  update(state: TombolaState): void {
    const drawn = new Set(state.drawnNumbers);
    const selected = state.selectedNumber;
    const last = state.drawnNumbers.at(-1) ?? null;

    for (const [number, cell] of this.#cells) {
      const isDrawn = drawn.has(number);
      const isSelected = selected === number;
      const isLast = last === number;

      cell.root.dataset.state = isSelected ? 'selected' : isDrawn ? 'drawn' : 'idle';
      cell.root.setAttribute('aria-pressed', isDrawn ? 'true' : 'false');
      cell.root.classList.toggle('board-cell--drawn', isDrawn);
      cell.root.classList.toggle('board-cell--just-drawn', isLast);
      cell.root.classList.toggle('board-cell--selected', isSelected);
    }
  }

  focusNumber(number: number): void {
    this.#cells.get(number)?.root.focus({ preventScroll: false });
  }

  getCell(number: number): HTMLButtonElement | null {
    return this.#cells.get(number)?.root ?? null;
  }

  getCells(): Map<number, HTMLButtonElement> {
    return new Map(Array.from(this.#cells.entries(), ([num, cell]) => [num, cell.root]));
  }

  #buildSrcSet(image?: string | null): string {
    if (!image) return '';
    return `${image} 1x, ${image} 2x`;
  }
}

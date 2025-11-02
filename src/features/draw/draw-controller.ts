import {
  APP_EVENTS,
  MAX_DRAWN_NUMBERS,
  SELECTORS,
} from '../../core/constants';
import { DrawResult, TombolaEntry, TombolaState } from '../../core/types';
import { store } from '../../core/store';
import { qs, setStatusMessage, toggleHidden, formatNumberWithLeadingZero } from '../../utils/dom';
import { toISODateTime } from '../../utils/time';
import { SponsorManager } from '../sponsors/sponsor-manager';
import { SponsorView } from '../sponsors/sponsor-view';
import { BoardController } from '../board/board-controller';
import { ModalController } from '../modal/modal-controller';
import { HistoryController } from '../history/history-controller';
import { AudioController } from '../audio/audio-controller';

export class DrawController {
  #drawButton: HTMLButtonElement;
  #drawButtonLabel: HTMLElement;
  #resetButton: HTMLButtonElement;
  #progressValue: HTMLElement;
  #progressBar: HTMLElement;
  #progressFill: HTMLElement;
  #lastNumber: HTMLElement;
  #lastDetail: HTMLElement;
  #status: HTMLElement;
  #overlay: HTMLElement;
  #overlayNumber: HTMLElement;
  #overlayAnnouncement: HTMLElement;
  #overlayLoader: HTMLElement;
  #sponsorManager: SponsorManager;
  #sponsorView: SponsorView;
  #board: BoardController;
  #modal: ModalController;
  #history: HistoryController;
  #audio: AudioController;

  constructor(
    sponsorManager: SponsorManager,
    sponsorView: SponsorView,
    board: BoardController,
    modal: ModalController,
    history: HistoryController,
    audio: AudioController,
  ) {
    this.#sponsorManager = sponsorManager;
    this.#sponsorView = sponsorView;
    this.#board = board;
    this.#modal = modal;
    this.#history = history;
    this.#audio = audio;

    this.#drawButton = qs<HTMLButtonElement>(SELECTORS.drawButton);
    this.#drawButtonLabel = qs<HTMLElement>(SELECTORS.drawButtonLabel);
    this.#resetButton = qs<HTMLButtonElement>(SELECTORS.resetButton);
    this.#progressValue = qs<HTMLElement>(SELECTORS.drawProgressValue);
    this.#progressBar = qs<HTMLElement>(SELECTORS.drawProgressBar);
    this.#progressFill = qs<HTMLElement>(SELECTORS.drawProgressFill);
    this.#lastNumber = qs<HTMLElement>(SELECTORS.drawLastNumber);
    this.#lastDetail = qs<HTMLElement>(SELECTORS.drawLastDetail);
    this.#status = qs<HTMLElement>(SELECTORS.drawStatus);
    this.#overlay = qs<HTMLElement>(SELECTORS.drawOverlay);
    this.#overlayNumber = qs<HTMLElement>(SELECTORS.drawOverlayNumber);
    this.#overlayAnnouncement = qs<HTMLElement>(SELECTORS.drawOverlayAnnouncement);
    this.#overlayLoader = qs<HTMLElement>(SELECTORS.drawOverlayLoader);
  }

  bind(): void {
    this.#drawButton.addEventListener('click', () => void this.draw());
    this.#resetButton.addEventListener('click', () => this.reset());
  }

  update(state: TombolaState): void {
    const entriesCount = state.entries.length;
    const drawnCount = state.drawnNumbers.length;

    this.#drawButton.disabled = drawnCount >= entriesCount || state.isDrawing || entriesCount === 0;
    this.#resetButton.disabled = drawnCount === 0 && state.status !== 'error';

    if (drawnCount >= entriesCount) {
      this.#drawButtonLabel.textContent = 'Tutti i numeri estratti';
    } else {
      this.#drawButtonLabel.textContent = state.isDrawing ? 'Estrazione in corso…' : 'Estrai numero';
    }

    this.#progressBar.setAttribute('aria-valuemax', String(entriesCount));
    this.#progressBar.setAttribute('aria-valuenow', String(drawnCount));
    this.#progressValue.textContent = `${drawnCount}/${entriesCount}`;
    const progress = entriesCount === 0 ? 0 : Math.round((drawnCount / entriesCount) * 100);
    this.#progressFill.style.setProperty('--progress-value', `${progress}%`);

    if (state.status === 'error' && state.lastError) {
      setStatusMessage(this.#status, state.lastError);
    } else if (state.status === 'loading') {
      setStatusMessage(this.#status, 'Caricamento del tabellone in corso…');
    } else if (drawnCount === 0) {
      setStatusMessage(this.#status, 'In attesa della prima estrazione.');
    } else if (drawnCount >= entriesCount) {
      setStatusMessage(this.#status, 'Tutti i numeri sono stati estratti.');
    } else {
      setStatusMessage(this.#status, `Pronto per la prossima estrazione (${entriesCount - drawnCount} rimasti).`);
    }

    const lastNumber = state.drawnNumbers.at(-1) ?? null;
    if (lastNumber) {
      this.#lastNumber.textContent = formatNumberWithLeadingZero(lastNumber);
      const entry = state.entries.find((item) => item.number === lastNumber);
      if (entry) {
        this.#lastDetail.textContent = entry.italian;
      }
    } else {
      this.#lastNumber.textContent = '—';
      this.#lastDetail.textContent = 'In attesa della prima estrazione';
    }
  }

  async draw(): Promise<void> {
    if (store.state.isDrawing) return;
    const remaining = this.#getRemainingEntries();
    if (remaining.length === 0) {
      this.update(store.state);
      return;
    }

    store.setState({ isDrawing: true });
    const result = this.#prepareDraw(remaining);
    this.#showOverlay(result.entry, result.sponsor);

    await new Promise((resolve) => setTimeout(resolve, 600));

    this.#recordDraw(result);
    this.#board.focusNumber(result.entry.number);
    this.#modal.show(result, {
      nextLabel: 'Estrai successivo',
      onNext: () => {
        this.#modal.hide();
        void this.draw();
      },
    });

    store.setState({ isDrawing: false });
  }

  reset(): void {
    store.resetStorage();
    store.setState({
      drawnNumbers: [],
      history: [],
      selectedNumber: null,
      lastError: undefined,
    }, { persist: true });
    this.#history.update(store.state);
    this.#board.update(store.state);
    this.#sponsorView.updateDrawSponsor(null);
    setStatusMessage(this.#status, 'Tabellone azzerato. Pronto per ricominciare.');
    store.dispatch(APP_EVENTS.gameReset, {});
  }

  #prepareDraw(remaining: TombolaEntry[]): DrawResult {
    const entry = remaining[Math.floor(Math.random() * remaining.length)];
    const sponsor = this.#sponsorManager.getNext();
    return { entry, sponsor };
  }

  #recordDraw({ entry, sponsor }: DrawResult): void {
    const historyEntry = {
      number: entry.number,
      drawnAt: toISODateTime(),
      sponsor,
    };

    const nextDrawn = [...store.state.drawnNumbers, entry.number];
    const nextHistory = [historyEntry, ...store.state.history].slice(0, MAX_DRAWN_NUMBERS);

    store.setState(
      {
        drawnNumbers: nextDrawn,
        selectedNumber: entry.number,
        history: nextHistory,
        activeSponsor: sponsor ?? null,
      },
      { persist: true },
    );

    this.#board.update(store.state);
    this.#history.update(store.state);
    this.#sponsorView.updateDrawSponsor(sponsor ?? null);

    store.dispatch(APP_EVENTS.numberDrawn, {
      number: entry.number,
      sponsor,
      entry,
    });

    this.#audio.speak({
      messages: [
        { text: `Estratto il numero ${entry.number}`, locale: 'it-IT' },
        { text: entry.italian, locale: 'it-IT' },
      ],
    });
  }

  #showOverlay(entry: TombolaEntry, sponsor: ReturnType<SponsorManager['getNext']>): void {
    toggleHidden(this.#overlay, false);
    this.#overlayNumber.textContent = entry.number.toString();
    this.#overlayAnnouncement.textContent = `Estratto il numero ${entry.number} — ${entry.italian}`;
    this.#overlayLoader.setAttribute('aria-hidden', 'true');
    window.setTimeout(() => toggleHidden(this.#overlay, true), 1200);
  }

  #getRemainingEntries(): TombolaEntry[] {
    const drawnSet = new Set(store.state.drawnNumbers);
    return store.state.entries.filter((entry) => !drawnSet.has(entry.number));
  }
}

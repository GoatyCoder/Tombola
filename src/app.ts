import { store } from './core/store';
import { loadNumbers, loadSponsors } from './data/loader';
import { ERROR_MESSAGES } from './core/constants';
import { TombolaEntry, SponsorEntry } from './core/types';
import { BoardController } from './features/board/board-controller';
import { DrawController } from './features/draw/draw-controller';
import { HistoryController } from './features/history/history-controller';
import { SponsorManager } from './features/sponsors/sponsor-manager';
import { SponsorView } from './features/sponsors/sponsor-view';
import { registerBoardKeyboardNavigation } from './features/accessibility/keyboard-navigation';
import { AudioController } from './features/audio/audio-controller';
import { ModalController } from './features/modal/modal-controller';
import { setStatusMessage } from './utils/dom';

const DATA_URL = '/data.json';
const SPONSORS_URL = '/sponsors.json';

function handleBoardSelection(board: BoardController, modal: ModalController, entry: TombolaEntry | null, sponsor: SponsorEntry | null) {
  if (!entry) return;
  store.setState({ selectedNumber: entry.number });
  modal.show({ entry, sponsor });
}

export async function initializeApp(): Promise<void> {
  const drawStatus = document.querySelector<HTMLElement>('#draw-status');
  store.initialiseFromStorage();
  if (store.state.lastError) {
    setStatusMessage(drawStatus, store.state.lastError);
  }

  const audio = new AudioController((enabled) => store.setState({ audioEnabled: enabled }));
  audio.setEnabled(store.state.audioEnabled);

  const board = new BoardController();
  const history = new HistoryController();
  const sponsorManager = new SponsorManager();
  const sponsorView = new SponsorView();
  const modal = new ModalController(audio);
  const drawController = new DrawController(sponsorManager, sponsorView, board, modal, history, audio);

  drawController.bind();
  history.bind((open) => store.setState({ historyOpen: open }));

  const disposeKeyboard = registerBoardKeyboardNavigation(board);
  store.registerCleanup(disposeKeyboard);

  board.element.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    const cell = target?.closest<HTMLButtonElement>('.board-cell');
    if (!cell) return;
    const number = Number.parseInt(cell.dataset.number ?? '', 10);
    if (!Number.isInteger(number)) return;
    const entry = store.state.entries.find((item) => item.number === number) ?? null;
    const sponsor = store.state.history.find((item) => item.number === number)?.sponsor ?? store.state.activeSponsor;
    handleBoardSelection(board, modal, entry, sponsor);
  });

  const updateUI = () => {
    const state = store.state;
    board.update(state);
    history.update(state);
    drawController.update(state);
    board.element.classList.toggle('board-grid--loading', state.status === 'loading');
    if (state.status === 'loading') {
      board.element.setAttribute('aria-busy', 'true');
    } else {
      board.element.removeAttribute('aria-busy');
    }
  };

  store.subscribe(() => updateUI());
  updateUI();

  await loadData(board, drawStatus);
  await loadSponsorsData(sponsorManager, sponsorView);

  const floatingButton = document.querySelector<HTMLButtonElement>('#floating-draw-button');
  if (floatingButton) {
    floatingButton.addEventListener('click', () => void drawController.draw());
  }

  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled rejection', event.reason);
    setStatusMessage(drawStatus, 'Si è verificato un errore imprevisto. Riprova.');
  });
}

async function loadData(board: BoardController, drawStatus: HTMLElement | null): Promise<void> {
  try {
    store.setStatus('loading');
    const entries = await loadNumbers(DATA_URL);
    board.render(entries);
    store.setState({ entries, status: 'ready', lastError: undefined });
    board.update(store.state);
    if (store.state.drawnNumbers.length > 0) {
      board.update(store.state);
    }
    setStatusMessage(drawStatus, 'Tabellone pronto. Puoi iniziare le estrazioni.');
  } catch (error) {
    console.error(error);
    store.setState({ status: 'error', lastError: ERROR_MESSAGES.data });
    setStatusMessage(drawStatus, ERROR_MESSAGES.data);
  }
}

async function loadSponsorsData(manager: SponsorManager, view: SponsorView): Promise<void> {
  try {
    store.setSponsorStatus('loading');
    const sponsors = await loadSponsors(SPONSORS_URL);
    manager.setSponsors(sponsors);
    store.setState({ sponsors, sponsorStatus: 'ready' });
    view.renderShowcase(sponsors);
    view.updateDrawSponsor(manager.peek());
  } catch (error) {
    console.warn(error);
    store.setState({ sponsorStatus: 'error' });
  }
}

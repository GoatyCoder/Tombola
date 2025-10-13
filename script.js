const state = {
  numbers: [],
  selected: null,
  currentUtterance: null,
  cellsByNumber: new Map(),
  drawnNumbers: new Set(),
  drawHistory: [],
  isAnimatingDraw: false,
  historyOpen: false,
  audioEnabled: true,
  storageErrorMessage: '',
  lastAnimatedHistoryNumber: null,
  activeEntry: null,
};

const elements = {
  board: document.querySelector('#board'),
  template: document.querySelector('#board-cell-template'),
  modal: document.querySelector('#number-modal'),
  modalNumber: document.querySelector('#modal-number'),
  modalItalian: document.querySelector('#modal-italian'),
  modalCaption: document.querySelector('#modal-caption'),
  modalMedia: document.querySelector('#number-modal .modal__media'),
  modalDialect: document.querySelector('#modal-dialect'),
  modalDialectText: document.querySelector('#modal-dialect-text'),
  modalImage: document.querySelector('#modal-image'),
  modalClose: document.querySelector('#modal-close'),
  modalPlay: document.querySelector('#modal-play'),
  modalNext: document.querySelector('#modal-next'),
  modalActions: document.querySelector('#modal-actions'),
  drawButton: document.querySelector('#draw-button'),
  resetButton: document.querySelector('#reset-button'),
  drawStatus: document.querySelector('#draw-status'),
  drawOverlay: document.querySelector('#draw-animation'),
  drawOverlayNumber: document.querySelector('#draw-animation-number'),
  drawOverlayBall: document.querySelector('#draw-animation-ball'),
  drawOverlayLabel: document.querySelector('#draw-animation-label'),
  drawOverlayContent: document.querySelector('#draw-animation .draw-overlay__content'),
  drawOverlayBag: document.querySelector('#draw-animation .draw-overlay__bag'),
  historyList: document.querySelector('#draw-history'),
  historyEmpty: document.querySelector('#draw-history-empty'),
  historyPanel: document.querySelector('#history-panel'),
  historyToggle: document.querySelector('#history-toggle'),
  historyScrim: document.querySelector('#history-scrim'),
  audioToggle: document.querySelector('#audio-toggle'),
};

const AUDIO_STORAGE_KEY = 'tombola-audio-enabled';
const DRAW_STATE_STORAGE_KEY = 'TOMBOLA_DRAW_STATE';
const EMPTY_DRAW_STATE = Object.freeze({ drawnNumbers: [], drawHistory: [] });

const MOBILE_HISTORY_QUERY = '(max-width: 540px)';
const historyMediaMatcher =
  typeof window !== 'undefined' && 'matchMedia' in window
    ? window.matchMedia(MOBILE_HISTORY_QUERY)
    : { matches: false };

const columnGradients = [
  ['#ff9a9e', '#f6416c'],
  ['#ffdd94', '#fa709a'],
  ['#70e1f5', '#ffd194'],
  ['#a18cd1', '#fbc2eb'],
  ['#84fab0', '#8fd3f4'],
  ['#f6d365', '#fda085'],
  ['#fccb90', '#d57eeb'],
  ['#5ee7df', '#b490ca'],
  ['#f5576c', '#f093fb'],
];

function syncHistoryPanelToLayout(options = {}) {
  const { immediate = false } = options;
  const { historyPanel, historyToggle, historyScrim } = elements;

  if (!historyPanel) {
    state.historyOpen = false;
    return;
  }

  const mobileLayout = Boolean(historyMediaMatcher.matches);

  if (!mobileLayout) {
    state.historyOpen = false;
    historyPanel.classList.remove('history-panel--open');
    historyPanel.setAttribute('aria-hidden', 'false');
    if (historyToggle) {
      historyToggle.setAttribute('aria-expanded', 'false');
    }
    if (historyScrim) {
      historyScrim.classList.remove('history-scrim--visible');
      historyScrim.hidden = true;
    }
    return;
  }

  historyPanel.setAttribute('aria-hidden', state.historyOpen ? 'false' : 'true');
  historyPanel.classList.toggle('history-panel--open', state.historyOpen);
  if (historyToggle) {
    historyToggle.setAttribute('aria-expanded', state.historyOpen ? 'true' : 'false');
  }

  if (!historyScrim) {
    return;
  }

  if (state.historyOpen) {
    historyScrim.hidden = false;
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        historyScrim.classList.add('history-scrim--visible');
      });
    } else {
      historyScrim.classList.add('history-scrim--visible');
    }
  } else {
    historyScrim.classList.remove('history-scrim--visible');
    const finalizeHide = () => {
      if (!state.historyOpen) {
        historyScrim.hidden = true;
      }
      historyScrim.removeEventListener('transitionend', finalizeHide);
    };

    if (immediate) {
      finalizeHide();
    } else {
      historyScrim.addEventListener('transitionend', finalizeHide);
      window.setTimeout(finalizeHide, 260);
    }
  }
}

function openHistoryPanel() {
  if (state.historyOpen) {
    return;
  }
  state.historyOpen = true;
  syncHistoryPanelToLayout();
  window.setTimeout(() => {
    if (state.historyOpen && elements.historyPanel) {
      elements.historyPanel.focus({ preventScroll: true });
    }
  }, 120);
}

function closeHistoryPanel(options = {}) {
  const { immediate = false } = options;
  if (!state.historyOpen) {
    syncHistoryPanelToLayout({ immediate });
    return;
  }
  state.historyOpen = false;
  syncHistoryPanelToLayout({ immediate });
}

function toggleHistoryPanel() {
  if (!historyMediaMatcher.matches) {
    if (elements.historyPanel) {
      elements.historyPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    return;
  }

  if (state.historyOpen) {
    closeHistoryPanel();
  } else {
    openHistoryPanel();
  }
}

function updateAudioToggle() {
  const { audioToggle } = elements;
  if (!audioToggle) {
    return;
  }

  const enabled = Boolean(state.audioEnabled);
  audioToggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  audioToggle.classList.toggle('board-panel__audio-toggle--off', !enabled);
  audioToggle.textContent = enabled ? 'Audio attivo' : 'Audio disattivato';
  const actionLabel = enabled ? 'Disattiva annuncio audio' : 'Attiva annuncio audio';
  audioToggle.setAttribute('aria-label', actionLabel);
  audioToggle.title = actionLabel;
}

function setAudioEnabled(enabled) {
  const nextValue = Boolean(enabled);
  state.audioEnabled = nextValue;

  if (
    !nextValue &&
    state.currentUtterance &&
    typeof window !== 'undefined' &&
    'speechSynthesis' in window
  ) {
    window.speechSynthesis.cancel();
    state.currentUtterance = null;
  }

  updateAudioToggle();
  refreshModalPlayButton();

  try {
    if (typeof window !== 'undefined' && 'localStorage' in window) {
      window.localStorage.setItem(AUDIO_STORAGE_KEY, nextValue ? 'true' : 'false');
    }
  } catch (error) {
    console.warn('Impossibile salvare la preferenza audio', error);
  }
}

function initializeAudioPreference() {
  if (typeof window === 'undefined') {
    state.audioEnabled = true;
    updateAudioToggle();
    return;
  }

  try {
    if ('localStorage' in window) {
      const stored = window.localStorage.getItem(AUDIO_STORAGE_KEY);
      if (stored !== null) {
        state.audioEnabled = stored === 'true';
      }
    }
  } catch (error) {
    console.warn('Impossibile leggere la preferenza audio', error);
    state.audioEnabled = true;
  }

  updateAudioToggle();
  refreshModalPlayButton();
}

function persistDrawState() {
  if (typeof window === 'undefined' || !('localStorage' in window)) {
    return;
  }

  try {
    const payload = {
      drawnNumbers: Array.from(state.drawnNumbers),
      drawHistory: state.drawHistory.map((item) => ({ ...item })),
    };
    window.localStorage.setItem(DRAW_STATE_STORAGE_KEY, JSON.stringify(payload));
    state.storageErrorMessage = '';
  } catch (error) {
    console.warn('Impossibile salvare lo stato della partita', error);
    state.storageErrorMessage = 'Impossibile salvare lo stato della partita.';
  }
}

function clearPersistedDrawState() {
  if (typeof window === 'undefined' || !('localStorage' in window)) {
    return;
  }

  try {
    window.localStorage.removeItem(DRAW_STATE_STORAGE_KEY);
    state.storageErrorMessage = '';
  } catch (error) {
    console.warn('Impossibile cancellare lo stato salvato', error);
    state.storageErrorMessage = 'Impossibile cancellare lo stato salvato.';
  }
}

function restoreDrawStateFromStorage() {
  if (typeof window === 'undefined' || !('localStorage' in window)) {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(DRAW_STATE_STORAGE_KEY);
    if (!stored) {
      state.storageErrorMessage = '';
      return null;
    }

    const parsed = JSON.parse(stored);
    const source = parsed && typeof parsed === 'object' ? parsed : EMPTY_DRAW_STATE;
    const history = Array.isArray(source.drawHistory) ? source.drawHistory : [];
    const storedNumbers = Array.isArray(source.drawnNumbers)
      ? source.drawnNumbers
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value))
      : [];
    const limitSet = storedNumbers.length ? new Set(storedNumbers) : null;
    const numbersMap = new Map(state.numbers.map((entry) => [entry.number, entry]));
    const seen = new Set();
    let latestEntry = null;

    history.forEach((item) => {
      if (
        !item ||
        (typeof item.number !== 'number' && typeof item.number !== 'string')
      ) {
        return;
      }

      const number = Number(item.number);
      if (!Number.isInteger(number)) {
        return;
      }
      if (seen.has(number)) {
        return;
      }

      if (limitSet && !limitSet.has(number)) {
        return;
      }

      const entry = numbersMap.get(number);
      if (!entry) {
        return;
      }

      seen.add(number);
      markNumberDrawn(entry, { animate: false });
      latestEntry = entry;
    });

    if (limitSet) {
      storedNumbers.forEach((value) => {
        const number = Number(value);
        if (!Number.isInteger(number)) {
          return;
        }

        if (seen.has(number)) {
          return;
        }

        const entry = numbersMap.get(number);
        if (!entry) {
          return;
        }

        seen.add(number);
        markNumberDrawn(entry, { animate: false });
        latestEntry = entry;
      });
    }

    state.storageErrorMessage = '';
    return latestEntry;
  } catch (error) {
    console.warn('Impossibile ripristinare lo stato della partita', error);
    state.storageErrorMessage = 'Impossibile ripristinare lo stato precedente.';
    return null;
  }
}

async function loadNumbers() {
  try {
    const response = await fetch('data.json');
    if (!response.ok) {
      throw new Error('Impossibile caricare i dati');
    }
    const data = await response.json();
    state.numbers = data.numbers.sort((a, b) => a.number - b.number);
    state.drawnNumbers = new Set();
    state.drawHistory = [];
    state.storageErrorMessage = '';
    renderBoard();
    updateDrawHistory();

    const latestEntry = restoreDrawStateFromStorage();
    updateDrawStatus(latestEntry || undefined);
  } catch (error) {
    console.error(error);
    state.storageErrorMessage = '';
    elements.board.innerHTML =
      '<p class="board-error">Errore nel caricamento dei dati della tombola.</p>';
    if (elements.drawStatus) {
      elements.drawStatus.textContent = 'Errore nel caricamento dei numeri.';
    }
    if (elements.drawButton) {
      elements.drawButton.disabled = true;
    }
  }
}

function renderBoard() {
  elements.board.innerHTML = '';
  state.cellsByNumber = new Map();
  state.selected = null;
  state.activeEntry = null;
  refreshModalPlayButton();

  const columnLabels = [
    '1-9',
    '10-19',
    '20-29',
    '30-39',
    '40-49',
    '50-59',
    '60-69',
    '70-79',
    '80-90',
  ];

  const columns = Array.from({ length: 9 }, () => []);
  state.numbers.forEach((entry) => {
    const columnIndex = Math.min(Math.floor((entry.number - 1) / 10), 8);
    columns[columnIndex].push(entry);
  });

  columns.forEach((group, columnIndex) => {
    const column = document.createElement('div');
    column.className = 'board-grid__column';
    const columnTitle = document.createElement('p');
    columnTitle.className = 'board-grid__column-title';
    columnTitle.textContent = columnLabels[columnIndex];
    columnTitle.setAttribute('aria-hidden', 'true');
    column.appendChild(columnTitle);

    const cellsContainer = document.createElement('div');
    cellsContainer.className = 'board-grid__cells';

    group
      .sort((a, b) => a.number - b.number)
      .forEach((entry) => {
        const cell = elements.template.content.firstElementChild.cloneNode(true);
        cell.dataset.number = entry.number;
        const [gradientStart, gradientEnd] =
          columnGradients[columnIndex % columnGradients.length];
        cell.style.setProperty(
          '--cell-gradient',
          `linear-gradient(145deg, ${gradientStart}, ${gradientEnd})`
        );

        const boardImage =
          typeof entry.image === 'string' && entry.image.trim().length
            ? entry.image.trim()
            : null;
        if (boardImage) {
          const safeBoardImage = boardImage.replace(/(["\\])/g, '\\$1');
          cell.style.setProperty('--cell-image', `url("${safeBoardImage}")`);
          cell.classList.add('board-cell--has-image');
        } else {
          cell.style.setProperty('--cell-image', 'none');
          cell.classList.remove('board-cell--has-image');
        }

        const label = cell.querySelector('.board-cell__number');
        label.textContent = entry.number;

        const subtitle = cell.querySelector('.board-cell__subtitle');
        if (subtitle) {
          const dialectText = (entry.dialect || '').trim();
          if (dialectText) {
            subtitle.textContent = dialectText;
            subtitle.classList.remove('board-cell__subtitle--empty');
          } else {
            subtitle.textContent = '—';
            subtitle.classList.add('board-cell__subtitle--empty');
          }
        }

        const ariaParts = [`Numero ${entry.number}`];
        if (entry.italian) {
          ariaParts.push(entry.italian);
        }
        if (entry.dialect) {
          ariaParts.push(entry.dialect);
        }
        cell.setAttribute('aria-label', ariaParts.join('. '));
        cell.title = ariaParts.join(' • ');

        const isDrawn = state.drawnNumbers.has(entry.number);
        cell.classList.toggle('board-cell--drawn', isDrawn);
        cell.setAttribute('aria-pressed', isDrawn ? 'true' : 'false');

        cell.addEventListener('click', () => handleSelection(entry, cell));
        state.cellsByNumber.set(entry.number, cell);
        cellsContainer.appendChild(cell);
      });

    column.appendChild(cellsContainer);
    elements.board.appendChild(column);
  });
}

const PLACEHOLDER_IMAGE_SRC = 'images/placeholder.svg';
const PLACEHOLDER_DATA_URI = buildPlaceholderImage();
const placeholderPreloadImage =
  typeof Image === 'function' ? new Image() : null;
if (placeholderPreloadImage) {
  placeholderPreloadImage.src = PLACEHOLDER_IMAGE_SRC;
}

function buildPlaceholderImage() {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 320'>
      <defs>
        <linearGradient id='grad' x1='0%' y1='0%' x2='100%' y2='100%'>
          <stop offset='0%' stop-color='#f5f8ff'/>
          <stop offset='100%' stop-color='#dbe4ff'/>
        </linearGradient>
      </defs>
      <rect width='320' height='320' rx='44' fill='url(#grad)' stroke='#cbd5f5' stroke-width='6'/>
      <g fill='none' stroke='#94a3b8' stroke-linecap='round' stroke-linejoin='round'>
        <path d='M96 226c0-36 28-64 64-64s64 28 64 64' stroke-width='10'/>
        <circle cx='160' cy='128' r='48' stroke-width='10'/>
        <path d='M160 96c12 0 22 10 22 22' stroke-width='8' opacity='0.5'/>
      </g>
      <circle cx='80' cy='82' r='10' fill='#94a3b8' opacity='0.35'/>
      <circle cx='240' cy='102' r='12' fill='#94a3b8' opacity='0.25'/>
    </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function getNumberImage(entry) {
  if (!entry) {
    return PLACEHOLDER_IMAGE_SRC;
  }

  const candidate = entry.image ? String(entry.image).trim() : '';
  return candidate ? candidate : PLACEHOLDER_IMAGE_SRC;
}

function refreshModalPlayButton() {
  if (!elements.modalPlay) {
    return;
  }

  const entry = state.activeEntry;
  const dialect = entry && entry.dialect ? entry.dialect.trim() : '';
  const speechAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const canSpeak = Boolean(dialect) && speechAvailable;

  if (!canSpeak) {
    elements.modalPlay.hidden = true;
    elements.modalPlay.disabled = true;
    elements.modalPlay.classList.remove('modal__dialect-button--disabled');
    elements.modalPlay.removeAttribute('title');
    elements.modalPlay.setAttribute('aria-label', 'Annuncio non disponibile');
    return;
  }

  elements.modalPlay.hidden = false;
  const audioEnabled = Boolean(state.audioEnabled);
  elements.modalPlay.disabled = !audioEnabled;
  elements.modalPlay.classList.toggle('modal__dialect-button--disabled', !audioEnabled);

  const label = audioEnabled
    ? `Riproduci annuncio del numero ${entry.number}`
    : `Audio disattivato: attivalo per ascoltare il numero ${entry.number}`;
  elements.modalPlay.setAttribute('aria-label', label);
  elements.modalPlay.title = label;
}

function handleModalImageError() {
  if (!elements.modalImage) {
    return;
  }

  const stage = elements.modalImage.dataset.fallbackApplied || 'none';

  if (stage === 'data') {
    return;
  }

  if (stage === 'file') {
    elements.modalImage.dataset.fallbackApplied = 'data';
    elements.modalImage.src = PLACEHOLDER_DATA_URI;
  } else {
    elements.modalImage.dataset.fallbackApplied = 'file';
    elements.modalImage.src = PLACEHOLDER_IMAGE_SRC;
  }

  if (elements.modalMedia) {
    elements.modalMedia.classList.add('modal__media--placeholder');
    elements.modalMedia.classList.remove('modal__media--loading');
  }
  elements.modalImage.classList.remove('modal__image--hidden');
  elements.modalImage.alt = state.activeEntry
    ? `Illustrazione non disponibile per il numero ${state.activeEntry.number}`
    : 'Illustrazione non disponibile';
}

function setModalImage(entry, italianText) {
  if (!elements.modalImage) {
    return;
  }

  const hasCustomImage = Boolean(entry.image && String(entry.image).trim());
  const { modalImage, modalMedia } = elements;

  const finalizeLoad = () => {
    modalImage.classList.remove('modal__image--hidden');
    if (modalMedia) {
      modalMedia.classList.remove('modal__media--loading');
    }
  };

  if (modalMedia) {
    modalMedia.classList.toggle('modal__media--placeholder', !hasCustomImage);
    modalMedia.classList.toggle('modal__media--loading', hasCustomImage);
  }

  modalImage.dataset.fallbackApplied = 'none';

  if (hasCustomImage) {
    modalImage.classList.add('modal__image--hidden');
    modalImage.addEventListener('load', finalizeLoad, { once: true });
  } else {
    modalImage.classList.remove('modal__image--hidden');
  }

  modalImage.src = getNumberImage(entry);

  if (hasCustomImage && modalImage.complete && modalImage.naturalWidth > 0) {
    finalizeLoad();
  }

  modalImage.alt = hasCustomImage
    ? italianText
      ? `Illustrazione del numero ${entry.number}: ${italianText}`
      : `Illustrazione del numero ${entry.number}`
    : `Illustrazione non disponibile per il numero ${entry.number}`;
}

function handleSelection(
  entry,
  cell = state.cellsByNumber.get(entry.number),
  options = {}
) {
  if (!entry || !cell) return;

  const { fromDraw = false } = options;

  if (state.selected) {
    state.selected.classList.remove('board-cell--active');
  }
  state.selected = cell;
  cell.classList.add('board-cell--active');
  state.activeEntry = entry;

  openModal(entry, { fromDraw });
  speakEntry(entry);
}

function markNumberDrawn(entry, options = {}) {
  if (!entry) {
    return;
  }

  const { animate = false } = options;
  const number = entry.number;

  if (state.drawnNumbers.has(number)) {
    return;
  }

  state.drawnNumbers.add(number);
  if (animate) {
    state.lastAnimatedHistoryNumber = number;
  }

  state.drawHistory.push({
    number,
    italian: entry.italian || '',
    dialect: entry.dialect || '',
  });
  updateDrawHistory();
  persistDrawState();
  if (state.storageErrorMessage) {
    updateDrawStatus();
  }

  const cell = state.cellsByNumber.get(number);
  if (cell) {
    cell.classList.add('board-cell--drawn');
    cell.setAttribute('aria-pressed', 'true');
    if (animate) {
      cell.classList.add('board-cell--just-drawn');
      const handleAnimationEnd = (event) => {
        if (event.animationName === 'boardCellPop') {
          cell.classList.remove('board-cell--just-drawn');
          cell.removeEventListener('animationend', handleAnimationEnd);
        }
      };
      cell.addEventListener('animationend', handleAnimationEnd);
    }
  }
}

async function handleDraw() {
  if (state.isAnimatingDraw) {
    return;
  }

  if (state.historyOpen && historyMediaMatcher.matches) {
    closeHistoryPanel();
  }

  const remaining = state.numbers.filter(
    (entry) => !state.drawnNumbers.has(entry.number)
  );

  if (!remaining.length) {
    updateDrawStatus();
    return;
  }

  const modalWasOpen = elements.modal && !elements.modal.hasAttribute('hidden');
  if (modalWasOpen) {
    closeModal({ returnFocus: false });
  }

  const randomIndex = Math.floor(Math.random() * remaining.length);
  const entry = remaining[randomIndex];
  markNumberDrawn(entry, { animate: true });

  state.isAnimatingDraw = true;
  let restoreDrawButton = false;
  if (elements.drawButton) {
    restoreDrawButton = !elements.drawButton.disabled;
    elements.drawButton.disabled = true;
  }

  try {
    await showDrawAnimation(entry);
  } finally {
    state.isAnimatingDraw = false;
    if (elements.drawButton && restoreDrawButton) {
      elements.drawButton.disabled = false;
    }
  }

  handleSelection(entry, state.cellsByNumber.get(entry.number), { fromDraw: true });
  updateDrawStatus(entry);
}

function updateDrawHistory() {
  const { historyList, historyEmpty } = elements;

  if (!historyList) {
    return;
  }

  if (historyEmpty && !historyEmpty.dataset.initialText) {
    historyEmpty.dataset.initialText = historyEmpty.textContent;
  }

  const draws = state.drawHistory;
  historyList.innerHTML = '';

  if (draws.length === 0) {
    historyList.hidden = true;
    if (historyEmpty) {
      historyEmpty.textContent = historyEmpty.dataset.initialText || historyEmpty.textContent;
      historyEmpty.hidden = false;
    }
    return;
  }

  if (historyEmpty) {
    historyEmpty.textContent = historyEmpty.dataset.initialText || historyEmpty.textContent;
    historyEmpty.hidden = true;
  }

  historyList.hidden = false;

  for (let index = draws.length - 1; index >= 0; index -= 1) {
    const item = draws[index];
    const order = index + 1;
    const isLatest = index === draws.length - 1;
    const shouldAnimate = item.number === state.lastAnimatedHistoryNumber;

    const listItem = document.createElement('li');
    listItem.className = 'history-item';
    if (isLatest) {
      listItem.classList.add('history-item--latest');
      listItem.setAttribute('aria-current', 'true');
    }
    if (shouldAnimate) {
      listItem.classList.add('history-item--just-added');
      listItem.addEventListener(
        'animationend',
        () => listItem.classList.remove('history-item--just-added'),
        { once: true }
      );
    }

    const orderBadge = document.createElement('span');
    orderBadge.className = 'history-item__order';
    orderBadge.textContent = `#${order}`;
    orderBadge.setAttribute('aria-hidden', 'true');
    listItem.appendChild(orderBadge);

    const ball = document.createElement('span');
    ball.className = 'history-item__ball';
    ball.textContent = item.number;
    ball.setAttribute('aria-hidden', 'true');
    listItem.appendChild(ball);

    const details = document.createElement('div');
    details.className = 'history-item__details';

    const title = document.createElement('p');
    title.className = 'history-item__title';
    title.textContent = `Numero ${item.number}`;

    if (isLatest) {
      const latestLabel = document.createElement('p');
      latestLabel.className = 'history-item__latest-label';
      latestLabel.textContent = 'Ultimo numero';
      details.appendChild(latestLabel);
      title.classList.add('history-item__title--latest');
    }

    details.appendChild(title);

    const meta = document.createElement('p');
    meta.className = 'history-item__meta';
    const metaParts = [];
    if (item.italian) {
      metaParts.push(`Italiano: ${item.italian}`);
    }
    if (item.dialect) {
      metaParts.push(`Dialetto: ${item.dialect}`);
    }
    meta.textContent = metaParts.join(' · ') || 'Nessuna descrizione disponibile.';
    details.appendChild(meta);

    listItem.appendChild(details);
    historyList.appendChild(listItem);

    if (shouldAnimate) {
      const scrollToTop = () => {
        historyList.scrollTop = 0;
      };
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(scrollToTop);
      } else {
        scrollToTop();
      }
    }
  }

  if (state.lastAnimatedHistoryNumber !== null) {
    state.lastAnimatedHistoryNumber = null;
  } else {
    historyList.scrollTop = 0;
  }
}

function resetGame() {
  if (!state.numbers.length) {
    return;
  }

  closeHistoryPanel({ immediate: true });

  if (state.drawnNumbers.size > 0) {
    const shouldReset = window.confirm(
      'Vuoi ricominciare la partita? Tutti i numeri estratti verranno azzerati.'
    );
    if (!shouldReset) {
      return;
    }
  }

  if (!elements.modal.hasAttribute('hidden')) {
    closeModal({ returnFocus: false });
  }

  if (elements.drawOverlay && !elements.drawOverlay.hasAttribute('hidden')) {
    elements.drawOverlay.classList.remove('draw-overlay--visible');
    elements.drawOverlay.setAttribute('hidden', '');
    elements.drawOverlay.setAttribute('aria-hidden', 'true');
    if (elements.drawOverlayBall) {
      elements.drawOverlayBall.classList.remove('draw-overlay__ball--animate');
    }
  }

  state.isAnimatingDraw = false;

  if (state.currentUtterance && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  state.currentUtterance = null;

  state.drawnNumbers.clear();
  state.drawHistory = [];
  updateDrawHistory();
  clearPersistedDrawState();
  if (state.storageErrorMessage) {
    updateDrawStatus();
  }

  state.cellsByNumber.forEach((cell) => {
    cell.classList.remove('board-cell--drawn', 'board-cell--active');
    cell.setAttribute('aria-pressed', 'false');
  });

  state.selected = null;
  state.activeEntry = null;
  refreshModalPlayButton();

  updateDrawStatus();
  if (elements.drawStatus && !state.storageErrorMessage) {
    elements.drawStatus.textContent =
      'Tabellone azzerato. Pronto a estrarre il primo numero!';
  }

  if (elements.drawButton) {
    elements.drawButton.focus();
  }
}

function openModal(entry, options = {}) {
  const { fromDraw = false } = options;
  elements.modalNumber.textContent = `Numero ${entry.number}`;

  const italian = (entry.italian || '').trim();
  const italianDisplay = italian || 'Da completare';
  if (elements.modalItalian) {
    elements.modalItalian.textContent = italianDisplay;
  }
  if (elements.modalCaption) {
    elements.modalCaption.classList.toggle('missing', !italian);
  }

  const dialect = (entry.dialect || '').trim();
  const dialectDisplay = dialect || 'Da completare';
  if (elements.modalDialectText) {
    elements.modalDialectText.textContent = dialectDisplay;
  }
  if (elements.modalDialect) {
    elements.modalDialect.classList.toggle('missing', !dialect);
  }

  setModalImage(entry, italian);

  refreshModalPlayButton();

  elements.modal.removeAttribute('hidden');
  elements.modal.classList.remove('modal--closing');
  elements.modal.classList.add('modal--visible');
  document.body.classList.add('modal-open');

  let focusTarget = elements.modalClose;
  let shouldShowNext = false;

  if (elements.modalNext) {
    const total = state.numbers.length;
    const drawnCount = state.drawnNumbers.size;
    const remaining = Math.max(total - drawnCount, 0);
    shouldShowNext = fromDraw && remaining > 0;

    elements.modalNext.hidden = !shouldShowNext;
    elements.modalNext.disabled = !shouldShowNext;

    if (shouldShowNext) {
      elements.modalNext.textContent =
        remaining === 1 ? 'Estrai ultimo numero' : 'Estrai successivo';
      focusTarget = elements.modalNext;
    }
  }

  if (elements.modalActions) {
    elements.modalActions.hidden = !shouldShowNext;
  }

  if (!focusTarget || typeof focusTarget.focus !== 'function') {
    focusTarget = elements.modalClose || elements.modal;
  }

  if (focusTarget && typeof focusTarget.focus === 'function') {
    focusTarget.focus();
  }
}

function closeModal(options = {}) {
  const config = options instanceof Event ? {} : options;
  const { returnFocus = true } = config;

  if (!elements.modal || elements.modal.hasAttribute('hidden')) {
    if (elements.modalNext) {
      elements.modalNext.hidden = true;
    }
    if (elements.modalActions) {
      elements.modalActions.hidden = true;
    }
    state.activeEntry = null;
    refreshModalPlayButton();
    if (returnFocus && state.selected) {
      state.selected.focus();
    }
    return;
  }

  let finalized = false;

  const finalize = () => {
    if (finalized) {
      return;
    }
    finalized = true;
    elements.modal.setAttribute('hidden', '');
    elements.modal.classList.remove('modal--closing');
    document.body.classList.remove('modal-open');
    if (elements.modalNext) {
      elements.modalNext.hidden = true;
    }
    if (elements.modalActions) {
      elements.modalActions.hidden = true;
    }
    state.activeEntry = null;
    refreshModalPlayButton();
    if (returnFocus && state.selected) {
      state.selected.focus();
    }
  };

  elements.modal.classList.add('modal--closing');
  elements.modal.classList.remove('modal--visible');

  const handleTransitionEnd = (event) => {
    if (event.target === elements.modal) {
      finalize();
    }
  };

  elements.modal.addEventListener('transitionend', handleTransitionEnd, { once: true });
  window.setTimeout(finalize, 260);
}

function showDrawAnimation(entry) {
  return new Promise((resolve) => {
    const {
      drawOverlay,
      drawOverlayNumber,
      drawOverlayBall,
      drawOverlayLabel,
      drawOverlayContent,
      drawOverlayBag,
    } = elements;
    const targetCell = state.cellsByNumber.get(entry.number);

    if (!drawOverlay || !drawOverlayNumber || !drawOverlayBall) {
      if (targetCell) {
        targetCell.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
      resolve();
      return;
    }

    const prefersReducedMotion =
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let overlayHidden = false;

    const cleanupOverlay = (immediate = false) => {
      if (!drawOverlay || overlayHidden) {
        return;
      }

      drawOverlay.classList.remove('draw-overlay--visible');
      if (drawOverlayBall) {
        drawOverlayBall.classList.remove('draw-overlay__ball--animate');
      }
      const hide = () => {
        if (overlayHidden) {
          return;
        }
        overlayHidden = true;
        drawOverlay.setAttribute('hidden', '');
        drawOverlay.setAttribute('aria-hidden', 'true');
        if (drawOverlayContent) {
          drawOverlayContent.classList.remove('draw-overlay__content--active');
        }
        if (drawOverlayBag) {
          drawOverlayBag.classList.remove('draw-overlay__bag--animate');
        }
        if (drawOverlayLabel) {
          drawOverlayLabel.classList.remove('draw-overlay__label--reveal');
        }
      };

      if (immediate) {
        hide();
      } else {
        window.setTimeout(hide, 200);
      }
    };

    const finish = () => {
      cleanupOverlay(true);
      if (targetCell) {
        targetCell.classList.remove('board-cell--incoming');
      }
      resolve();
    };

    const startFlight = (fromRect) => {
      if (!targetCell) {
        finish();
        return;
      }

      targetCell.classList.add('board-cell--incoming');

      const flightBall = document.createElement('div');
      flightBall.className = 'draw-overlay__ball draw-flight-ball';
      const numberSpan = document.createElement('span');
      numberSpan.textContent = entry.number;
      flightBall.appendChild(numberSpan);

      const startX = fromRect.left + fromRect.width / 2;
      const startY = fromRect.top + fromRect.height / 2;
      flightBall.style.width = `${fromRect.width}px`;
      flightBall.style.height = `${fromRect.height}px`;
      flightBall.style.left = `${startX}px`;
      flightBall.style.top = `${startY}px`;
      document.body.appendChild(flightBall);

      if (typeof flightBall.animate !== 'function') {
        flightBall.remove();
        finish();
        return;
      }

      const animateTowardCell = () => {
        const targetRect = targetCell.getBoundingClientRect();
        const endX = targetRect.left + targetRect.width / 2;
        const endY = targetRect.top + targetRect.height / 2;
        const deltaX = endX - startX;
        const deltaY = endY - startY;
        const scale = Math.max(
          Math.min(targetRect.width / fromRect.width || 1, 1.2),
          0.55
        );

        const animation = flightBall.animate(
          [
            { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
            {
              transform: `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px)) scale(${scale})`,
              opacity: 0.94,
            },
          ],
          {
            duration: 720,
            easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.05)',
            fill: 'forwards',
          }
        );

        const complete = () => {
          flightBall.remove();
          finish();
        };

        animation.addEventListener('finish', complete, { once: true });
        animation.addEventListener('cancel', complete, { once: true });
      };

      if (!prefersReducedMotion) {
        targetCell.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        window.setTimeout(animateTowardCell, 240);
      } else {
        animateTowardCell();
      }
    };

    drawOverlayNumber.textContent = entry.number;
    if (drawOverlayLabel) {
      drawOverlayLabel.textContent = 'Pesca dal sacchetto…';
    }
    drawOverlay.setAttribute('aria-hidden', 'false');
    drawOverlay.removeAttribute('hidden');

    if (prefersReducedMotion) {
      drawOverlay.classList.add('draw-overlay--visible');
      if (drawOverlayContent) {
        drawOverlayContent.classList.add('draw-overlay__content--active');
      }
      if (drawOverlayBag) {
        drawOverlayBag.classList.add('draw-overlay__bag--animate');
      }
      if (drawOverlayLabel) {
        drawOverlayLabel.classList.add('draw-overlay__label--reveal');
      }
      if (targetCell) {
        targetCell.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
      window.setTimeout(() => {
        if (drawOverlayLabel) {
          drawOverlayLabel.textContent = `Numero ${entry.number}!`;
          drawOverlayLabel.classList.remove('draw-overlay__label--reveal');
          void drawOverlayLabel.offsetWidth;
          drawOverlayLabel.classList.add('draw-overlay__label--reveal');
        }
        finish();
      }, 450);
      return;
    }

    const activate = () => {
      const restartAnimation = (element, className) => {
        element.classList.remove(className);
        // force reflow to restart the animation when needed
        void element.offsetWidth;
        element.classList.add(className);
      };

      drawOverlay.classList.add('draw-overlay--visible');

      if (drawOverlayContent) {
        restartAnimation(drawOverlayContent, 'draw-overlay__content--active');
      }

      if (drawOverlayBag) {
        restartAnimation(drawOverlayBag, 'draw-overlay__bag--animate');
      }

      if (drawOverlayLabel) {
        restartAnimation(drawOverlayLabel, 'draw-overlay__label--reveal');
      }

      if (drawOverlayBall) {
        restartAnimation(drawOverlayBall, 'draw-overlay__ball--animate');
      }
    };

    window.requestAnimationFrame(activate);

    drawOverlayBall.addEventListener(
      'animationend',
      () => {
        if (drawOverlayLabel) {
          drawOverlayLabel.textContent = `Numero ${entry.number}!`;
        }
        const fromRect = drawOverlayBall.getBoundingClientRect();
        cleanupOverlay();
        startFlight(fromRect);
      },
      { once: true }
    );
  });
}

function speakEntry(entry) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return;
  }

  if (!state.audioEnabled) {
    if (state.currentUtterance) {
      window.speechSynthesis.cancel();
      state.currentUtterance = null;
    }
    return;
  }

  if (state.currentUtterance) {
    window.speechSynthesis.cancel();
  }

  const parts = [String(entry.number)];
  if (entry.dialect) {
    parts.push(entry.dialect);
  }

  const utterance = new SpeechSynthesisUtterance(parts.join('. '));
  utterance.lang = 'it-IT';
  utterance.rate = 0.92;
  utterance.pitch = 1.0;

  state.currentUtterance = utterance;
  utterance.addEventListener(
    'end',
    () => {
      if (state.currentUtterance === utterance) {
        state.currentUtterance = null;
      }
    },
    { once: true }
  );
  utterance.addEventListener(
    'error',
    () => {
      if (state.currentUtterance === utterance) {
        state.currentUtterance = null;
      }
    },
    { once: true }
  );
  window.speechSynthesis.speak(utterance);
}

function updateDrawStatus(latestEntry) {
  if (!elements.drawStatus) {
    return;
  }

  const total = state.numbers.length;
  const drawnCount = state.drawnNumbers.size;
  let message = state.storageErrorMessage || 'Caricamento del tabellone…';

  if (!state.storageErrorMessage && total > 0) {
    if (latestEntry) {
      const detail = latestEntry.italian || latestEntry.dialect || '';
      message = `Estratto il numero ${latestEntry.number}`;
      if (detail) {
        message += ` — ${detail}`;
      }
      message += `. ${drawnCount}/${total} numeri estratti.`;
    } else if (drawnCount === 0) {
      message = 'Pronto a estrarre il primo numero!';
    } else if (drawnCount === total) {
      message = 'Tutti i numeri sono stati estratti.';
    } else {
      message = `${drawnCount}/${total} numeri estratti.`;
    }
  }

  elements.drawStatus.textContent = message;

  if (elements.drawButton) {
    const noNumbersLoaded = total === 0;
    const finished = drawnCount === total && total > 0;
    elements.drawButton.disabled = noNumbersLoaded || finished;

    if (noNumbersLoaded) {
      elements.drawButton.textContent = 'Estrai numero';
    } else if (finished) {
      elements.drawButton.textContent = 'Fine estrazioni';
    } else if (drawnCount === 0) {
      elements.drawButton.textContent = 'Estrai primo numero';
    } else {
      elements.drawButton.textContent = 'Estrai successivo';
    }
  }

  if (elements.resetButton) {
    elements.resetButton.disabled = drawnCount === 0;
  }
}

function setupEventListeners() {
  if (elements.modalClose) {
    elements.modalClose.addEventListener('click', closeModal);
  }

  if (elements.modalImage) {
    elements.modalImage.addEventListener('error', handleModalImageError);
  }

  if (elements.modalPlay) {
    elements.modalPlay.addEventListener('click', () => {
      if (elements.modalPlay.disabled) {
        return;
      }
      if (state.activeEntry) {
        speakEntry(state.activeEntry);
      }
    });
  }

  if (elements.modalNext) {
    elements.modalNext.addEventListener('click', () => {
      elements.modalNext.disabled = true;
      handleDraw();
    });
  }

  if (elements.modal) {
    elements.modal.addEventListener('click', (event) => {
      if (event.target === elements.modal) {
        closeModal();
      }
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
      return;
    }

    if (elements.modal && !elements.modal.hasAttribute('hidden')) {
      closeModal();
      return;
    }

    if (state.historyOpen && historyMediaMatcher.matches) {
      closeHistoryPanel();
    }
  });

  if (elements.drawButton) {
    elements.drawButton.addEventListener('click', handleDraw);
  }

  if (elements.resetButton) {
    elements.resetButton.addEventListener('click', resetGame);
  }

  if (elements.historyToggle) {
    elements.historyToggle.addEventListener('click', toggleHistoryPanel);
  }

  if (elements.audioToggle) {
    elements.audioToggle.addEventListener('click', () => {
      setAudioEnabled(!state.audioEnabled);
    });
  }

  if (elements.historyScrim) {
    elements.historyScrim.addEventListener('click', () => {
      closeHistoryPanel();
    });
  }

  if (historyMediaMatcher && typeof historyMediaMatcher.addEventListener === 'function') {
    historyMediaMatcher.addEventListener('change', () => {
      closeHistoryPanel({ immediate: true });
      syncHistoryPanelToLayout({ immediate: true });
    });
  } else if (
    historyMediaMatcher &&
    typeof historyMediaMatcher.addListener === 'function'
  ) {
    historyMediaMatcher.addListener(() => {
      closeHistoryPanel({ immediate: true });
      syncHistoryPanelToLayout({ immediate: true });
    });
  }
}

function init() {
  initializeAudioPreference();
  setupEventListeners();
  syncHistoryPanelToLayout({ immediate: true });
  loadNumbers();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

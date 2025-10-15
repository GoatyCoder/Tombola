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
};

const elements = {
  board: document.querySelector('#board'),
  template: document.querySelector('#board-cell-template'),
  modal: document.querySelector('#number-modal'),
  modalNumber: document.querySelector('#modal-number'),
  modalItalian: document.querySelector('#modal-italian'),
  modalDialect: document.querySelector('#modal-dialect'),
  modalImage: document.querySelector('#modal-image'),
  modalCaption: document.querySelector('#modal-caption'),
  modalClose: document.querySelector('#modal-close'),
  modalPlay: document.querySelector('#modal-play'),
  modalNext: document.querySelector('#modal-next'),
  drawButton: document.querySelector('#draw-button'),
  resetButton: document.querySelector('#reset-button'),
  drawStatus: document.querySelector('#draw-status'),
  drawOverlay: document.querySelector('#draw-animation'),
  drawOverlayNumber: document.querySelector('#draw-animation-number'),
  drawOverlayBall: document.querySelector('#draw-animation-ball'),
  drawOverlayLabel: document.querySelector('#draw-animation-label'),
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
  const { board, template } = elements;
  if (!board || !template) {
    return;
  }

  board.innerHTML = '';
  state.cellsByNumber = new Map();
  state.selected = null;

  const fragment = document.createDocumentFragment();

  state.numbers.forEach((entry) => {
    const cell = template.content.firstElementChild.cloneNode(true);
    cell.dataset.number = entry.number;

    const numberEl = cell.querySelector('.board-cell__number');
    if (numberEl) {
      numberEl.textContent = entry.number;
    }

    const ariaLabelParts = [`Numero ${entry.number}`];
    if (entry.italian) {
      ariaLabelParts.push(entry.italian);
    }
    cell.setAttribute('aria-label', ariaLabelParts.join(' – '));

    const isDrawn = state.drawnNumbers.has(entry.number);
    cell.classList.toggle('board-cell--drawn', isDrawn);
    cell.setAttribute('aria-pressed', isDrawn ? 'true' : 'false');

    cell.addEventListener('click', () => handleSelection(entry, cell));
    state.cellsByNumber.set(entry.number, cell);
    fragment.appendChild(cell);
  });

  board.appendChild(fragment);
}

function buildNumberImage(number) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 160'>
      <rect width='160' height='160' rx='26' fill='#f8fafc' stroke='#cbd5f5' stroke-width='4' />
      <path d='M28 120h104' stroke='#e2e8f0' stroke-width='6' stroke-linecap='round' />
      <circle cx='80' cy='54' r='36' fill='#e2e8f0' />
      <text x='80' y='64' text-anchor='middle' font-size='48' font-family='Signika, sans-serif' fill='#1f2933' font-weight='700'>${number}</text>
    </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function getNumberImage(entry) {
  if (entry && entry.image) {
    return entry.image;
  }

  return buildNumberImage(entry.number);
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

    const listItem = document.createElement('li');
    listItem.className = 'history-item';
    if (isLatest) {
      listItem.classList.add('history-item--latest');
      listItem.setAttribute('aria-current', 'true');
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
  }

  historyList.scrollTop = 0;
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
  elements.modalItalian.textContent = entry.italian || '—';
  elements.modalDialect.textContent = entry.dialect || 'Da completare';
  elements.modalDialect.classList.toggle('missing', !entry.dialect);
  elements.modalImage.src = getNumberImage(entry);
  elements.modalImage.alt = entry.image
    ? entry.italian
      ? `Illustrazione del numero ${entry.number}: ${entry.italian}`
      : `Illustrazione del numero ${entry.number}`
    : `Segnaposto per il numero ${entry.number}`;
  elements.modalCaption.textContent = entry.italian || `Numero ${entry.number}`;

  elements.modal.removeAttribute('hidden');
  elements.modal.classList.add('modal--visible');
  document.body.classList.add('modal-open');

  let focusTarget = elements.modalClose;

  if (elements.modalNext) {
    const total = state.numbers.length;
    const drawnCount = state.drawnNumbers.size;
    const remaining = Math.max(total - drawnCount, 0);
    const shouldShow = fromDraw && remaining > 0;

    elements.modalNext.hidden = !shouldShow;
    elements.modalNext.disabled = !shouldShow;

    if (shouldShow) {
      elements.modalNext.textContent =
        remaining === 1 ? 'Estrai ultimo numero' : 'Estrai successivo';
      focusTarget = elements.modalNext;
    }
  }

  focusTarget.focus();
}

function closeModal(options = {}) {
  const config = options instanceof Event ? {} : options;
  const { returnFocus = true } = config;
  elements.modal.classList.remove('modal--visible');
  elements.modal.setAttribute('hidden', '');
  document.body.classList.remove('modal-open');
  if (elements.modalNext) {
    elements.modalNext.hidden = true;
  }
  if (returnFocus && state.selected) {
    state.selected.focus();
  }
}

function showDrawAnimation(entry) {
  return new Promise((resolve) => {
    const { drawOverlay, drawOverlayNumber, drawOverlayBall, drawOverlayLabel } =
      elements;
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
      if (targetCell) {
        targetCell.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
      window.setTimeout(() => {
        if (drawOverlayLabel) {
          drawOverlayLabel.textContent = `Numero ${entry.number}!`;
        }
        finish();
      }, 450);
      return;
    }

    const activate = () => {
      drawOverlay.classList.add('draw-overlay--visible');

      drawOverlayBall.classList.remove('draw-overlay__ball--animate');
      // force reflow to restart the animation when needed
      void drawOverlayBall.offsetWidth;
      drawOverlayBall.classList.add('draw-overlay__ball--animate');
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
  elements.modalClose.addEventListener('click', closeModal);
  elements.modalPlay.addEventListener('click', () => {
    if (state.selected) {
      const number = Number(state.selected.dataset.number);
      const entry = state.numbers.find((item) => item.number === number);
      if (entry) {
        speakEntry(entry);
      }
    }
  });

  if (elements.modalNext) {
    elements.modalNext.addEventListener('click', () => {
      elements.modalNext.disabled = true;
      handleDraw();
    });
  }

  elements.modal.addEventListener('click', (event) => {
    if (event.target === elements.modal) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
      return;
    }

    if (!elements.modal.hasAttribute('hidden')) {
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

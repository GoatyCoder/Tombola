const state = {
  numbers: [],
  selected: null,
  currentUtterance: null,
  cellsByNumber: new Map(),
  drawnNumbers: new Set(),
  drawHistory: [],
  isAnimatingDraw: false,
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
  historyLatest: document.querySelector('#draw-history-latest'),
  historyLatestNumber: document.querySelector('#draw-history-latest-number'),
  historyLatestDetail: document.querySelector('#draw-history-latest-detail'),
};

async function loadNumbers() {
  try {
    const response = await fetch('data.json');
    if (!response.ok) {
      throw new Error('Impossibile caricare i dati');
    }
    const data = await response.json();
    state.numbers = data.numbers.sort((a, b) => a.number - b.number);
    renderBoard();
    state.drawHistory = [];
    updateDrawHistory();
    updateDrawStatus();
  } catch (error) {
    console.error(error);
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
        const image = cell.querySelector('img');
        image.src = buildNumberImage(entry.number);
        image.alt = `Segnaposto del numero ${entry.number}`;

        const label = cell.querySelector('.board-cell__number');
        label.textContent = entry.number;

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

function buildNumberImage(number) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 160'>
      <rect width='160' height='160' rx='26' fill='#f8fafc' stroke='#cbd5f5' stroke-width='4' />
      <path d='M28 120h104' stroke='#e2e8f0' stroke-width='6' stroke-linecap='round' />
      <circle cx='80' cy='54' r='36' fill='#e2e8f0' />
      <text x='80' y='64' text-anchor='middle' font-size='48' font-family='Signika, sans-serif' fill='#1f2933' font-weight='700'>${number}</text>
    </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
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
  const {
    historyList,
    historyEmpty,
    historyLatest,
    historyLatestNumber,
    historyLatestDetail,
  } = elements;

  if (!historyList) {
    return;
  }

  const draws = state.drawHistory;
  historyList.innerHTML = '';

  if (draws.length === 0) {
    historyList.hidden = true;
    if (historyEmpty) {
      historyEmpty.hidden = false;
    }
    if (historyLatest) {
      historyLatest.hidden = true;
    }
    return;
  }

  historyList.hidden = false;
  if (historyEmpty) {
    historyEmpty.hidden = true;
  }

  const latest = draws[draws.length - 1];
  if (historyLatest && historyLatestNumber && historyLatestDetail) {
    historyLatest.hidden = false;
    historyLatestNumber.textContent = latest.number;

    const summaryParts = [];
    if (latest.italian) {
      summaryParts.push(latest.italian);
    }
    if (latest.dialect) {
      summaryParts.push(latest.dialect);
    }
    historyLatestDetail.textContent =
      summaryParts.join(' · ') || 'In attesa di descrizione.';
  }

  for (let index = draws.length - 1; index >= 0; index -= 1) {
    const item = draws[index];
    const order = index + 1;

    const listItem = document.createElement('li');
    listItem.className = 'history-item';
    if (index === draws.length - 1) {
      listItem.classList.add('history-item--latest');
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

  state.cellsByNumber.forEach((cell) => {
    cell.classList.remove('board-cell--drawn', 'board-cell--active');
    cell.setAttribute('aria-pressed', 'false');
  });

  state.selected = null;

  updateDrawStatus();
  if (elements.drawStatus) {
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
  elements.modalImage.src = buildNumberImage(entry.number);
  elements.modalImage.alt = `Segnaposto per il numero ${entry.number}`;
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
  if (!('speechSynthesis' in window)) {
    return;
  }

  if (state.currentUtterance) {
    window.speechSynthesis.cancel();
  }

  const parts = [`Numero ${entry.number}`];
  if (entry.italian) {
    parts.push(entry.italian);
  }
  if (entry.dialect) {
    parts.push(entry.dialect);
  }

  const utterance = new SpeechSynthesisUtterance(parts.join('. '));
  utterance.lang = 'it-IT';
  utterance.rate = 0.92;
  utterance.pitch = 1.0;

  state.currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}

function updateDrawStatus(latestEntry) {
  if (!elements.drawStatus) {
    return;
  }

  const total = state.numbers.length;
  const drawnCount = state.drawnNumbers.size;
  let message = 'Caricamento del tabellone…';

  if (total > 0) {
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
    if (event.key === 'Escape' && !elements.modal.hasAttribute('hidden')) {
      closeModal();
    }
  });

  if (elements.drawButton) {
    elements.drawButton.addEventListener('click', handleDraw);
  }

  if (elements.resetButton) {
    elements.resetButton.addEventListener('click', resetGame);
  }
}

function init() {
  setupEventListeners();
  loadNumbers();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

const state = {
  numbers: [],
  selected: null,
  currentUtterance: null,
  cellsByNumber: new Map(),
  drawnNumbers: new Set(),
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

function markNumberDrawn(number) {
  if (state.drawnNumbers.has(number)) {
    return;
  }
  state.drawnNumbers.add(number);
  const cell = state.cellsByNumber.get(number);
  if (cell) {
    cell.classList.add('board-cell--drawn');
    cell.setAttribute('aria-pressed', 'true');
  }
}

function handleDraw() {
  const remaining = state.numbers.filter(
    (entry) => !state.drawnNumbers.has(entry.number)
  );

  if (!remaining.length) {
    updateDrawStatus();
    return;
  }

  const randomIndex = Math.floor(Math.random() * remaining.length);
  const entry = remaining[randomIndex];
  markNumberDrawn(entry.number);
  updateDrawStatus(entry);
  handleSelection(entry, state.cellsByNumber.get(entry.number), { fromDraw: true });
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

  if (state.currentUtterance && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  state.currentUtterance = null;

  state.drawnNumbers.clear();

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

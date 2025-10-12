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
  drawButton: document.querySelector('#draw-button'),
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
  const fragment = document.createDocumentFragment();
  state.cellsByNumber = new Map();

  state.numbers.forEach((entry) => {
    const cell = elements.template.content.firstElementChild.cloneNode(true);
    cell.dataset.number = entry.number;
    const image = cell.querySelector('img');
    image.src = buildNumberImage(entry.number);
    image.alt = `Illustrazione del numero ${entry.number}`;

    const label = cell.querySelector('.number-card__label');
    label.textContent = entry.number;

    const isDrawn = state.drawnNumbers.has(entry.number);
    cell.classList.toggle('number-card--drawn', isDrawn);
    cell.setAttribute('aria-pressed', isDrawn ? 'true' : 'false');

    cell.addEventListener('click', () => handleSelection(entry, cell));
    state.cellsByNumber.set(entry.number, cell);
    fragment.appendChild(cell);
  });

  elements.board.appendChild(fragment);
}

function buildNumberImage(number) {
  const hue = (number * 37) % 360;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 160'>
      <defs>
        <linearGradient id='grad' x1='0%' y1='0%' x2='100%' y2='100%'>
          <stop offset='0%' stop-color='hsl(${hue}, 80%, 65%)' />
          <stop offset='100%' stop-color='hsl(${(hue + 40) % 360}, 85%, 55%)' />
        </linearGradient>
      </defs>
      <rect width='160' height='160' rx='28' fill='url(#grad)' />
      <text x='50%' y='54%' dominant-baseline='middle' text-anchor='middle' font-size='92' font-family='Signika, sans-serif' fill='rgba(255,255,255,0.95)' font-weight='700'>${number}</text>
      <text x='50%' y='78%' dominant-baseline='middle' text-anchor='middle' font-size='20' font-family='Signika, sans-serif' fill='rgba(255,255,255,0.7)'>Nojana</text>
    </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function handleSelection(entry, cell = state.cellsByNumber.get(entry.number)) {
  if (!entry || !cell) return;

  if (state.selected) {
    state.selected.classList.remove('number-card--active');
  }
  state.selected = cell;
  cell.classList.add('number-card--active');

  openModal(entry);
  speakEntry(entry);
}

function markNumberDrawn(number) {
  if (state.drawnNumbers.has(number)) {
    return;
  }
  state.drawnNumbers.add(number);
  const cell = state.cellsByNumber.get(number);
  if (cell) {
    cell.classList.add('number-card--drawn');
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
  handleSelection(entry);
}

function openModal(entry) {
  elements.modalNumber.textContent = `Numero ${entry.number}`;
  elements.modalItalian.textContent = entry.italian || '—';
  elements.modalDialect.textContent = entry.dialect || 'Pronuncia da completare';
  elements.modalDialect.classList.toggle('missing', !entry.dialect);
  elements.modalImage.src = buildNumberImage(entry.number);
  elements.modalImage.alt = `Numero ${entry.number}`;
  elements.modalCaption.textContent = entry.italian || `Numero ${entry.number}`;

  elements.modal.removeAttribute('hidden');
  elements.modal.classList.add('modal--visible');
  document.body.classList.add('modal-open');
  elements.modalClose.focus();
}

function closeModal() {
  elements.modal.classList.remove('modal--visible');
  elements.modal.setAttribute('hidden', '');
  document.body.classList.remove('modal-open');
  if (state.selected) {
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
  if (entry.dialect) {
    parts.push(`Pronuncia nojano: ${entry.dialect}`);
  } else if (entry.italian) {
    parts.push(entry.italian);
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
      const detail = latestEntry.dialect || latestEntry.italian || '';
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
    const disable = drawnCount === total || total === 0;
    elements.drawButton.disabled = disable;
    elements.drawButton.textContent =
      disable && total > 0 ? 'Fine estrazioni' : 'Estrai numero';
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

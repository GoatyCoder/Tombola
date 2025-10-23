const DATA_PATH = 'data.json';
const SPONSOR_PATH = 'sponsors.json';
const STORAGE_KEYS = Object.freeze({
  audio: 'tombola-audio-enabled',
  draw: 'tombola-draw-state-v3',
});
const DEFAULT_IMAGE = 'images/sample.jpg';
const TOTAL_NUMBERS = 90;

const state = {
  entries: [],
  boardCells: new Map(),
  drawnNumbers: new Set(),
  history: [],
  lastEntry: null,
  audioEnabled: true,
  sponsors: [],
};

const elements = {
  board: document.querySelector('#board'),
  template: document.querySelector('#board-cell-template'),
  drawButton: document.querySelector('#draw-button'),
  drawFab: document.querySelector('#floating-draw'),
  resetButton: document.querySelector('#reset-button'),
  audioFab: document.querySelector('#floating-audio'),
  lastNumber: document.querySelector('#last-number'),
  lastDialect: document.querySelector('#last-dialect'),
  lastStatus: document.querySelector('#last-status'),
  progressCount: document.querySelector('#progress-count'),
  progressBar: document.querySelector('#progress-bar'),
  historyList: document.querySelector('#history-list'),
  historyEmpty: document.querySelector('#history-empty'),
  historyClear: document.querySelector('#history-clear'),
  detailDialog: document.querySelector('#detail-dialog'),
  detailImage: document.querySelector('#detail-image'),
  detailOverlay: document.querySelector('#detail-overlay'),
  detailClose: document.querySelector('#detail-close'),
  detailNext: document.querySelector('#detail-next'),
  detailSponsor: document.querySelector('#detail-sponsor'),
  detailSponsorLink: document.querySelector('#detail-sponsor-link'),
  detailSponsorLogo: document.querySelector('#detail-sponsor-logo'),
  sponsorSection: document.querySelector('#sponsor-section'),
  sponsorList: document.querySelector('#sponsor-list'),
};

const supportsDialog =
  typeof window !== 'undefined' &&
  typeof HTMLDialogElement !== 'undefined' &&
  elements.detailDialog instanceof HTMLDialogElement &&
  typeof elements.detailDialog.showModal === 'function';

document.addEventListener('DOMContentLoaded', () => {
  hydrateAudioPreference();
  wireEventListeners();
  initialiseApp();
});

async function initialiseApp() {
  try {
    const data = await fetchNumbers();
    state.entries = normaliseEntries(data);
    buildBoard(state.entries);
    restoreDrawState();
    updateSummary();
    renderHistory();
    updateButtons();
    if (elements.drawFab) {
      elements.drawFab.disabled = state.entries.length === 0;
    }
    if (elements.drawButton) {
      elements.drawButton.disabled = state.entries.length === 0;
    }
    if (elements.resetButton) {
      elements.resetButton.disabled = state.drawnNumbers.size === 0;
    }
    if (elements.historyClear) {
      elements.historyClear.disabled = state.drawnNumbers.size === 0;
    }
    if (state.entries.length > 0) {
      announceReady();
    }
    void loadSponsors();
  } catch (error) {
    console.error('Impossibile inizializzare il tabellone', error);
    if (elements.lastStatus) {
      elements.lastStatus.textContent = 'Errore durante il caricamento dei dati. Riprova.';
    }
  }
}

function hydrateAudioPreference() {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.audio);
    if (stored !== null) {
      state.audioEnabled = stored === 'true';
    }
  } catch (error) {
    console.warn('Impossibile leggere le preferenze audio', error);
  }
  updateAudioToggle();
}

function wireEventListeners() {
  if (elements.drawButton) {
    elements.drawButton.addEventListener('click', () => drawNumber({ revealDetail: true }));
  }
  if (elements.drawFab) {
    elements.drawFab.addEventListener('click', () => drawNumber({ revealDetail: true }));
  }
  if (elements.resetButton) {
    elements.resetButton.addEventListener('click', resetGame);
  }
  if (elements.audioFab) {
    elements.audioFab.addEventListener('click', toggleAudio);
  }
  if (elements.historyClear) {
    elements.historyClear.addEventListener('click', resetGame);
  }
  if (elements.historyList) {
    elements.historyList.addEventListener('click', onHistoryClick);
  }
  if (elements.detailClose) {
    elements.detailClose.addEventListener('click', closeDetailDialog);
  }
  if (elements.detailNext) {
    elements.detailNext.addEventListener('click', () => {
      drawNumber({ revealDetail: true, focusDialog: true });
    });
  }

  const handleBackdropClick = (event) => {
    if (event.target === elements.detailDialog) {
      closeDetailDialog();
    }
  };

  if (supportsDialog) {
    elements.detailDialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeDetailDialog();
    });
  }

  elements.detailDialog.addEventListener('click', handleBackdropClick);
}

async function fetchNumbers() {
  const response = await fetch(DATA_PATH);
  if (!response.ok) {
    throw new Error('Risposta non valida dal server');
  }
  const payload = await response.json();
  if (Array.isArray(payload?.numbers)) {
    return payload.numbers;
  }
  if (Array.isArray(payload)) {
    return payload;
  }
  throw new Error('Formato dati non valido');
}

function normaliseEntries(rawEntries) {
  return rawEntries
    .map((entry) => ({
      number: Number(entry?.number),
      italian: typeof entry?.italian === 'string' ? entry.italian.trim() : '',
      dialect: typeof entry?.dialect === 'string' ? entry.dialect.trim() : '',
      image: DEFAULT_IMAGE,
    }))
    .filter((entry) => Number.isInteger(entry.number) && entry.number > 0 && entry.number <= TOTAL_NUMBERS)
    .sort((a, b) => a.number - b.number);
}

function buildBoard(entries) {
  elements.board.innerHTML = '';
  state.boardCells.clear();

  const fragment = document.createDocumentFragment();

  entries.forEach((entry) => {
    const instance = elements.template.content.firstElementChild.cloneNode(true);
    instance.dataset.number = String(entry.number);
    instance.setAttribute('role', 'gridcell');
    instance.setAttribute('aria-pressed', 'false');
    instance.setAttribute('aria-label', `Numero ${entry.number}`);
    instance.addEventListener('click', () => openDetail(entry.number));
    fragment.appendChild(instance);
    state.boardCells.set(entry.number, instance);
  });

  elements.board.appendChild(fragment);
}

function restoreDrawState() {
  let storedState = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.draw);
    if (raw) {
      storedState = JSON.parse(raw);
    }
  } catch (error) {
    console.warn('Impossibile recuperare lo stato della partita', error);
  }

  if (!storedState || !Array.isArray(storedState.drawnNumbers)) {
    return;
  }

  const validNumbers = new Set(state.entries.map((entry) => entry.number));

  storedState.drawnNumbers
    .map((value) => Number(value))
    .filter((value) => validNumbers.has(value))
    .forEach((value) => {
      state.drawnNumbers.add(value);
      const tile = state.boardCells.get(value);
      if (tile) {
        tile.classList.add('is-drawn');
        tile.setAttribute('aria-pressed', 'true');
      }
    });

  if (Array.isArray(storedState.history)) {
    state.history = storedState.history
      .map((value) => Number(value))
      .filter((value) => validNumbers.has(value));
  }

  if (typeof storedState.lastNumber === 'number' && validNumbers.has(storedState.lastNumber)) {
    state.lastEntry = state.entries.find((entry) => entry.number === storedState.lastNumber) || null;
  }
}

function persistDrawState() {
  try {
    if (state.drawnNumbers.size === 0) {
      localStorage.removeItem(STORAGE_KEYS.draw);
      return;
    }
    const payload = {
      drawnNumbers: Array.from(state.drawnNumbers),
      history: state.history.slice(),
      lastNumber: state.lastEntry ? state.lastEntry.number : null,
    };
    localStorage.setItem(STORAGE_KEYS.draw, JSON.stringify(payload));
  } catch (error) {
    console.warn('Impossibile salvare lo stato della partita', error);
  }
}

function updateSummary() {
  const drawnCount = state.drawnNumbers.size;
  const total = state.entries.length || TOTAL_NUMBERS;
  const percentage = total > 0 ? Math.round((drawnCount / total) * 100) : 0;
  elements.progressCount.textContent = `${drawnCount}/${total}`;
  elements.progressBar.style.width = `${percentage}%`;
  const progressHost = elements.progressBar.parentElement;
  if (progressHost) {
    progressHost.setAttribute('aria-valuenow', String(drawnCount));
    progressHost.setAttribute('aria-valuemax', String(total));
  }

  if (!state.lastEntry) {
    elements.lastNumber.textContent = '—';
    if (elements.lastDialect) {
      elements.lastDialect.textContent = '—';
    }
    if (elements.lastStatus) {
      elements.lastStatus.textContent = 'Premi “Estrai numero” per avviare la tombolata.';
    }
    return;
  }

  elements.lastNumber.textContent = state.lastEntry.number;
  if (elements.lastDialect) {
    elements.lastDialect.textContent = state.lastEntry.dialect || '—';
  }
  if (elements.lastStatus) {
    elements.lastStatus.textContent = 'Numero estratto dal tabellone.';
  }
}

function updateButtons() {
  const allDrawn = state.drawnNumbers.size >= state.entries.length && state.entries.length > 0;
  if (elements.drawButton) {
    elements.drawButton.disabled = allDrawn || state.entries.length === 0;
  }
  if (elements.drawFab) {
    elements.drawFab.disabled = allDrawn || state.entries.length === 0;
  }
  if (elements.resetButton) {
    elements.resetButton.disabled = state.drawnNumbers.size === 0;
  }
  if (elements.historyClear) {
    elements.historyClear.disabled = state.drawnNumbers.size === 0;
  }
  if (elements.detailNext) {
    elements.detailNext.disabled = allDrawn;
  }
}

function drawNumber({ revealDetail = false, focusDialog = false } = {}) {
  if (state.entries.length === 0) {
    return;
  }

  const available = state.entries.filter((entry) => !state.drawnNumbers.has(entry.number));
  if (available.length === 0) {
    updateButtons();
    return;
  }

  const nextEntry = available[Math.floor(Math.random() * available.length)];
  state.drawnNumbers.add(nextEntry.number);
  state.history.unshift(nextEntry.number);
  state.lastEntry = nextEntry;

  const tile = state.boardCells.get(nextEntry.number);
  if (tile) {
    tile.classList.add('is-drawn');
    tile.setAttribute('aria-pressed', 'true');
    if (!focusDialog) {
      tile.focus({ preventScroll: true });
    }
  }

  if (state.audioEnabled) {
    speakEntry(nextEntry);
  }

  updateSummary();
  renderHistory();
  updateButtons();
  persistDrawState();

  if (revealDetail) {
    openDetail(nextEntry.number, { focusDialog });
  }
}

function renderHistory() {
  elements.historyList.innerHTML = '';

  if (state.history.length === 0) {
    elements.historyEmpty.hidden = false;
    return;
  }

  elements.historyEmpty.hidden = true;

  const fragment = document.createDocumentFragment();
  state.history.forEach((number) => {
    const entry = state.entries.find((item) => item.number === number);
    const item = document.createElement('li');
    item.className = 'history__item';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'history__button';
    button.dataset.number = String(number);
    const badge = document.createElement('span');
    badge.className = 'history__badge';
    badge.textContent = String(number);
    button.setAttribute('aria-label', `Numero ${entry?.number ?? number}`);
    button.append(badge);
    item.appendChild(button);
    fragment.appendChild(item);
  });
  elements.historyList.appendChild(fragment);
}

function onHistoryClick(event) {
  const target = event.target.closest('[data-number]');
  if (!target) {
    return;
  }
  const number = Number(target.dataset.number);
  if (!Number.isInteger(number)) {
    return;
  }
  openDetail(number, { focusDialog: true });
}

function openDetail(number, { focusDialog = false } = {}) {
  const entry = state.entries.find((item) => item.number === number);
  if (!entry) {
    return;
  }

  elements.detailImage.src = entry.image || DEFAULT_IMAGE;
  elements.detailImage.alt = `Illustrazione decorativa del numero ${entry.number}`;
  elements.detailDialog.setAttribute('aria-label', `Numero ${entry.number} estratto`);
  if (elements.detailOverlay) {
    const isDrawn = state.drawnNumbers.has(number);
    elements.detailOverlay.classList.toggle('is-active', isDrawn);
  }
  showRandomSponsorInDialog();

  if (supportsDialog) {
    if (!elements.detailDialog.open) {
      elements.detailDialog.showModal();
    }
    if (focusDialog) {
      elements.detailDialog.focus();
    }
  } else {
    elements.detailDialog.setAttribute('open', '');
    document.body.classList.add('detail-dialog--open');
  }

  updateButtons();
}

function closeDetailDialog() {
  if (supportsDialog) {
    elements.detailDialog.close();
  } else {
    elements.detailDialog.removeAttribute('open');
    document.body.classList.remove('detail-dialog--open');
  }
}

function showRandomSponsorInDialog() {
  if (!elements.detailSponsor) {
    return;
  }

  if (!Array.isArray(state.sponsors) || state.sponsors.length === 0) {
    elements.detailSponsor.hidden = true;
    if (elements.detailSponsorLink) {
      elements.detailSponsorLink.removeAttribute('href');
    }
    if (elements.detailSponsorLogo) {
      elements.detailSponsorLogo.src = '';
      elements.detailSponsorLogo.alt = '';
    }
    return;
  }

  const sponsor = state.sponsors[Math.floor(Math.random() * state.sponsors.length)];
  elements.detailSponsor.hidden = false;
  if (elements.detailSponsorLink) {
    elements.detailSponsorLink.href = sponsor.url;
  }
  if (elements.detailSponsorLogo) {
    elements.detailSponsorLogo.src = sponsor.logo;
    elements.detailSponsorLogo.alt = 'Logo sponsor';
  }
}

function resetGame() {
  state.drawnNumbers.clear();
  state.history = [];
  state.lastEntry = null;
  state.boardCells.forEach((tile) => {
    tile.classList.remove('is-drawn');
    tile.setAttribute('aria-pressed', 'false');
  });
  if (
    (supportsDialog && elements.detailDialog.open) ||
    (!supportsDialog && document.body.classList.contains('detail-dialog--open'))
  ) {
    closeDetailDialog();
  }
  renderHistory();
  updateSummary();
  updateButtons();
  persistDrawState();
}

function toggleAudio() {
  state.audioEnabled = !state.audioEnabled;
  updateAudioToggle();
  try {
    localStorage.setItem(STORAGE_KEYS.audio, state.audioEnabled ? 'true' : 'false');
  } catch (error) {
    console.warn('Impossibile salvare le preferenze audio', error);
  }
}

function updateAudioToggle() {
  if (!elements.audioFab) {
    return;
  }
  const label = state.audioEnabled ? 'Disattiva audio' : 'Attiva audio';
  elements.audioFab.setAttribute('aria-pressed', state.audioEnabled ? 'true' : 'false');
  elements.audioFab.setAttribute('aria-label', label);
  elements.audioFab.setAttribute('title', label);
  elements.audioFab.classList.toggle('is-muted', !state.audioEnabled);
}

function speakEntry(entry) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return;
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      entry.dialect
        ? `${entry.number}. ${entry.italian}. In dialetto: ${entry.dialect}`
        : `${entry.number}. ${entry.italian || 'Numero estratto'}`
    );
    utterance.lang = 'it-IT';
    window.speechSynthesis.speak(utterance);
  } catch (error) {
    console.warn('Impossibile riprodurre l\'audio dell\'estrazione', error);
  }
}

function announceReady() {
  if (!state.audioEnabled) {
    return;
  }
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance('Tabellone pronto. Premi Estrai numero per iniziare.');
    utterance.lang = 'it-IT';
    window.speechSynthesis.speak(utterance);
  } catch (error) {
    console.warn('Impossibile riprodurre il messaggio iniziale', error);
  }
}

async function loadSponsors() {
  try {
    const response = await fetch(SPONSOR_PATH);
    if (!response.ok) {
      throw new Error('Risposta non valida');
    }
    const payload = await response.json();
    const list = Array.isArray(payload?.sponsors) ? payload.sponsors : Array.isArray(payload) ? payload : [];
    const valid = list
      .map((item) => ({
        logo: typeof item?.logo === 'string' ? item.logo.trim() : '',
        url: typeof item?.url === 'string' ? item.url.trim() : '',
      }))
      .filter((item) => item.logo && item.url);

    if (valid.length === 0) {
      state.sponsors = [];
      return;
    }

    state.sponsors = valid.slice();
    renderSponsors(valid);
    if (
      (supportsDialog && elements.detailDialog.open) ||
      (!supportsDialog && document.body.classList.contains('detail-dialog--open'))
    ) {
      showRandomSponsorInDialog();
    }
  } catch (error) {
    state.sponsors = [];
    console.warn('Nessuno sponsor disponibile', error);
  }
}

function renderSponsors(sponsors) {
  elements.sponsorList.innerHTML = '';
  const fragment = document.createDocumentFragment();
  sponsors.forEach((sponsor) => {
    const item = document.createElement('a');
    item.className = 'sponsor__item';
    item.href = sponsor.url;
    item.target = '_blank';
    item.rel = 'noopener noreferrer';
    item.role = 'listitem';
    item.innerHTML = `<img src="${sponsor.logo}" alt="Logo sponsor" loading="lazy" decoding="async" />`;
    fragment.appendChild(item);
  });
  elements.sponsorList.appendChild(fragment);
  elements.sponsorSection.hidden = false;
  elements.sponsorSection.setAttribute('aria-hidden', 'false');
}

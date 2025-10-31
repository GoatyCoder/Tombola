const state = {
  numbers: [],
  selected: null,
  currentUtterance: null,
  cellsByNumber: new Map(),
  entriesByNumber: new Map(),
  drawnNumbers: new Set(),
  drawHistory: [],
  sponsorByNumber: new Map(),
  isAnimatingDraw: false,
  historyOpen: false,
  audioEnabled: true,
  storageErrorMessage: '',
  currentSponsor: null,
  lastSponsorKey: null,
  sponsors: [],
  sponsorLoadPromise: null,
  sponsorShowcaseRendered: false,
};

const elements = {
  board: document.querySelector('#board'),
  template: document.querySelector('#board-cell-template'),
  modal: document.querySelector('#number-modal'),
  modalNumber: document.querySelector('#modal-number'),
  modalItalian: document.querySelector('#modal-italian'),
  modalDialect: document.querySelector('#modal-dialect'),
  modalImage: document.querySelector('#modal-image'),
  modalImageFrame: document.querySelector('#modal-image-frame'),
  modalClose: document.querySelector('#modal-close'),
  modalDialectPlay: document.querySelector('#modal-dialect-play'),
  modalItalianPlay: document.querySelector('#modal-italian-play'),
  modalNext: document.querySelector('#modal-next'),
  modalSponsorBlock: document.querySelector('#modal-sponsor-block'),
  modalSponsorHeading: document.querySelector('#modal-sponsor-heading'),
  modalSponsor: document.querySelector('#modal-sponsor'),
  modalSponsorLogo: document.querySelector('#modal-sponsor-logo'),
  drawButton: document.querySelector('#draw-button'),
  resetButton: document.querySelector('#reset-button'),
  drawStatus: document.querySelector('#draw-status'),
  drawOverlay: document.querySelector('#draw-portal'),
  drawOverlayNumber: document.querySelector('#draw-animation-number'),
  drawOverlayBall: document.querySelector('#draw-animation-ball'),
  drawOverlayLabel: document.querySelector('#draw-animation-label'),
  drawOverlayLoader: document.querySelector('#draw-portal-loader'),
  drawSponsorBlock: document.querySelector('#draw-sponsor-block'),
  drawSponsorHeading: document.querySelector('#draw-sponsor-heading'),
  drawSponsor: document.querySelector('#draw-sponsor'),
  drawSponsorLogo: document.querySelector('#draw-sponsor-logo'),
  sponsorShowcase: document.querySelector('#sponsor-showcase'),
  sponsorShowcaseList: document.querySelector('#sponsor-showcase-list'),
  historyList: document.querySelector('#draw-history'),
  historyEmpty: document.querySelector('#draw-history-empty'),
  historyPanel: document.querySelector('#history-panel'),
  historyToggle: document.querySelector('#history-toggle'),
  historyToggleLabel: document.querySelector('[data-history-label]'),
  historyScrim: document.querySelector('#history-scrim'),
  audioToggle: document.querySelector('#audio-toggle'),
  floatingDrawButton: document.querySelector('#floating-draw-button'),
  drawProgressValue: document.querySelector('#draw-progress-value'),
  drawProgressBar: document.querySelector('#draw-progress-bar'),
  drawProgressFill: document.querySelector('#draw-progress-bar .progress__fill'),
  drawLastNumber: document.querySelector('#draw-last-number'),
  drawLastDetail: document.querySelector('#draw-last-detail'),
};

const AUDIO_STORAGE_KEY = 'tombola-audio-enabled';
const DRAW_STATE_STORAGE_KEY = 'TOMBOLA_DRAW_STATE';
const EMPTY_DRAW_STATE = Object.freeze({ drawnNumbers: [], drawHistory: [] });
const SPONSOR_DATA_PATH = 'sponsors.json';
const TILE_IMAGE_FALLBACK = 'images/empty.jpg';
const EMBEDDED_SPONSORS = Object.freeze([
  {
    logo: 'images/sponsor-panificio-stella.svg',
    url: 'https://www.panificiostella.it/',
  },
  {
    logo: 'images/sponsor-agrumi-del-sud.svg',
    url: 'https://www.agrumidelsud.it/',
  },
  {
    logo: 'images/sponsor-cantina-nojana.svg',
    url: 'https://www.cantinanojana.it/',
  },
]);
const DRAW_TIMELINE = Object.freeze({
  intro: 520,
  prepareHold: 2860,
  revealAccent: 360,
  celebrationHold: 2280,
  flightDelay: 320,
  flightDuration: 1320,
  overlayHideDelay: 360,
  reducedMotionHold: 1900,
  reducedMotionFlight: 520,
});

const MOBILE_HISTORY_QUERY = '(max-width: 540px)';
const historyMediaMatcher =
  typeof window !== 'undefined' && 'matchMedia' in window
    ? window.matchMedia(MOBILE_HISTORY_QUERY)
    : { matches: false };

function getSponsorKey(sponsor) {
  if (!sponsor || typeof sponsor !== 'object') {
    return null;
  }

  return sponsor.url || sponsor.logo || null;
}

function normalizeSponsor(rawSponsor) {
  if (!rawSponsor || typeof rawSponsor !== 'object') {
    return null;
  }

  const logo = typeof rawSponsor.logo === 'string' ? rawSponsor.logo.trim() : '';
  const url = typeof rawSponsor.url === 'string' ? rawSponsor.url.trim() : '';

  if (!logo || !url) {
    return null;
  }

  return { logo, url };
}

function cloneSponsorData(sponsor) {
  if (!sponsor || typeof sponsor !== 'object') {
    return null;
  }

  const logo = typeof sponsor.logo === 'string' ? sponsor.logo.trim() : '';
  const url = typeof sponsor.url === 'string' ? sponsor.url.trim() : '';

  if (!logo || !url) {
    return null;
  }

  return { logo, url };
}

function getEmbeddedSponsors() {
  return EMBEDDED_SPONSORS.map(cloneSponsorData).filter(Boolean);
}

function loadSponsors() {
  if (state.sponsors.length > 0) {
    renderSponsorShowcase(state.sponsors);
    return Promise.resolve(state.sponsors);
  }

  if (state.sponsorLoadPromise) {
    return state.sponsorLoadPromise;
  }

  const request = fetch(SPONSOR_DATA_PATH)
    .then((response) => {
      if (!response.ok) {
        throw new Error('Impossibile caricare gli sponsor');
      }
      return response.json();
    })
    .then((data) => {
      const rawList = Array.isArray(data?.sponsors) ? data.sponsors : Array.isArray(data) ? data : [];
      const normalized = rawList.map(normalizeSponsor).filter(Boolean);
      const fallbackList = getEmbeddedSponsors();

      state.sponsors = normalized.length ? normalized : fallbackList;
      state.lastSponsorKey = null;
      if (!state.sponsors.length) {
        applySponsorToOverlay(null);
      }
      renderSponsorShowcase(state.sponsors, { force: true });
      return state.sponsors;
    })
    .catch((error) => {
      console.warn('Impossibile caricare gli sponsor', error);
      const fallbackList = getEmbeddedSponsors();
      state.sponsors = fallbackList;
      state.lastSponsorKey = null;
      if (state.sponsors.length === 0) {
        applySponsorToOverlay(null);
        renderSponsorShowcase([], { force: true });
      } else {
        renderSponsorShowcase(state.sponsors, { force: true });
      }
      return state.sponsors;
    })
    .finally(() => {
      state.sponsorLoadPromise = null;
    });

  state.sponsorLoadPromise = request;
  return request;
}

function pickRandomSponsor(previousKey = null) {
  const sponsors = Array.isArray(state.sponsors) ? state.sponsors : [];

  if (sponsors.length === 0) {
    return null;
  }

  if (sponsors.length === 1) {
    return sponsors[0];
  }

  const available = sponsors.filter((item) => item && getSponsorKey(item) !== previousKey);
  const pool = available.length > 0 ? available : sponsors;
  const index = Math.floor(Math.random() * pool.length);
  return pool[index] || null;
}

function getSponsorAccessibleLabel(sponsor) {
  if (!sponsor || typeof sponsor.url !== 'string' || !sponsor.url.trim()) {
    return 'Apri il sito dello sponsor';
  }

  try {
    const base = typeof window !== 'undefined' && window.location ? window.location.origin : undefined;
    const url = new URL(sponsor.url, base || 'https://example.com');
    const host = url.hostname.replace(/^www\./i, '');
    if (host) {
      return `Apri il sito di ${host}`;
    }
  } catch (error) {
    // Ignore parsing issues and fall back to a generic label
  }

  return 'Apri il sito dello sponsor';
}

function renderSponsorShowcase(sponsors, options = {}) {
  const { force = false } = options;
  const { sponsorShowcase, sponsorShowcaseList } = elements;

  if (!sponsorShowcase || !sponsorShowcaseList) {
    return;
  }

  if (!Array.isArray(sponsors) || sponsors.length === 0) {
    sponsorShowcaseList.innerHTML = '';
    sponsorShowcase.hidden = true;
    sponsorShowcase.setAttribute('aria-hidden', 'true');
    state.sponsorShowcaseRendered = false;
    return;
  }

  if (state.sponsorShowcaseRendered && !force) {
    return;
  }

  const randomized = sponsors.slice();
  for (let index = randomized.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [randomized[index], randomized[swapIndex]] = [randomized[swapIndex], randomized[index]];
  }

  sponsorShowcaseList.innerHTML = '';

  randomized.forEach((sponsor) => {
    if (!sponsor) {
      return;
    }

    const anchor = document.createElement('a');
    anchor.className = 'sponsor-strip__item';
    anchor.setAttribute('role', 'listitem');
    anchor.href = sponsor.url || '#';
    anchor.target = sponsor.url ? '_blank' : '_self';
    anchor.rel = 'noopener noreferrer';

    const label = getSponsorAccessibleLabel(sponsor);
    if (label) {
      anchor.setAttribute('aria-label', label);
      anchor.title = label;
    } else {
      anchor.removeAttribute('title');
    }

    const logo = document.createElement('img');
    logo.alt = '';
    logo.src = sponsor.logo || '';
    if ('decoding' in logo) {
      logo.decoding = 'async';
    }
    if ('loading' in logo) {
      logo.loading = 'lazy';
    }

    anchor.appendChild(logo);
    sponsorShowcaseList.appendChild(anchor);
  });

  sponsorShowcase.hidden = false;
  sponsorShowcase.removeAttribute('aria-hidden');
  state.sponsorShowcaseRendered = true;
}

function sleep(duration) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, duration);
  });
}

function waitForScrollIdle(options = {}) {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    return Promise.resolve();
  }

  const { timeout = 900, idleThreshold = 140 } = options;
  const nowFn =
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? () => performance.now()
      : () => Date.now();

  return new Promise((resolve) => {
    let lastX = window.scrollX;
    let lastY = window.scrollY;
    let lastChange = nowFn();
    const deadline = lastChange + timeout;

    const check = (timestamp) => {
      const currentTime = typeof timestamp === 'number' ? timestamp : nowFn();
      const currentX = window.scrollX;
      const currentY = window.scrollY;

      if (currentX !== lastX || currentY !== lastY) {
        lastX = currentX;
        lastY = currentY;
        lastChange = currentTime;
      }

      if (currentTime - lastChange >= idleThreshold || currentTime >= deadline) {
        resolve();
        return;
      }

      window.requestAnimationFrame(check);
    };

    window.requestAnimationFrame(check);
  });
}

function updateSponsorBlock(blockElements, sponsor, options = {}) {
  if (!blockElements) {
    return;
  }

  const { block, anchor, logo, heading } = blockElements;
  const { showPlaceholder = false, preferLazy = false } = options;
  const placeholderClass = 'sponsor-block--placeholder';

  if (!block || !anchor || !logo) {
    return;
  }

  if (!sponsor) {
    const shouldShowPlaceholder = Boolean(showPlaceholder);

    block.hidden = !shouldShowPlaceholder;
    block.setAttribute('aria-hidden', shouldShowPlaceholder ? 'false' : 'true');
    block.classList.toggle(placeholderClass, shouldShowPlaceholder);

    anchor.href = '#';
    anchor.target = '_self';
    anchor.rel = 'noopener noreferrer';
    anchor.removeAttribute('aria-label');
    anchor.setAttribute('tabindex', '-1');
    if (shouldShowPlaceholder) {
      anchor.setAttribute('aria-hidden', 'true');
    } else {
      anchor.removeAttribute('aria-hidden');
    }
    anchor.classList.toggle('sponsor-link--placeholder', shouldShowPlaceholder);

    if (heading) {
      heading.hidden = !shouldShowPlaceholder;
    }

    if ('loading' in logo) {
      logo.loading = preferLazy ? 'lazy' : 'eager';
    }
    logo.hidden = true;
    logo.removeAttribute('src');
    logo.alt = '';
    return;
  }

  block.hidden = false;
  block.setAttribute('aria-hidden', 'false');
  block.classList.remove(placeholderClass);

  anchor.classList.remove('sponsor-link--placeholder');
  anchor.removeAttribute('aria-hidden');
  anchor.href = sponsor.url || '#';
  anchor.target = sponsor.url ? '_blank' : '_self';
  anchor.rel = 'noopener noreferrer';
  anchor.removeAttribute('tabindex');
  anchor.setAttribute('aria-label', getSponsorAccessibleLabel(sponsor));
  anchor.removeAttribute('title');

  if ('loading' in logo) {
    logo.loading = preferLazy ? 'lazy' : 'eager';
  }
  logo.hidden = false;
  if (logo.src !== sponsor.logo) {
    logo.src = sponsor.logo || '';
  }
  logo.alt = '';

  if (heading) {
    heading.hidden = false;
  }
}

function applySponsorToOverlay(sponsor) {
  const { drawSponsor, drawSponsorLogo, drawSponsorBlock, drawSponsorHeading } = elements;

  updateSponsorBlock(
    {
      block: drawSponsorBlock,
      anchor: drawSponsor,
      logo: drawSponsorLogo,
      heading: drawSponsorHeading,
    },
    sponsor,
    { preferLazy: false }
  );
}

function applySponsorToModal(sponsor, options = {}) {
  const { modalSponsorBlock, modalSponsor, modalSponsorLogo, modalSponsorHeading } = elements;

  updateSponsorBlock(
    {
      block: modalSponsorBlock,
      anchor: modalSponsor,
      logo: modalSponsorLogo,
      heading: modalSponsorHeading,
    },
    sponsor,
    { preferLazy: false, ...options }
  );
}

function persistSponsorForNumber(number, sponsor) {
  if (!Number.isInteger(number)) {
    return null;
  }

  const normalized = cloneSponsorData(sponsor);
  if (!normalized) {
    return null;
  }

  state.sponsorByNumber.set(number, normalized);
  return normalized;
}

function getStoredSponsorForNumber(number) {
  if (!Number.isInteger(number)) {
    return null;
  }

  const stored = state.sponsorByNumber.get(number);
  return stored ? cloneSponsorData(stored) : null;
}

function ensureModalSponsor(entry, options = {}) {
  if (!entry) {
    applySponsorToModal(null);
    return;
  }

  const { fromDraw = false } = options;
  const number = entry.number;

  const storedSponsor = getStoredSponsorForNumber(number);
  if (storedSponsor) {
    applySponsorToModal(storedSponsor);
    return;
  }

  if (fromDraw && state.currentSponsor) {
    const remembered = persistSponsorForNumber(number, state.currentSponsor);
    applySponsorToModal(remembered);
    return;
  }

  const selectRandomSponsor = () => {
    if (!Array.isArray(state.sponsors) || state.sponsors.length === 0) {
      return null;
    }

    const previousKey = state.lastSponsorKey || (state.currentSponsor ? getSponsorKey(state.currentSponsor) : null);
    const randomSponsor = pickRandomSponsor(previousKey);
    const normalized = cloneSponsorData(randomSponsor);

    if (normalized) {
      const key = getSponsorKey(normalized);
      if (key) {
        state.lastSponsorKey = key;
      }
    }

    return normalized;
  };

  const immediateRandom = selectRandomSponsor();
  if (immediateRandom) {
    applySponsorToModal(immediateRandom);
    return;
  }

  applySponsorToModal(null);

  const pending =
    state.sponsorLoadPromise ||
    (Array.isArray(state.sponsors) && state.sponsors.length > 0
      ? Promise.resolve(state.sponsors)
      : loadSponsors());

  if (!pending || typeof pending.then !== 'function') {
    return;
  }

  pending
    .then(() => {
      const updatedStored = getStoredSponsorForNumber(number);
      if (updatedStored) {
        applySponsorToModal(updatedStored);
        return;
      }

      if (fromDraw && state.currentSponsor) {
        const remembered = persistSponsorForNumber(number, state.currentSponsor);
        if (remembered) {
          applySponsorToModal(remembered);
          return;
        }
      }

      const refreshed = selectRandomSponsor();
      if (refreshed) {
        applySponsorToModal(refreshed);
        return;
      }

      applySponsorToModal(null);
    })
    .catch(() => {
      const fallbackStored = getStoredSponsorForNumber(number);
      if (fallbackStored) {
        applySponsorToModal(fallbackStored);
        return;
      }

      if (fromDraw && state.currentSponsor) {
        const remembered = persistSponsorForNumber(number, state.currentSponsor);
        if (remembered) {
          applySponsorToModal(remembered);
          return;
        }
      }

      applySponsorToModal(null);
    });
}

function setOverlayBallLoading(isLoading) {
  const { drawOverlayBall, drawOverlay } = elements;

  if (!drawOverlayBall) {
    return;
  }

  const loadingClass = 'draw-portal__ball--loading';
  const revealClass = 'draw-portal__ball--revealed';

  if (isLoading) {
    drawOverlayBall.classList.add(loadingClass);
    drawOverlayBall.classList.remove(revealClass);
    drawOverlayBall.setAttribute('aria-busy', 'true');
    if (drawOverlay) {
      drawOverlay.classList.add('draw-portal--charging');
    }
  } else {
    drawOverlayBall.classList.remove(loadingClass);
    drawOverlayBall.removeAttribute('aria-busy');
    if (drawOverlay) {
      drawOverlay.classList.remove('draw-portal--charging');
    }
  }
}

async function prepareSponsorForNextDraw() {
  const sponsors = await loadSponsors();

  if (!Array.isArray(sponsors) || sponsors.length === 0) {
    state.currentSponsor = null;
    state.lastSponsorKey = null;
    applySponsorToOverlay(null);
    return;
  }

  const sponsor = pickRandomSponsor(state.lastSponsorKey);
  state.currentSponsor = sponsor;
  state.lastSponsorKey = getSponsorKey(sponsor);
  applySponsorToOverlay(sponsor);
}

function updateHistoryToggleText() {
  const { historyToggle, historyToggleLabel } = elements;

  if (!historyToggle || !historyToggleLabel) {
    return;
  }

  const mobileLayout = Boolean(historyMediaMatcher.matches);
  const { dataset } = historyToggle;

  let nextLabel = dataset.labelDesktop || 'Cronologia';

  if (mobileLayout) {
    nextLabel = state.historyOpen
      ? dataset.labelMobileOpen || 'Chiudi cronologia'
      : dataset.labelMobileClosed || 'Cronologia';
  }

  historyToggleLabel.textContent = nextLabel;
  historyToggle.setAttribute('aria-label', nextLabel);
  historyToggle.title = nextLabel;
}

function syncHistoryPanelToLayout(options = {}) {
  const { immediate = false } = options;
  const { historyPanel, historyToggle, historyScrim } = elements;

  if (!historyPanel) {
    state.historyOpen = false;
    updateHistoryToggleText();
    return;
  }

  const mobileLayout = Boolean(historyMediaMatcher.matches);

  if (!mobileLayout) {
    state.historyOpen = false;
    historyPanel.classList.remove('history--open');
    historyPanel.setAttribute('aria-hidden', 'false');
    if (historyToggle) {
      historyToggle.setAttribute('aria-expanded', 'false');
    }
    updateHistoryToggleText();
    if (historyScrim) {
      historyScrim.classList.remove('history-scrim--visible');
      historyScrim.hidden = true;
    }
    return;
  }

  historyPanel.setAttribute('aria-hidden', state.historyOpen ? 'false' : 'true');
  historyPanel.classList.toggle('history--open', state.historyOpen);
  if (historyToggle) {
    historyToggle.setAttribute('aria-expanded', state.historyOpen ? 'true' : 'false');
  }
  updateHistoryToggleText();

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
      window.setTimeout(finalizeHide, 520);
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
    updateHistoryToggleText();
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
  const actionLabel = enabled ? 'Disattiva annuncio audio' : 'Attiva annuncio audio';
  audioToggle.setAttribute('aria-label', actionLabel);
  audioToggle.title = actionLabel;
  audioToggle.setAttribute('data-tooltip', actionLabel);
  const srText = audioToggle.querySelector('[data-audio-label]');
  if (srText) {
    srText.textContent = enabled ? 'Audio attivo' : 'Audio disattivato';
  }
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

    state.drawnNumbers = new Set();
    state.sponsorByNumber.clear();

    const normalizedHistory = [];

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
      const sponsorData = cloneSponsorData(item.sponsor);
      normalizedHistory.push({
        number,
        italian: entry.italian || '',
        dialect: entry.dialect || '',
        sponsor: sponsorData || null,
      });
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
        normalizedHistory.push({
          number,
          italian: entry.italian || '',
          dialect: entry.dialect || '',
          sponsor: null,
        });
      });
    }

    normalizedHistory.forEach((record) => {
      const entry = numbersMap.get(record.number);
      if (!entry) {
        return;
      }

      markNumberDrawn(entry, {
        animate: false,
        sponsor: record.sponsor,
        recordHistory: false,
      });
      latestEntry = entry;
    });

    state.drawHistory = normalizedHistory;
    updateDrawHistory();

    if (normalizedHistory.length > 0) {
      persistDrawState();
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
    state.sponsorByNumber = new Map();
    state.entriesByNumber = new Map();
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
    if (elements.floatingDrawButton) {
      elements.floatingDrawButton.disabled = true;
      const floatingSr = elements.floatingDrawButton.querySelector('[data-floating-draw-sr]');
      const disabledMessage = 'Estrazione non disponibile';
      elements.floatingDrawButton.setAttribute('aria-label', disabledMessage);
      elements.floatingDrawButton.title = disabledMessage;
      elements.floatingDrawButton.setAttribute('data-tooltip', disabledMessage);
      if (floatingSr) {
        floatingSr.textContent = disabledMessage;
      }
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

  if (!(state.entriesByNumber instanceof Map)) {
    state.entriesByNumber = new Map();
  } else {
    state.entriesByNumber.clear();
  }

  const fragment = document.createDocumentFragment();

  state.numbers.forEach((entry) => {
    state.entriesByNumber.set(entry.number, entry);
    const cell = template.content.firstElementChild.cloneNode(true);
    cell.dataset.number = entry.number;

    const srOnlyLabel = cell.querySelector('[data-board-cell-sr]');
    if (srOnlyLabel) {
      const labelParts = [`Numero ${entry.number}`];
      if (typeof entry.italian === 'string' && entry.italian.trim()) {
        labelParts.push(entry.italian.trim());
      } else if (typeof entry.dialect === 'string' && entry.dialect.trim()) {
        labelParts.push(entry.dialect.trim());
      }
      srOnlyLabel.textContent = labelParts.join(' – ');
    }

    const artworkEl = cell.querySelector('.board-cell__media');
    if (artworkEl instanceof HTMLImageElement) {
      applyBoardCellImage(artworkEl, entry);
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

function getNumberImage(entry) {
  if (entry && entry.image) {
    return entry.image;
  }

  if (entry && entry.number) {
    return `images/${entry.number}.jpg`;
  }

  return TILE_IMAGE_FALLBACK;
}

function handleBoardCellImageError(event) {
  const target = event.currentTarget;
  if (!(target instanceof HTMLImageElement)) {
    return;
  }

  if (target.dataset.fallbackApplied === 'true') {
    return;
  }

  target.dataset.fallbackApplied = 'true';
  target.src = TILE_IMAGE_FALLBACK;
}

function applyBoardCellImage(imageEl, entry) {
  if (!(imageEl instanceof HTMLImageElement)) {
    return;
  }

  imageEl.dataset.fallbackApplied = 'false';
  imageEl.removeEventListener('error', handleBoardCellImageError);
  imageEl.addEventListener('error', handleBoardCellImageError);
  imageEl.src = getNumberImage(entry);
}

function getEntryByNumber(number) {
  if (!Number.isInteger(number)) {
    return null;
  }

  if (state.entriesByNumber instanceof Map && state.entriesByNumber.has(number)) {
    return state.entriesByNumber.get(number) || null;
  }

  return state.numbers.find((item) => item.number === number) || null;
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

  const { animate = false, sponsor: sponsorOverride = null, recordHistory = true } = options;
  const number = entry.number;

  if (state.drawnNumbers.has(number)) {
    return;
  }

  state.drawnNumbers.add(number);

  const sponsorData = persistSponsorForNumber(number, sponsorOverride || state.currentSponsor);

  if (recordHistory) {
    state.drawHistory.push({
      number,
      italian: entry.italian || '',
      dialect: entry.dialect || '',
      sponsor: sponsorData ? cloneSponsorData(sponsorData) : null,
    });
  }

  if (recordHistory) {
    updateDrawHistory();
    persistDrawState();
  }

  if (state.storageErrorMessage) {
    updateDrawStatus();
  }

  const cell = state.cellsByNumber.get(number);
  if (cell) {
    cell.classList.add('board-cell--drawn');
    cell.setAttribute('aria-pressed', 'true');
    if (animate) {
      cell.classList.add('board-cell--just-drawn');
      let fallbackTimeout = null;
      const finalize = () => {
        cell.classList.remove('board-cell--just-drawn');
        cell.removeEventListener('animationend', handleAnimationEnd);
        if (fallbackTimeout !== null) {
          window.clearTimeout(fallbackTimeout);
          fallbackTimeout = null;
        }
      };
      const handleAnimationEnd = (event) => {
        if (event?.animationName && event.animationName !== 'boardCellCelebrate') {
          return;
        }
        finalize();
      };
      cell.addEventListener('animationend', handleAnimationEnd);
      fallbackTimeout = window.setTimeout(finalize, 900);
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

  state.isAnimatingDraw = true;
  let restoreDrawButton = false;
  let restoreFloatingDrawButton = false;
  let markRecorded = false;
  let preparationError = null;

  try {
    await prepareSponsorForNextDraw();

    if (elements.drawButton) {
      restoreDrawButton = !elements.drawButton.disabled;
      elements.drawButton.disabled = true;
    }
    if (elements.floatingDrawButton) {
      restoreFloatingDrawButton = !elements.floatingDrawButton.disabled;
      elements.floatingDrawButton.disabled = true;
    }

    try {
      await showDrawAnimation(entry, {
        onFlightComplete: () => {
          if (!markRecorded) {
            markNumberDrawn(entry, { animate: true });
            markRecorded = true;
          }
        },
      });
    } catch (animationError) {
      console.warn('Errore durante l\'animazione di estrazione', animationError);
    }

    if (!markRecorded) {
      markNumberDrawn(entry, { animate: true });
      markRecorded = true;
    }
  } catch (error) {
    preparationError = error;
  } finally {
    state.isAnimatingDraw = false;
    if (elements.drawButton && restoreDrawButton) {
      elements.drawButton.disabled = false;
    }
    if (elements.floatingDrawButton && restoreFloatingDrawButton) {
      elements.floatingDrawButton.disabled = false;
    }
  }

  if (!markRecorded) {
    markNumberDrawn(entry, { animate: true });
    markRecorded = true;
  }

  if (preparationError) {
    console.warn('Impossibile preparare l\'estrazione', preparationError);
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
    elements.drawOverlay.classList.remove('draw-portal--visible', 'draw-portal--closing');
    elements.drawOverlay.setAttribute('hidden', '');
    elements.drawOverlay.setAttribute('aria-hidden', 'true');
  }
  if (elements.drawOverlayBall) {
    elements.drawOverlayBall.classList.remove(
      'draw-portal__ball--loading',
      'draw-portal__ball--revealed'
    );
    elements.drawOverlayBall.removeAttribute('aria-busy');
  }
  if (elements.drawOverlayNumber) {
    elements.drawOverlayNumber.textContent = '';
  }
  if (elements.drawOverlayLabel) {
    elements.drawOverlayLabel.textContent = 'Estrazione in corso...';
  }

  state.isAnimatingDraw = false;

  state.currentSponsor = null;
  state.lastSponsorKey = null;
  applySponsorToOverlay(null);

  if (state.currentUtterance && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  state.currentUtterance = null;

  state.drawnNumbers.clear();
  state.drawHistory = [];
  state.sponsorByNumber.clear();
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

  const paddedNumber = String(entry.number).padStart(2, '0');
  elements.modalNumber.textContent = `Numero ${paddedNumber}`;

  const italianText = entry.italian || '—';
  const dialectText = entry.dialect || 'Da completare';

  elements.modalItalian.textContent = italianText;
  elements.modalItalian.classList.toggle('number-dialog__text--missing', !entry.italian);

  elements.modalDialect.textContent = dialectText;
  elements.modalDialect.classList.toggle('number-dialog__text--missing', !entry.dialect);

  if (elements.modalItalianPlay) {
    const hasItalian = Boolean(entry.italian);
    elements.modalItalianPlay.disabled = !hasItalian;
    if (hasItalian) {
      elements.modalItalianPlay.removeAttribute('aria-disabled');
    } else {
      elements.modalItalianPlay.setAttribute('aria-disabled', 'true');
    }
  }

  if (elements.modalDialectPlay) {
    const hasDialect = Boolean(entry.dialect);
    elements.modalDialectPlay.disabled = !hasDialect;
    if (hasDialect) {
      elements.modalDialectPlay.removeAttribute('aria-disabled');
    } else {
      elements.modalDialectPlay.setAttribute('aria-disabled', 'true');
    }
  }

  const hasImage = Boolean(entry.image);
  if (elements.modalImage) {
    applyBoardCellImage(elements.modalImage, entry);
    elements.modalImage.alt = hasImage
      ? entry.italian
        ? `Illustrazione del numero ${entry.number}: ${entry.italian}`
        : `Illustrazione del numero ${entry.number}`
      : `Segnaposto per il numero ${entry.number}`;
  }

  if (elements.modalImageFrame) {
    elements.modalImageFrame.classList.toggle(
      'number-dialog__image-frame--placeholder',
      !hasImage
    );
  }

  ensureModalSponsor(entry, { fromDraw });

  elements.modal.removeAttribute('hidden');
  elements.modal.classList.add('modal--visible');
  document.body.classList.add('modal-open');

  let focusTarget = elements.modalClose;

  if (elements.modalNext) {
    const total = state.numbers.length;
    const drawnCount = state.drawnNumbers.size;
    const remaining = Math.max(total - drawnCount, 0);
    const shouldShow = (fromDraw || state.isAnimatingDraw) && remaining > 0;

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
  applySponsorToModal(null);
  if (elements.modalImageFrame) {
    elements.modalImageFrame.classList.remove('number-dialog__image-frame--placeholder');
  }
  if (returnFocus && state.selected) {
    state.selected.focus();
  }
}

async function animateBallFlight(entry, fromRect, targetCell, options = {}) {
  if (!targetCell || !fromRect) {
    return;
  }

  const { prefersReducedMotion = false, duration = DRAW_TIMELINE.flightDuration } = options;

  targetCell.classList.add('board-cell--incoming');

  const finalize = () => {
    targetCell.classList.remove('board-cell--incoming');
  };

  try {
    targetCell.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'center',
      inline: 'center',
    });
  } catch (error) {
    targetCell.scrollIntoView();
  }

  await waitForScrollIdle({
    timeout: prefersReducedMotion ? 320 : 900,
    idleThreshold: prefersReducedMotion ? 80 : 160,
  });

  if (prefersReducedMotion) {
    await sleep(220);
    finalize();
    return;
  }

  const flightBall = document.createElement('div');
  flightBall.className = 'draw-flight-ball';
  flightBall.setAttribute('aria-hidden', 'true');
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
    await sleep(duration);
    flightBall.remove();
    finalize();
    return;
  }

  const targetRect = targetCell.getBoundingClientRect();
  const endX = targetRect.left + targetRect.width / 2;
  const endY = targetRect.top + targetRect.height / 2;
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const scale = Math.max(Math.min(targetRect.width / fromRect.width || 1, 1.35), 0.6);

  await new Promise((resolve) => {
    const cleanup = () => {
      flightBall.remove();
      finalize();
      resolve();
    };

    try {
      const animation = flightBall.animate(
        [
          { transform: 'translate(-50%, -50%) scale(0.98)', opacity: 0.98 },
          {
            transform: `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px)) scale(${scale})`,
            opacity: 0.94,
          },
        ],
        {
          duration,
          easing: 'cubic-bezier(0.18, 0.82, 0.24, 1.06)',
          fill: 'forwards',
        }
      );

      animation.addEventListener('finish', cleanup, { once: true });
      animation.addEventListener('cancel', cleanup, { once: true });
    } catch (error) {
      cleanup();
    }
  });
}

async function showDrawAnimation(entry, options = {}) {
  const { drawOverlay, drawOverlayNumber, drawOverlayBall, drawOverlayLabel } = elements;
  const targetCell = state.cellsByNumber.get(entry.number);
  const { onFlightComplete = null } = options;

  let flightNotified = false;
  const notifyFlightComplete = () => {
    if (flightNotified) {
      return;
    }
    flightNotified = true;
    if (typeof onFlightComplete === 'function') {
      try {
        onFlightComplete();
      } catch (error) {
        console.warn('Errore durante l\'aggiornamento della casella estratta', error);
      }
    }
  };

  if (!drawOverlay || !drawOverlayNumber || !drawOverlayBall) {
    if (targetCell) {
      try {
        targetCell.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      } catch (error) {
        targetCell.scrollIntoView();
      }
    }
    return;
  }

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const setCaption = (text) => {
    if (drawOverlayLabel) {
      drawOverlayLabel.textContent = text;
    }
  };

  const revealNumber = () => {
    setOverlayBallLoading(false);
    drawOverlayNumber.textContent = entry.number;
    drawOverlayBall.classList.add('draw-portal__ball--revealed');
    setCaption('Estratto il numero');
  };

  const hideOverlay = (immediate = false) => {
    drawOverlay.classList.remove('draw-portal--visible');
    drawOverlay.classList.remove('draw-portal--closing');
    const finalize = () => {
      drawOverlay.setAttribute('aria-hidden', 'true');
      drawOverlay.hidden = true;
    };
    if (immediate) {
      finalize();
    } else {
      window.setTimeout(finalize, 20);
    }
  };

  setOverlayBallLoading(true);
  drawOverlayBall.classList.remove('draw-portal__ball--revealed');
  drawOverlayNumber.textContent = '';
  setCaption('Estrazione in corso...');

  drawOverlay.hidden = false;
  drawOverlay.setAttribute('aria-hidden', 'false');
  drawOverlay.classList.remove('draw-portal--closing');
  drawOverlay.classList.add('draw-portal--visible');

  try {
    if (prefersReducedMotion) {
      setCaption('Estrazione in corso...');
      const fromRect = drawOverlayBall.getBoundingClientRect();
      await sleep(DRAW_TIMELINE.reducedMotionHold);
      revealNumber();

      if (targetCell) {
        await animateBallFlight(entry, fromRect, targetCell, {
          prefersReducedMotion: true,
          duration: DRAW_TIMELINE.reducedMotionFlight,
        });
      } else {
        await sleep(DRAW_TIMELINE.reducedMotionFlight);
      }

      notifyFlightComplete();

      drawOverlay.classList.add('draw-portal--closing');
      await sleep(DRAW_TIMELINE.overlayHideDelay);
      return;
    }

    await sleep(DRAW_TIMELINE.intro);
    setCaption('Estrazione in corso...');

    await sleep(DRAW_TIMELINE.prepareHold);
    await sleep(DRAW_TIMELINE.revealAccent);
    revealNumber();

    await sleep(DRAW_TIMELINE.celebrationHold);

    const fromRect = drawOverlayBall.getBoundingClientRect();
    drawOverlay.classList.add('draw-portal--closing');
    setCaption('Estratto il numero');

    await sleep(DRAW_TIMELINE.flightDelay);
    if (targetCell) {
      await animateBallFlight(entry, fromRect, targetCell, {
        duration: DRAW_TIMELINE.flightDuration,
        prefersReducedMotion,
      });
    } else {
      await sleep(DRAW_TIMELINE.flightDuration);
    }

    notifyFlightComplete();

    await sleep(DRAW_TIMELINE.overlayHideDelay);
  } finally {
    setOverlayBallLoading(false);
    hideOverlay(true);
    drawOverlayBall.classList.remove('draw-portal__ball--revealed');
    drawOverlayNumber.textContent = '';
    setCaption('Estrazione in corso...');
  }
}

function speakText(text, options = {}) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return;
  }

  const content = typeof text === 'string' ? text.trim() : '';

  if (!content) {
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

  const { lang = 'it-IT', rate = 0.92, pitch = 1.0, prefix = '' } = options;
  const prefixText = typeof prefix === 'string' ? prefix.trim() : '';
  const utterance = new SpeechSynthesisUtterance(
    prefixText ? `${prefixText} ${content}` : content
  );
  utterance.lang = lang;
  utterance.rate = rate;
  utterance.pitch = pitch;

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

function speakEntry(entry) {
  if (!entry) {
    return;
  }

  const segments = [];
  segments.push(`Numero ${entry.number}`);

  if (entry.dialect) {
    segments.push(entry.dialect);
  }

  if (entry.italian) {
    segments.push(entry.italian);
  }

  const announcement = segments
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => segment.replace(/[.!?]\s*$/, ''))
    .join('. ');

  speakText(announcement, { lang: 'it-IT', rate: 0.92 });
}

function speakDialectText(entry) {
  if (!entry || !entry.dialect) {
    return;
  }

  speakText(entry.dialect, {
    lang: 'it-IT',
    rate: 0.92,
  });
}

function speakItalianText(entry) {
  if (!entry || !entry.italian) {
    return;
  }

  speakText(entry.italian, {
    lang: 'it-IT',
    rate: 0.96,
  });
}

function updateDrawStatus(latestEntry) {
  const {
    drawStatus,
    drawProgressValue,
    drawProgressBar,
    drawProgressFill,
    drawLastNumber,
    drawLastDetail,
    drawButton,
    resetButton,
  } = elements;

  const total = state.numbers.length;
  const drawnCount = state.drawnNumbers.size;

  let normalizedEntry = null;

  if (latestEntry && typeof latestEntry.number === 'number') {
    normalizedEntry = latestEntry;
  } else if (state.drawHistory.length > 0) {
    const lastHistory = state.drawHistory[state.drawHistory.length - 1];
    if (lastHistory && typeof lastHistory.number === 'number') {
      const reference =
        state.entriesByNumber instanceof Map
          ? state.entriesByNumber.get(lastHistory.number)
          : null;
      normalizedEntry = {
        number: lastHistory.number,
        italian: lastHistory.italian || reference?.italian || '',
        dialect: lastHistory.dialect || reference?.dialect || '',
      };
    }
  }

  if (drawProgressValue) {
    if (total > 0) {
      drawProgressValue.textContent = `${drawnCount}/${total}`;
    } else {
      drawProgressValue.textContent = '0/0';
    }
  }

  if (drawProgressBar) {
    const ratio = total > 0 ? drawnCount / total : 0;
    const clampedRatio = Math.min(1, Math.max(0, ratio));
    const percentage = Math.round(clampedRatio * 100);
    drawProgressBar.setAttribute('aria-valuemax', `${total}`);
    drawProgressBar.setAttribute('aria-valuenow', `${drawnCount}`);
    drawProgressBar.setAttribute(
      'aria-valuetext',
      total > 0 ? `${drawnCount} su ${total}` : '0 su 0'
    );
    if (drawProgressFill) {
      drawProgressFill.style.width = `${percentage}%`;
    }
  }

  if (drawLastNumber) {
    drawLastNumber.textContent = normalizedEntry
      ? `${normalizedEntry.number}`
      : '—';
  }

  if (drawLastDetail) {
    let detailText = '';
    if (state.storageErrorMessage) {
      detailText = 'Verifica la connessione e riprova.';
    } else if (total === 0) {
      detailText = 'Caricamento del tabellone in corso';
    } else if (normalizedEntry) {
      detailText =
        normalizedEntry.dialect ||
        normalizedEntry.italian ||
        'Nessuna descrizione disponibile';
    } else if (drawnCount === 0) {
      detailText = 'In attesa della prima estrazione';
    } else if (drawnCount === total) {
      detailText = 'Tutti i numeri sono stati estratti';
    } else {
      detailText = 'Prosegui con le estrazioni';
    }
    drawLastDetail.textContent = detailText;
  }

  let message = state.storageErrorMessage || 'Caricamento del tabellone…';

  if (!state.storageErrorMessage && total > 0) {
    if (normalizedEntry) {
      const detail = normalizedEntry.italian || normalizedEntry.dialect || '';
      message = `Estratto il numero ${normalizedEntry.number}`;
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

  if (drawStatus) {
    drawStatus.textContent = message;
  }

  const noNumbersLoaded = total === 0;
  const finished = drawnCount === total && total > 0;

  if (drawButton) {
    drawButton.disabled = noNumbersLoaded || finished;

    if (noNumbersLoaded) {
      drawButton.textContent = 'Estrai numero';
    } else if (finished) {
      drawButton.textContent = 'Fine estrazioni';
    } else if (drawnCount === 0) {
      drawButton.textContent = 'Estrai primo numero';
    } else {
      drawButton.textContent = 'Estrai successivo';
    }
  }

  if (elements.floatingDrawButton) {
    const floatingButton = elements.floatingDrawButton;
    const floatingSr = floatingButton.querySelector('[data-floating-draw-sr]');
    floatingButton.disabled = noNumbersLoaded || finished;

    let srMessage = 'Estrai numero';

    if (noNumbersLoaded) {
      srMessage = 'Caricamento del tabellone in corso';
    } else if (finished) {
      srMessage = 'Tutte le estrazioni sono completate';
    } else if (drawnCount === 0) {
      srMessage = 'Estrai il primo numero';
    } else {
      srMessage = 'Estrai il prossimo numero';
    }

    floatingButton.setAttribute('aria-label', srMessage);
    floatingButton.title = srMessage;
    floatingButton.setAttribute('data-tooltip', srMessage);
    if (floatingSr) {
      floatingSr.textContent = srMessage;
    }
  }

  if (resetButton) {
    resetButton.disabled = drawnCount === 0;
  }
}

function setupEventListeners() {
  elements.modalClose.addEventListener('click', closeModal);
  if (elements.modalDialectPlay) {
    elements.modalDialectPlay.addEventListener('click', () => {
      if (!state.selected) {
        return;
      }

      const number = Number(state.selected.dataset.number);
      const entry = getEntryByNumber(number);
      if (entry) {
        speakDialectText(entry);
      }
    });
  }

  if (elements.modalItalianPlay) {
    elements.modalItalianPlay.addEventListener('click', () => {
      if (!state.selected) {
        return;
      }

      const number = Number(state.selected.dataset.number);
      const entry = getEntryByNumber(number);
      if (entry) {
        speakItalianText(entry);
      }
    });
  }

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

  if (elements.floatingDrawButton) {
    elements.floatingDrawButton.addEventListener('click', handleDraw);
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
  loadSponsors();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

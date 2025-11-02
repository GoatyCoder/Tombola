const LoadingStates = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error',
});

const TombolaEvents = Object.freeze({
  NUMBER_DRAWN: 'tombola:numberDrawn',
  GAME_RESET: 'tombola:gameReset',
  SPONSOR_LOADED: 'tombola:sponsorLoaded',
  SPONSOR_SELECTED: 'tombola:sponsorSelected',
  SPONSOR_ASSIGNED: 'tombola:sponsorAssigned',
});

const state = {
  numbers: [],
  selected: null,
  currentUtterance: null,
  cellsByNumber: new Map(),
  entriesByNumber: new Map(),
  drawnNumbers: new Set(),
  drawHistory: [],
  isAnimatingDraw: false,
  historyOpen: false,
  audioEnabled: true,
  storageErrorMessage: '',
  sponsorShowcaseRendered: false,
  resetDialogOpen: false,
  resetDialogTrigger: null,
  cleanupTasks: new Set(),
  dataLoadingState: LoadingStates.IDLE,
  sponsorLoadingState: LoadingStates.IDLE,
  activeFocusTrapCleanup: null,
  activeFocusTrapElement: null,
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
  modalNextLabel: document.querySelector('[data-modal-next-label]'),
  modalSponsorBlock: document.querySelector('#modal-sponsor-block'),
  modalSponsorHeading: document.querySelector('#modal-sponsor-heading'),
  modalSponsor: document.querySelector('#modal-sponsor'),
  modalSponsorLogo: document.querySelector('#modal-sponsor-logo'),
  drawButton: document.querySelector('#draw-button'),
  drawButtonLabel: document.querySelector('[data-draw-label]'),
  resetButton: document.querySelector('#reset-button'),
  resetDialog: document.querySelector('#reset-dialog'),
  resetDialogConfirm: document.querySelector('[data-reset-confirm]'),
  resetDialogCancelButtons: Array.from(
    document.querySelectorAll('[data-reset-cancel]')
  ),
  drawStatus: document.querySelector('#draw-status'),
  drawOverlay: document.querySelector('#draw-portal'),
  drawOverlayNumber: document.querySelector('#draw-animation-number'),
  drawOverlayBall: document.querySelector('#draw-animation-ball'),
  drawOverlayAnnouncement: document.querySelector('#draw-animation-announcement'),
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
  intro: 280,
  prepareHold: 1480,
  revealAccent: 320,
  celebrationHold: 1180,
  flightDelay: 240,
  flightDuration: 920,
  overlayHideDelay: 280,
  reducedMotionHold: 980,
  reducedMotionFlight: 420,
  modalRevealDelay: 520,
});

const MOBILE_HISTORY_QUERY = 'screen and (max-width: 56.24rem)';
const historyMediaMatcher =
  typeof window !== 'undefined' && 'matchMedia' in window
    ? window.matchMedia(MOBILE_HISTORY_QUERY)
    : { matches: false };

function sanitizeUrl(url) {
  if (typeof url !== 'string') {
    return '#';
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return '#';
  }

  const isRelative = !/^([a-z][a-z0-9+.-]*:)?\/\//i.test(trimmed);

  try {
    const base =
      typeof window !== 'undefined' && window.location
        ? window.location.origin
        : 'https://example.com';
    const parsed = new URL(trimmed, base);

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '#';
    }

    if (isRelative) {
      return trimmed;
    }

    return parsed.href;
  } catch (error) {
    return '#';
  }
}

function dispatchTombolaEvent(name, detail = {}) {
  if (!name || typeof name !== 'string') {
    return;
  }

  if (
    typeof window === 'undefined' ||
    typeof window.dispatchEvent !== 'function' ||
    typeof CustomEvent !== 'function'
  ) {
    return;
  }

  try {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch (error) {
    console.warn('Impossibile inviare evento personalizzato', error);
  }
}

function isValidLoadingState(value) {
  return Object.values(LoadingStates).includes(value);
}

function setDataLoadingState(nextState) {
  if (!isValidLoadingState(nextState) || state.dataLoadingState === nextState) {
    return;
  }

  state.dataLoadingState = nextState;
  updateLoadingUI();
  updateDrawStatus();
}

function setSponsorLoadingState(nextState) {
  if (!isValidLoadingState(nextState) || state.sponsorLoadingState === nextState) {
    return;
  }

  state.sponsorLoadingState = nextState;
  updateLoadingUI();
}

function registerCleanup(callback) {
  if (typeof callback !== 'function') {
    return;
  }

  state.cleanupTasks.add(callback);
}

function releaseActiveFocusTrap(targetElement) {
  if (
    typeof state.activeFocusTrapCleanup !== 'function' ||
    (targetElement && state.activeFocusTrapElement && targetElement !== state.activeFocusTrapElement)
  ) {
    return;
  }

  try {
    state.activeFocusTrapCleanup();
  } catch (error) {
    console.warn('Errore durante il ripristino del focus trap', error);
  } finally {
    state.activeFocusTrapCleanup = null;
    state.activeFocusTrapElement = null;
  }
}

function getFocusableElements(container) {
  if (!(container instanceof HTMLElement)) {
    return [];
  }

  const selectors = [
    'a[href]',
    'area[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'iframe',
    'object',
    'embed',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable=""]',
    '[contenteditable="true"]',
  ];

  return Array.from(container.querySelectorAll(selectors.join(','))).filter((element) => {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    const isDisabled = element.hasAttribute('disabled');
    if (isDisabled) {
      return false;
    }

    const tabIndex = element.getAttribute('tabindex');
    if (tabIndex !== null && Number.parseInt(tabIndex, 10) < 0) {
      return false;
    }

    const rects = element.getClientRects();
    return rects.length > 0 || element === container;
  });
}

function isolateModalBackground(modalElement) {
  if (!(modalElement instanceof HTMLElement) || typeof document === 'undefined') {
    return () => {};
  }

  const siblings = Array.from(document.body.children).filter(
    (element) => element instanceof HTMLElement && element !== modalElement && !modalElement.contains(element)
  );

  const previousStates = siblings.map((element) => {
    const supportsInert = 'inert' in element;
    const previousInert = supportsInert ? element.inert : element.hasAttribute('inert');
    const hadInertAttribute = element.hasAttribute('inert');
    const previousAriaHidden = element.getAttribute('aria-hidden');

    if (supportsInert) {
      element.inert = true;
      if (!hadInertAttribute) {
        element.setAttribute('data-modal-added-inert', '');
      }
    } else {
      element.setAttribute('aria-hidden', 'true');
      element.setAttribute('data-modal-hidden', '');
      if (!hadInertAttribute) {
        element.setAttribute('inert', '');
      }
    }

    return {
      element,
      supportsInert,
      previousInert,
      hadInertAttribute,
      previousAriaHidden,
    };
  });

  return () => {
    previousStates.forEach(({
      element,
      supportsInert,
      previousInert,
      hadInertAttribute,
      previousAriaHidden,
    }) => {
      if (supportsInert) {
        element.inert = Boolean(previousInert);
        if (!previousInert && element.hasAttribute('data-modal-added-inert')) {
          element.removeAttribute('data-modal-added-inert');
          element.removeAttribute('inert');
        }
      } else {
        if (!hadInertAttribute) {
          element.removeAttribute('inert');
        }
        if (element.hasAttribute('data-modal-hidden')) {
          element.removeAttribute('data-modal-hidden');
          if (previousAriaHidden === null) {
            element.removeAttribute('aria-hidden');
          } else {
            element.setAttribute('aria-hidden', previousAriaHidden);
          }
        }
      }
    });
  };
}

function activateModalFocusTrap(modalElement) {
  if (!(modalElement instanceof HTMLElement)) {
    return null;
  }

  releaseActiveFocusTrap();

  const backgroundCleanup = isolateModalBackground(modalElement);

  const enforceFocus = (event) => {
    if (!modalElement.contains(event.target)) {
      const focusable = getFocusableElements(modalElement);
      const fallback = focusable[0] || modalElement;
      event.stopPropagation();
      if (typeof fallback.focus === 'function') {
        fallback.focus();
      }
    }
  };

  const handleKeydown = (event) => {
    if (event.key !== 'Tab') {
      return;
    }

    const focusable = getFocusableElements(modalElement);

    if (focusable.length === 0) {
      modalElement.setAttribute('tabindex', '-1');
      modalElement.focus();
      event.preventDefault();
      return;
    }

    const firstElement = focusable[0];
    const lastElement = focusable[focusable.length - 1];
    const activeElement = document.activeElement;

    if (event.shiftKey) {
      if (!modalElement.contains(activeElement) || activeElement === firstElement) {
        lastElement.focus();
        event.preventDefault();
      }
      return;
    }

    if (!modalElement.contains(activeElement) || activeElement === lastElement) {
      firstElement.focus();
      event.preventDefault();
    }
  };

  document.addEventListener('focus', enforceFocus, true);
  modalElement.addEventListener('keydown', handleKeydown);

  const cleanup = () => {
    modalElement.removeEventListener('keydown', handleKeydown);
    document.removeEventListener('focus', enforceFocus, true);
    backgroundCleanup();
  };

  state.activeFocusTrapCleanup = cleanup;
  state.activeFocusTrapElement = modalElement;

  return cleanup;
}

function runCleanupTasks() {
  if (!(state.cleanupTasks instanceof Set) || state.cleanupTasks.size === 0) {
    return;
  }

  Array.from(state.cleanupTasks).forEach((cleanup) => {
    try {
      cleanup();
    } catch (error) {
      console.warn('Errore durante la pulizia delle risorse', error);
    } finally {
      state.cleanupTasks.delete(cleanup);
    }
  });
}

function updateLoadingUI() {
  const isDataLoading = state.dataLoadingState === LoadingStates.LOADING;
  const isDataError = state.dataLoadingState === LoadingStates.ERROR;
  const isSponsorLoading = state.sponsorLoadingState === LoadingStates.LOADING;
  const isSponsorError = state.sponsorLoadingState === LoadingStates.ERROR;

  if (elements.board) {
    elements.board.classList.toggle('board-grid--loading', isDataLoading);
    if (isDataLoading) {
      elements.board.setAttribute('aria-busy', 'true');
    } else {
      elements.board.removeAttribute('aria-busy');
    }
  }

  const sponsorBlocks = [elements.drawSponsorBlock, elements.modalSponsorBlock];
  sponsorBlocks.forEach((block) => {
    if (!block) {
      return;
    }

    if (!block.dataset.placeholderLabel) {
      block.dataset.placeholderLabel = 'Sponsor in arrivo…';
    }
    if (!block.dataset.errorLabel) {
      block.dataset.errorLabel = 'Nessuno sponsor disponibile';
    }

    if (isSponsorLoading) {
      block.setAttribute('aria-busy', 'true');
    } else {
      block.removeAttribute('aria-busy');
    }

    block.classList.toggle('sponsor-block--loading', isSponsorLoading);
    block.classList.toggle('sponsor-block--error', isSponsorError && !isSponsorLoading);
  });

  const sponsorHeadings = [elements.drawSponsorHeading, elements.modalSponsorHeading];
  sponsorHeadings.forEach((heading) => {
    if (!heading) {
      return;
    }

    if (!heading.dataset.initialText) {
      heading.dataset.initialText = heading.textContent || '';
    }

    let nextText = heading.dataset.initialText;
    if (isSponsorLoading) {
      nextText = 'Caricamento sponsor…';
    } else if (isSponsorError) {
      nextText = 'Sponsor non disponibile';
    }

    heading.textContent = nextText;
  });

  if (elements.drawStatus && isDataError) {
    elements.drawStatus.setAttribute('role', 'alert');
  } else if (elements.drawStatus) {
    elements.drawStatus.removeAttribute('role');
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', runCleanupTasks);
  window.addEventListener('beforeunload', runCleanupTasks);
}

registerCleanup(() => releaseActiveFocusTrap());

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

class SponsorManager {
  constructor(options = {}) {
    const {
      dataPath = SPONSOR_DATA_PATH,
      getFallbackSponsors,
      onSponsorsChanged,
    } = options;

    this.dataPath = dataPath;
    this.fallbackProvider =
      typeof getFallbackSponsors === 'function' ? getFallbackSponsors : () => [];
    this.onSponsorsChanged =
      typeof onSponsorsChanged === 'function' ? onSponsorsChanged : null;

    this.assignments = new Map();
    this.sponsors = [];
    this.loadPromise = null;
    this.preparationPromise = null;
    this.currentSponsor = null;
    this.lastSponsorKey = null;
  }

  _cloneList(list) {
    if (!Array.isArray(list)) {
      return [];
    }

    return list.map((item) => cloneSponsorData(item)).filter(Boolean);
  }

  _normalizeList(list) {
    if (!Array.isArray(list)) {
      return [];
    }

    return list.map(normalizeSponsor).filter(Boolean);
  }

  _notifySponsorsChanged(origin = 'unknown') {
    const snapshot = this.getAllSponsors();
    if (this.onSponsorsChanged) {
      this.onSponsorsChanged(snapshot);
    }

    dispatchTombolaEvent(TombolaEvents.SPONSOR_LOADED, {
      sponsors: snapshot,
      origin,
    });
  }

  _rememberLastKeyFromSponsor(value) {
    if (!value) {
      this.lastSponsorKey = null;
      return;
    }

    if (typeof value === 'string') {
      this.lastSponsorKey = value || null;
      return;
    }

    this.lastSponsorKey = getSponsorKey(value) || null;
  }

  _getFallbackList() {
    try {
      const fallback = this.fallbackProvider();
      return this._cloneList(fallback);
    } catch (error) {
      console.warn('Impossibile ottenere gli sponsor di fallback', error);
      return [];
    }
  }

  hasSponsors() {
    return Array.isArray(this.sponsors) && this.sponsors.length > 0;
  }

  getAllSponsors() {
    return this._cloneList(this.sponsors);
  }

  getLastKey() {
    return this.lastSponsorKey;
  }

  rememberSponsorKey(sponsor) {
    this._rememberLastKeyFromSponsor(sponsor);
  }

  getPendingLoad() {
    return this.loadPromise;
  }

  resetAssignments() {
    this.assignments.clear();
  }

  hasAssignment(number) {
    return Number.isInteger(number) && this.assignments.has(number);
  }

  getAssignment(number, options = {}) {
    if (!Number.isInteger(number)) {
      return null;
    }

    const stored = this.assignments.get(number);
    if (!stored) {
      return null;
    }

    return options.raw ? stored : cloneSponsorData(stored);
  }

  assignToNumber(number, sponsor) {
    if (!Number.isInteger(number)) {
      return null;
    }

    const normalized = cloneSponsorData(sponsor);
    if (!normalized) {
      return null;
    }

    this.assignments.set(number, normalized);
    const cloned = cloneSponsorData(normalized);
    dispatchTombolaEvent(TombolaEvents.SPONSOR_ASSIGNED, {
      number,
      sponsor: cloned,
    });
    return cloned;
  }

  restoreAssignment(number, sponsor) {
    if (!Number.isInteger(number)) {
      return;
    }

    if (sponsor) {
      const normalized = cloneSponsorData(sponsor);
      if (normalized) {
        this.assignments.set(number, normalized);
        dispatchTombolaEvent(TombolaEvents.SPONSOR_ASSIGNED, {
          number,
          sponsor: cloneSponsorData(normalized),
        });
        return;
      }
    }

    this.assignments.delete(number);
    dispatchTombolaEvent(TombolaEvents.SPONSOR_ASSIGNED, {
      number,
      sponsor: null,
    });
  }

  clearCurrentSponsor() {
    this.currentSponsor = null;
    this._rememberLastKeyFromSponsor(null);
  }

  getCurrentSponsor(options = {}) {
    if (!this.currentSponsor) {
      return null;
    }

    return options.raw ? this.currentSponsor : cloneSponsorData(this.currentSponsor);
  }

  setCurrentSponsor(sponsor) {
    const normalized = cloneSponsorData(sponsor);
    this.currentSponsor = normalized || null;
    this._rememberLastKeyFromSponsor(this.currentSponsor);
    const snapshot = this.getCurrentSponsor();
    dispatchTombolaEvent(TombolaEvents.SPONSOR_SELECTED, {
      sponsor: snapshot,
    });
    return snapshot;
  }

  async load() {
    if (this.hasSponsors()) {
      return Promise.resolve(this.getAllSponsors());
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    const task = (async () => {
      try {
        const response = await fetch(this.dataPath);
        if (!response.ok) {
          throw new Error('Impossibile caricare gli sponsor');
        }

        const data = await response.json();
        const rawList = Array.isArray(data?.sponsors)
          ? data.sponsors
          : Array.isArray(data)
            ? data
            : [];
        const normalized = this._normalizeList(rawList);

        if (normalized.length > 0) {
          this.sponsors = this._cloneList(normalized);
          this._rememberLastKeyFromSponsor(null);
          this._notifySponsorsChanged('remote');
          return this.getAllSponsors();
        }
      } catch (error) {
        console.warn('Impossibile caricare gli sponsor', error);
      }

      this.sponsors = this._getFallbackList();
      this._rememberLastKeyFromSponsor(null);
      this._notifySponsorsChanged('fallback');
      return this.getAllSponsors();
    })();

    this.loadPromise = task.finally(() => {
      this.loadPromise = null;
    });

    return this.loadPromise;
  }

  pickRandom(excludeKey = null) {
    if (!this.hasSponsors()) {
      return null;
    }

    const pool = this.sponsors.filter((sponsor) => {
      if (!excludeKey) {
        return true;
      }

      const key = getSponsorKey(sponsor);
      return key !== excludeKey;
    });

    const candidates = pool.length > 0 ? pool : this.sponsors;
    const index = Math.floor(Math.random() * candidates.length);
    const sponsor = candidates[index] || null;
    return sponsor ? cloneSponsorData(sponsor) : null;
  }

  async prepareNext() {
    if (this.preparationPromise) {
      return this.preparationPromise;
    }

    const preparation = this.load()
      .then((sponsors) => {
        if (!Array.isArray(sponsors) || sponsors.length === 0) {
          this.clearCurrentSponsor();
          return null;
        }

        const next = this.pickRandom(this.lastSponsorKey);
        return this.setCurrentSponsor(next);
      })
      .catch((error) => {
        console.warn('Impossibile preparare il prossimo sponsor', error);
        this.clearCurrentSponsor();
        return null;
      })
      .finally(() => {
        this.preparationPromise = null;
      });

    this.preparationPromise = preparation;
    return preparation;
  }
}

const sponsorManager = new SponsorManager({
  dataPath: SPONSOR_DATA_PATH,
  getFallbackSponsors: getEmbeddedSponsors,
  onSponsorsChanged: (sponsors) => {
    renderSponsorShowcase(sponsors, { force: true });
  },
});

/**
 * Gestisce le animazioni del portale di estrazione, rispettando le preferenze
 * di movimento dell'utente e fornendo un punto centrale per eventuali cleanup.
 */
class AnimationManager {
  constructor(options = {}) {
    const { elements: uiElements, timeline = DRAW_TIMELINE } = options;

    this.elements = uiElements || {};
    this.timeline = { ...timeline };
    this.prefersReducedMotion = false;
    this.motionMatcher = null;
    this.motionChangeHandler = null;
    this.cleanupCallbacks = new Set();

    this.initializeMotionPreferences();
  }

  initializeMotionPreferences() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const matcher = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.motionMatcher = matcher;
    this.prefersReducedMotion = Boolean(matcher.matches);

    const handleChange = (event) => {
      if (event && typeof event.matches === 'boolean') {
        this.prefersReducedMotion = event.matches;
      } else if (this.motionMatcher) {
        this.prefersReducedMotion = Boolean(this.motionMatcher.matches);
      }
    };

    this.motionChangeHandler = handleChange;

    if (typeof matcher.addEventListener === 'function') {
      matcher.addEventListener('change', handleChange);
      this.cleanupCallbacks.add(() => matcher.removeEventListener('change', handleChange));
    } else if (typeof matcher.addListener === 'function') {
      matcher.addListener(handleChange);
      this.cleanupCallbacks.add(() => {
        if (typeof matcher.removeListener === 'function') {
          matcher.removeListener(handleChange);
        }
      });
    }
  }

  prefersReducedMotionEnabled() {
    if (typeof this.prefersReducedMotion === 'boolean') {
      return this.prefersReducedMotion;
    }

    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }

    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (error) {
      return false;
    }
  }

  setOverlayBallLoading(isLoading) {
    const { drawOverlayBall, drawOverlay } = this.elements;

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

  async animateBallFlight(entry, fromRect, targetCell, options = {}) {
    if (!targetCell || !fromRect) {
      return;
    }

    const {
      prefersReducedMotion = false,
      duration = this.timeline.flightDuration,
    } = options;

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

    const { wrapper: flightBall } = createTokenElement(entry.number, {
      tag: 'div',
      className: 'draw-flight-ball',
    });

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

  async showDrawAnimation(entry, options = {}) {
    const { onFlightComplete = null } = options;
    const {
      drawOverlay,
      drawOverlayNumber,
      drawOverlayBall,
      drawOverlayAnnouncement,
    } = this.elements;
    const targetCell = state.cellsByNumber.get(entry.number);

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
          console.warn("Errore durante l'aggiornamento della casella estratta", error);
        }
      }
    };

    if (!drawOverlay || !drawOverlayNumber || !drawOverlayBall) {
      if (targetCell) {
        try {
          targetCell.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center',
          });
        } catch (error) {
          targetCell.scrollIntoView();
        }
      }
      return false;
    }

    const prefersReducedMotion = this.prefersReducedMotionEnabled();
    const setAnnouncement = (text) => {
      if (drawOverlayAnnouncement) {
        drawOverlayAnnouncement.textContent = text;
      }
    };

    const revealNumber = () => {
      this.setOverlayBallLoading(false);
      drawOverlayNumber.textContent = entry.number;
      drawOverlayBall.classList.add('draw-portal__ball--revealed');
      setAnnouncement(`Numero ${entry.number}`);
    };

    const hideOverlay = (immediate = false) => {
      drawOverlay.classList.remove(
        'draw-portal--visible',
        'draw-portal--closing',
        'draw-portal--flight'
      );
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

    this.setOverlayBallLoading(true);
    drawOverlayBall.classList.remove('draw-portal__ball--revealed');
    drawOverlayNumber.textContent = '';
    setAnnouncement('');

    drawOverlay.hidden = false;
    drawOverlay.setAttribute('aria-hidden', 'false');
    drawOverlay.classList.remove('draw-portal--closing');
    drawOverlay.classList.remove('draw-portal--flight');
    drawOverlay.classList.add('draw-portal--visible');

    let didAnimate = true;

    try {
      if (prefersReducedMotion) {
        const fromRect = drawOverlayBall.getBoundingClientRect();
        await sleep(this.timeline.reducedMotionHold);
        revealNumber();

        drawOverlay.classList.add('draw-portal--flight');
        if (targetCell) {
          await this.animateBallFlight(entry, fromRect, targetCell, {
            prefersReducedMotion: true,
            duration: this.timeline.reducedMotionFlight,
          });
        } else {
          await sleep(this.timeline.reducedMotionFlight);
        }

        notifyFlightComplete();

        drawOverlay.classList.add('draw-portal--closing');
        await sleep(this.timeline.overlayHideDelay);
      } else {
        await sleep(this.timeline.intro);
        await sleep(this.timeline.prepareHold);
        await sleep(this.timeline.revealAccent);
        revealNumber();

        await sleep(this.timeline.celebrationHold);

        const fromRect = drawOverlayBall.getBoundingClientRect();
        drawOverlay.classList.add('draw-portal--closing');

        await sleep(this.timeline.flightDelay);
        drawOverlay.classList.add('draw-portal--flight');
        if (targetCell) {
          await this.animateBallFlight(entry, fromRect, targetCell, {
            duration: this.timeline.flightDuration,
            prefersReducedMotion,
          });
        } else {
          await sleep(this.timeline.flightDuration);
        }

        notifyFlightComplete();

        await sleep(this.timeline.overlayHideDelay);
      }
    } finally {
      this.setOverlayBallLoading(false);
      hideOverlay(true);
      drawOverlay.classList.remove('draw-portal--flight');
      drawOverlayBall.classList.remove('draw-portal__ball--revealed');
      drawOverlayNumber.textContent = '';
      setAnnouncement('');
    }

    return didAnimate;
  }

  getModalRevealDelay() {
    const delay = Number(this.timeline.modalRevealDelay);
    return Number.isFinite(delay) && delay > 0 ? delay : 0;
  }

  destroy() {
    if (this.cleanupCallbacks.size === 0) {
      return;
    }

    Array.from(this.cleanupCallbacks).forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.warn('Errore durante la pulizia delle animazioni', error);
      } finally {
        this.cleanupCallbacks.delete(callback);
      }
    });
  }
}

const animationManager = new AnimationManager({ elements, timeline: DRAW_TIMELINE });
registerCleanup(() => animationManager.destroy());

function loadSponsors() {
  setSponsorLoadingState(LoadingStates.LOADING);
  return sponsorManager
    .load()
    .then((sponsors) => {
      if (!Array.isArray(sponsors) || sponsors.length === 0) {
        setSponsorLoadingState(LoadingStates.ERROR);
        applySponsorToOverlay(null);
      } else {
        setSponsorLoadingState(LoadingStates.SUCCESS);
      }
      return sponsors;
    })
    .catch((error) => {
      console.warn('Impossibile caricare gli sponsor', error);
      setSponsorLoadingState(LoadingStates.ERROR);
      applySponsorToOverlay(null);
      throw error;
    });
}

function pickRandomSponsor(previousKey = null) {
  return sponsorManager.pickRandom(previousKey);
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
    const safeUrl = sanitizeUrl(sponsor.url || '');
    const isExternal = /^https?:\/\//i.test(safeUrl);
    anchor.href = safeUrl;
    anchor.target = isExternal ? '_blank' : '_self';
    if (isExternal) {
      anchor.rel = 'noopener noreferrer';
    } else {
      anchor.removeAttribute('rel');
    }

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

function createTokenElement(number, options = {}) {
  const {
    tag = 'span',
    className = '',
    numberClassName = '',
    ariaHidden = true,
  } = options;

  const wrapper = document.createElement(tag);
  const wrapperClasses = [className, 'token'].filter(Boolean).join(' ');
  if (wrapperClasses) {
    wrapper.className = wrapperClasses;
  }

  if (ariaHidden) {
    wrapper.setAttribute('aria-hidden', 'true');
  }

  const numberElement = document.createElement('span');
  numberElement.className = ['token__number', numberClassName].filter(Boolean).join(' ');
  numberElement.textContent = number;
  wrapper.appendChild(numberElement);

  return { wrapper, numberElement };
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
    if (shouldShowPlaceholder) {
      block.removeAttribute('hidden');
    } else {
      block.setAttribute('hidden', '');
    }
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
    logo.setAttribute('hidden', '');
    logo.removeAttribute('src');
    logo.alt = '';
    return;
  }

  block.hidden = false;
  block.removeAttribute('hidden');
  block.setAttribute('aria-hidden', 'false');
  block.classList.remove(placeholderClass);

  anchor.classList.remove('sponsor-link--placeholder');
  anchor.removeAttribute('aria-hidden');
  const safeUrl = sanitizeUrl(sponsor.url || '');
  const isExternal = /^https?:\/\//i.test(safeUrl);
  anchor.href = safeUrl;
  anchor.target = isExternal ? '_blank' : '_self';
  if (isExternal) {
    anchor.rel = 'noopener noreferrer';
  } else {
    anchor.removeAttribute('rel');
  }
  anchor.removeAttribute('tabindex');
  anchor.setAttribute('aria-label', getSponsorAccessibleLabel(sponsor));
  anchor.removeAttribute('title');

  if ('loading' in logo) {
    logo.loading = preferLazy ? 'lazy' : 'eager';
  }
  logo.hidden = false;
  logo.removeAttribute('hidden');
  if (logo.src !== sponsor.logo) {
    logo.src = sponsor.logo || '';
  }
  logo.alt = '';

  if (heading) {
    heading.hidden = false;
  }
}

function blurButtonOnNextFrame(button) {
  if (!button || typeof button.blur !== 'function') {
    return;
  }

  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => {
      button.blur();
    });
    return;
  }

  button.blur();
}

function applySponsorToOverlay(sponsor) {
  const { drawSponsor, drawSponsorLogo, drawSponsorBlock, drawSponsorHeading, drawOverlay } = elements;
  const shouldShowPlaceholder =
    !sponsor && state.sponsorLoadingState === LoadingStates.ERROR;

  updateSponsorBlock(
    {
      block: drawSponsorBlock,
      anchor: drawSponsor,
      logo: drawSponsorLogo,
      heading: drawSponsorHeading,
    },
    sponsor,
    { preferLazy: false, showPlaceholder: shouldShowPlaceholder }
  );

  if (drawOverlay) {
    drawOverlay.classList.toggle('draw-portal--has-sponsor', Boolean(sponsor));
  }
}

function applySponsorToModal(sponsor, options = {}) {
  const { modalSponsorBlock, modalSponsor, modalSponsorLogo, modalSponsorHeading } = elements;
  const shouldShowPlaceholder =
    !sponsor && state.sponsorLoadingState === LoadingStates.ERROR;

  updateSponsorBlock(
    {
      block: modalSponsorBlock,
      anchor: modalSponsor,
      logo: modalSponsorLogo,
      heading: modalSponsorHeading,
    },
    sponsor,
    { preferLazy: false, showPlaceholder: shouldShowPlaceholder, ...options }
  );
}

function persistSponsorForNumber(number, sponsor) {
  if (!Number.isInteger(number)) {
    return null;
  }

  return sponsorManager.assignToNumber(number, sponsor);
}

function getStoredSponsorForNumber(number) {
  if (!Number.isInteger(number)) {
    return null;
  }

  return sponsorManager.getAssignment(number);
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

  const currentSponsor = sponsorManager.getCurrentSponsor();

  if (fromDraw && currentSponsor) {
    const remembered = persistSponsorForNumber(number, currentSponsor);
    applySponsorToModal(remembered);
    return;
  }

  const selectRandomSponsor = () => {
    const previousKey = sponsorManager.getLastKey();
    const randomSponsor = pickRandomSponsor(previousKey);
    if (randomSponsor) {
      sponsorManager.rememberSponsorKey(randomSponsor);
    }
    return randomSponsor || null;
  };

  const immediateRandom = selectRandomSponsor();
  if (immediateRandom) {
    applySponsorToModal(immediateRandom);
    return;
  }

  applySponsorToModal(null);

  const pending =
    sponsorManager.getPendingLoad() ||
    (sponsorManager.hasSponsors()
      ? Promise.resolve(sponsorManager.getAllSponsors())
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

      const latestCurrent = sponsorManager.getCurrentSponsor();

      if (fromDraw && latestCurrent) {
        const remembered = persistSponsorForNumber(number, latestCurrent);
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

      const latestCurrent = sponsorManager.getCurrentSponsor();

      if (fromDraw && latestCurrent) {
        const remembered = persistSponsorForNumber(number, latestCurrent);
        if (remembered) {
          applySponsorToModal(remembered);
          return;
        }
      }

      applySponsorToModal(null);
    });
}

/**
 * Prepara lo sponsor che verrà mostrato nella prossima estrazione.
 * @returns {Promise<object|null>}
 */
async function prepareSponsorForNextDraw() {
  setSponsorLoadingState(LoadingStates.LOADING);
  return sponsorManager
    .prepareNext()
    .then((sponsor) => {
      const nextState = sponsor ? LoadingStates.SUCCESS : LoadingStates.ERROR;
      setSponsorLoadingState(nextState);
      applySponsorToOverlay(sponsor);
      return sponsor;
    })
    .catch((error) => {
      console.warn('Errore durante la preparazione dello sponsor', error);
      sponsorManager.clearCurrentSponsor();
      setSponsorLoadingState(LoadingStates.ERROR);
      applySponsorToOverlay(null);
      return null;
    });
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
    historyPanel.hidden = false;
    if (historyToggle) {
      historyToggle.setAttribute('aria-expanded', 'false');
    }
    updateHistoryToggleText();
    if (historyScrim) {
      historyScrim.classList.remove('history-scrim--visible');
      historyScrim.hidden = true;
      historyScrim.setAttribute('aria-hidden', 'true');
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
    historyScrim.setAttribute('aria-hidden', 'false');
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
        historyScrim.setAttribute('aria-hidden', 'true');
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
    return true;
  }

  try {
    const payload = {
      drawnNumbers: Array.from(state.drawnNumbers),
      drawHistory: state.drawHistory.map((item) => ({ ...item })),
    };
    window.localStorage.setItem(DRAW_STATE_STORAGE_KEY, JSON.stringify(payload));
    state.storageErrorMessage = '';
    return true;
  } catch (error) {
    console.warn('Impossibile salvare lo stato della partita', error);
    state.storageErrorMessage = 'Impossibile salvare lo stato della partita.';
    return false;
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
    sponsorManager.resetAssignments();

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
  setDataLoadingState(LoadingStates.LOADING);
  try {
    const response = await fetch('data.json');
    if (!response.ok) {
      throw new Error('Impossibile caricare i dati');
    }
    const data = await response.json();
    const incomingNumbers = Array.isArray(data?.numbers) ? data.numbers : null;
    if (!incomingNumbers) {
      throw new Error('Formato dati non valido');
    }

    const seenNumbers = new Set();
    const sanitizedNumbers = [];

    incomingNumbers.forEach((item) => {
      if (!item || typeof item !== 'object') {
        return;
      }

      const numericValue = Number(item.number);
      if (!Number.isFinite(numericValue) || seenNumbers.has(numericValue)) {
        return;
      }

      seenNumbers.add(numericValue);
      sanitizedNumbers.push({
        ...item,
        number: numericValue,
        italian: typeof item.italian === 'string' ? item.italian : '',
        dialect: typeof item.dialect === 'string' ? item.dialect : '',
      });
    });

    if (!sanitizedNumbers.length) {
      throw new Error('Nessun numero valido trovato');
    }

    sanitizedNumbers.sort((a, b) => a.number - b.number);

    state.numbers = sanitizedNumbers;
    state.drawnNumbers = new Set();
    state.drawHistory = [];
    sponsorManager.resetAssignments();
    state.entriesByNumber = new Map();
    state.storageErrorMessage = '';
    renderBoard();
    updateDrawHistory();

    const latestEntry = restoreDrawStateFromStorage();
    updateDrawStatus(latestEntry || undefined);
    setDataLoadingState(LoadingStates.SUCCESS);
  } catch (error) {
    console.error(error);
    state.numbers = [];
    state.drawnNumbers = new Set();
    state.drawHistory = [];
    state.entriesByNumber = new Map();
    state.cellsByNumber = new Map();
    state.selected = null;
    sponsorManager.resetAssignments();
    state.storageErrorMessage = 'Impossibile caricare i numeri della tombola.';
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
    setDataLoadingState(LoadingStates.ERROR);
    updateDrawHistory();
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

    const tokenNumberEl = cell.querySelector('[data-board-token-number]');
    if (tokenNumberEl) {
      tokenNumberEl.textContent = entry.number;
    }

    const ariaLabelParts = [`Numero ${entry.number}`];
    if (entry.italian) {
      ariaLabelParts.push(entry.italian);
    }
    cell.setAttribute('aria-label', ariaLabelParts.join(' – '));

    const isDrawn = state.drawnNumbers.has(entry.number);
    cell.classList.toggle('board-cell--drawn', isDrawn);
    cell.setAttribute('aria-pressed', isDrawn ? 'true' : 'false');

    state.cellsByNumber.set(entry.number, cell);
    fragment.appendChild(cell);
  });

  board.appendChild(fragment);
}

function handleBoardCellClick(event) {
  const { board } = elements;
  if (!board) {
    return;
  }

  const cell = event.target.closest('.board-cell');
  if (!cell || !board.contains(cell)) {
    return;
  }

  const number = Number(cell.dataset.number);
  if (!Number.isInteger(number)) {
    return;
  }

  const entry = getEntryByNumber(number);
  if (!entry) {
    return;
  }

  handleSelection(entry, cell);
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
    target.style.display = 'none';
    target.removeEventListener('error', handleBoardCellImageError);
    return;
  }

  target.dataset.fallbackApplied = 'true';
  target.src = TILE_IMAGE_FALLBACK;
}

function applyBoardCellImage(imageEl, entry) {
  if (!(imageEl instanceof HTMLImageElement)) {
    return TILE_IMAGE_FALLBACK;
  }

  imageEl.dataset.fallbackApplied = 'false';
  imageEl.removeEventListener('error', handleBoardCellImageError);
  imageEl.addEventListener('error', handleBoardCellImageError);
  imageEl.style.removeProperty('display');
  const source = getNumberImage(entry);
  imageEl.src = source;
  return source;
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


/**
 * Gestisce la selezione e l'apertura del dettaglio di un numero del tabellone.
 * @param {{ number: number, italian?: string, dialect?: string }} entry
 * @param {HTMLElement} [cell]
 * @param {{ fromDraw?: boolean }} [options]
 */
function handleSelection(entry, cell, options = {}) {
  if (!entry) {
    return;
  }

  const targetCell = cell || state.cellsByNumber.get(entry.number);
  if (!targetCell) {
    return;
  }

  const { fromDraw = false } = options;

  if (state.selected) {
    state.selected.classList.remove('board-cell--active');
  }
  state.selected = targetCell;
  targetCell.classList.add('board-cell--active');

  openModal(entry, { fromDraw });
  speakEntry(entry);
}

/**
 * Marca un numero come estratto aggiornando stato, cronologia e sponsor.
 * @param {{ number: number, italian?: string, dialect?: string }} entry
 * @param {{ animate?: boolean, sponsor?: object|null, recordHistory?: boolean }} [options]
 */
function markNumberDrawn(entry, options = {}) {
  if (!entry) {
    return;
  }

  const { animate = false, sponsor: sponsorOverride = null, recordHistory = true } = options;
  const number = entry.number;

  if (state.drawnNumbers.has(number)) {
    return;
  }

  const previousDrawnNumbers = new Set(state.drawnNumbers);
  const previousHistoryLength = state.drawHistory.length;
  const hadStoredSponsor = sponsorManager.hasAssignment(number);
  const previousSponsor = hadStoredSponsor
    ? sponsorManager.getAssignment(number, { raw: true })
    : null;

  state.drawnNumbers.add(number);

  const activeSponsor = sponsorOverride || sponsorManager.getCurrentSponsor();
  const sponsorData = persistSponsorForNumber(number, activeSponsor);
  const sponsorPayload = sponsorData ? cloneSponsorData(sponsorData) : null;
  let shouldNotify = true;

  if (recordHistory) {
    state.drawHistory.push({
      number,
      italian: entry.italian || '',
      dialect: entry.dialect || '',
      sponsor: sponsorPayload,
    });

    const persisted = persistDrawState();

    if (!persisted) {
      state.drawnNumbers = previousDrawnNumbers;
      state.drawHistory.splice(previousHistoryLength);
      if (hadStoredSponsor && previousSponsor) {
        sponsorManager.restoreAssignment(number, previousSponsor);
      } else {
        sponsorManager.restoreAssignment(number, null);
      }
      shouldNotify = false;
    }

    updateDrawHistory();
  }

  if (state.storageErrorMessage) {
    updateDrawStatus();
  }

  const cell = state.cellsByNumber.get(number);
  if (cell) {
    const isDrawn = state.drawnNumbers.has(number);
    cell.classList.toggle('board-cell--drawn', isDrawn);
    cell.setAttribute('aria-pressed', isDrawn ? 'true' : 'false');
    if (isDrawn && animate) {
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
    } else {
      cell.classList.remove('board-cell--just-drawn');
    }
  }

  if (shouldNotify && recordHistory) {
    dispatchTombolaEvent(TombolaEvents.NUMBER_DRAWN, {
      entry: {
        number,
        italian: entry.italian || '',
        dialect: entry.dialect || '',
      },
      sponsor: sponsorPayload,
      animate,
    });
  }
}

/**
 * Gestisce il ciclo completo di una nuova estrazione, incluse animazioni,
 * aggiornamenti dello stato e apertura del dettaglio del numero.
 */
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
  let shouldDelayModal = false;

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
      const manager = animationManager;
      if (manager && typeof manager.showDrawAnimation === 'function') {
        const didAnimate = await manager.showDrawAnimation(entry, {
          onFlightComplete: () => {
            if (!markRecorded) {
              markNumberDrawn(entry, { animate: true });
              markRecorded = true;
            }
          },
        });
        shouldDelayModal = didAnimate && manager.getModalRevealDelay() > 0;
      }
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

  const modalRevealDelay = animationManager
    ? animationManager.getModalRevealDelay()
    : Number(DRAW_TIMELINE.modalRevealDelay) || 0;

  if (shouldDelayModal && modalRevealDelay > 0) {
    await sleep(modalRevealDelay);
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

    const { wrapper: token } = createTokenElement(item.number, {
      className: 'history-item__token',
      numberClassName: 'history-item__token-number',
    });

    listItem.appendChild(token);

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

    const meta = document.createElement('div');
    meta.className = 'history-item__meta';

    const italianLine = document.createElement('span');
    italianLine.className = 'history-item__lang history-item__lang--italian';
    const italianValue = typeof item.italian === 'string' ? item.italian.trim() : '';
    const hasItalian = Boolean(italianValue);
    italianLine.textContent = `Italiano: ${hasItalian ? italianValue : '—'}`;
    if (!hasItalian) {
      italianLine.classList.add('history-item__lang--empty');
    }
    meta.appendChild(italianLine);

    const dialectLine = document.createElement('span');
    dialectLine.className = 'history-item__lang history-item__lang--dialect';
    const dialectValue = typeof item.dialect === 'string' ? item.dialect.trim() : '';
    const hasDialect = Boolean(dialectValue);
    dialectLine.textContent = `Nojano: ${hasDialect ? dialectValue : '—'}`;
    if (!hasDialect) {
      dialectLine.classList.add('history-item__lang--empty');
    }
    meta.appendChild(dialectLine);

    details.appendChild(meta);

    listItem.appendChild(details);
    historyList.appendChild(listItem);
  }

  let prefersReducedMotion = false;
  if (
    animationManager &&
    typeof animationManager.prefersReducedMotionEnabled === 'function'
  ) {
    prefersReducedMotion = Boolean(animationManager.prefersReducedMotionEnabled());
  } else if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function'
  ) {
    prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  if (typeof historyList.scrollTo === 'function') {
    historyList.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  } else {
    historyList.scrollTop = 0;
  }
}

/**
 * Ripristina completamente lo stato della partita e ripulisce gli elementi UI.
 */
function performGameReset() {
  if (!state.numbers.length) {
    return;
  }

  const drawnBeforeReset = state.drawnNumbers.size;

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
  if (elements.drawOverlayAnnouncement) {
    elements.drawOverlayAnnouncement.textContent = '';
  }

  state.isAnimatingDraw = false;

  sponsorManager.clearCurrentSponsor();
  applySponsorToOverlay(null);

  if (state.currentUtterance && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  state.currentUtterance = null;

  state.drawnNumbers.clear();
  state.drawHistory = [];
  sponsorManager.resetAssignments();
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

  dispatchTombolaEvent(TombolaEvents.GAME_RESET, {
    drawnCount: drawnBeforeReset,
    totalNumbers: state.numbers.length,
  });
}

function openResetDialog() {
  if (!elements.resetDialog) {
    return false;
  }

  if (!elements.resetDialog.hasAttribute('hidden')) {
    return true;
  }

  const activeElement = document.activeElement;
  state.resetDialogTrigger =
    activeElement instanceof HTMLElement ? activeElement : elements.resetButton;

  state.resetDialogOpen = true;
  elements.resetDialog.removeAttribute('hidden');
  elements.resetDialog.setAttribute('aria-hidden', 'false');
  elements.resetDialog.classList.add('modal--visible');
  document.body.classList.add('modal-open');

  activateModalFocusTrap(elements.resetDialog);

  const focusTarget =
    elements.resetDialogConfirm ||
    (Array.isArray(elements.resetDialogCancelButtons)
      ? elements.resetDialogCancelButtons[0]
      : null) ||
    elements.resetButton;

  requestAnimationFrame(() => {
    if (focusTarget && typeof focusTarget.focus === 'function') {
      focusTarget.focus();
    }
  });

  return true;
}

function closeResetDialog(options = {}) {
  const config = options instanceof Event ? {} : options;
  const { returnFocus = true } = config;

  state.resetDialogOpen = false;

  const shouldRestoreModalTrap =
    Boolean(elements.modal) && !elements.modal.hasAttribute('hidden');

  releaseActiveFocusTrap(elements.resetDialog);

  if (!elements.resetDialog) {
    if (shouldRestoreModalTrap) {
      activateModalFocusTrap(elements.modal);
    }
    if (returnFocus && state.resetDialogTrigger instanceof HTMLElement) {
      state.resetDialogTrigger.focus();
    }
    state.resetDialogTrigger = null;
    if (!elements.modal || elements.modal.hasAttribute('hidden')) {
      document.body.classList.remove('modal-open');
    }
    return;
  }

  elements.resetDialog.classList.remove('modal--visible');
  elements.resetDialog.setAttribute('hidden', '');
  elements.resetDialog.setAttribute('aria-hidden', 'true');

  if (!elements.modal || elements.modal.hasAttribute('hidden')) {
    document.body.classList.remove('modal-open');
  }

  if (shouldRestoreModalTrap) {
    activateModalFocusTrap(elements.modal);
  }

  if (shouldRestoreModalTrap) {
    requestAnimationFrame(() => {
      const focusable = getFocusableElements(elements.modal);
      const fallback =
        (focusable.length > 0 && focusable[0]) ||
        elements.modalClose ||
        elements.modal;
      if (fallback && typeof fallback.focus === 'function') {
        try {
          fallback.focus({ preventScroll: true });
        } catch (error) {
          fallback.focus();
        }
      }
    });
  } else if (returnFocus) {
    const focusTarget =
      (state.resetDialogTrigger && document.body.contains(state.resetDialogTrigger)
        ? state.resetDialogTrigger
        : elements.resetButton) || elements.drawButton;
    if (focusTarget && typeof focusTarget.focus === 'function') {
      focusTarget.focus();
    }
  }

  state.resetDialogTrigger = null;
}

/**
 * Avvia il flusso di azzeramento della partita, mostrando conferme quando serve.
 */
function resetGame() {
  if (!state.numbers.length) {
    return;
  }

  closeHistoryPanel({ immediate: true });

  if (state.drawnNumbers.size > 0) {
    const handled = openResetDialog();
    if (handled) {
      return;
    }

    const shouldReset = window.confirm(
      'Vuoi ricominciare la partita? Tutti i numeri estratti verranno azzerati.'
    );
    if (!shouldReset) {
      return;
    }
  }

  performGameReset();
}

function openModal(entry, options = {}) {
  const { fromDraw = false } = options;

  const paddedNumber = String(entry.number).padStart(2, '0');
  elements.modalNumber.textContent = `Numero ${paddedNumber}`;
  elements.modalNumber.setAttribute('aria-label', `Numero ${entry.number}`);

  const rawItalian = typeof entry.italian === 'string' ? entry.italian.trim() : '';
  const rawDialect = typeof entry.dialect === 'string' ? entry.dialect.trim() : '';
  const hasItalian = Boolean(rawItalian);
  const hasDialect = Boolean(rawDialect);
  const italianText = hasItalian ? rawItalian : '—';
  const dialectText = hasDialect ? rawDialect : '—';

  if (elements.modalItalian) {
    elements.modalItalian.textContent = italianText;
    elements.modalItalian.classList.toggle(
      'number-dialog__phrase--empty',
      !hasItalian
    );
  }

  if (elements.modalDialect) {
    elements.modalDialect.textContent = dialectText;
    elements.modalDialect.classList.toggle(
      'number-dialog__phrase--empty',
      !hasDialect
    );
  }

  if (elements.modalItalianPlay) {
    elements.modalItalianPlay.disabled = !hasItalian;
    if (hasItalian) {
      elements.modalItalianPlay.removeAttribute('aria-disabled');
    } else {
      elements.modalItalianPlay.setAttribute('aria-disabled', 'true');
    }
  }

  if (elements.modalDialectPlay) {
    elements.modalDialectPlay.disabled = !hasDialect;
    if (hasDialect) {
      elements.modalDialectPlay.removeAttribute('aria-disabled');
    } else {
      elements.modalDialectPlay.setAttribute('aria-disabled', 'true');
    }
  }

  let imageSource = TILE_IMAGE_FALLBACK;
  if (elements.modalImage) {
    imageSource = applyBoardCellImage(elements.modalImage, entry);
    elements.modalImage.alt = imageSource !== TILE_IMAGE_FALLBACK
      ? entry.italian
        ? `Illustrazione del numero ${entry.number}: ${entry.italian}`
        : `Illustrazione del numero ${entry.number}`
      : `Segnaposto per il numero ${entry.number}`;
  }

  if (elements.modalImageFrame) {
    elements.modalImageFrame.classList.toggle(
      'number-dialog__image-frame--placeholder',
      imageSource === TILE_IMAGE_FALLBACK
    );
  }

  ensureModalSponsor(entry, { fromDraw });

  elements.modal.removeAttribute('hidden');
  elements.modal.classList.add('modal--visible');
  document.body.classList.add('modal-open');

  activateModalFocusTrap(elements.modal);

  let focusTarget = elements.modalClose;

  if (elements.modalNext) {
    const total = state.numbers.length;
    const drawnCount = state.drawnNumbers.size;
    const remaining = Math.max(total - drawnCount, 0);
    const shouldShow = (fromDraw || state.isAnimatingDraw) && remaining > 0;

    const nextLabel = remaining === 1 ? 'Estrai ultimo numero' : 'Estrai successivo';

    elements.modalNext.hidden = !shouldShow;
    elements.modalNext.disabled = !shouldShow;

    if (shouldShow) {
      elements.modalNext.setAttribute('aria-label', nextLabel);
      if (elements.modalNextLabel) {
        elements.modalNextLabel.textContent = nextLabel;
      }
      focusTarget = elements.modalNext;
    }
  }

  focusTarget.focus();
}

function closeModal(options = {}) {
  const config = options instanceof Event ? {} : options;
  const { returnFocus = true } = config;
  releaseActiveFocusTrap(elements.modal);
  elements.modal.classList.remove('modal--visible');
  elements.modal.setAttribute('hidden', '');
  document.body.classList.remove('modal-open');
  if (elements.modalNext) {
    elements.modalNext.hidden = true;
    elements.modalNext.disabled = true;
  }
  applySponsorToModal(null);
  if (elements.modalImageFrame) {
    elements.modalImageFrame.classList.remove('number-dialog__image-frame--placeholder');
  }
  if (returnFocus && state.selected) {
    if (document.body.contains(state.selected)) {
      state.selected.focus();
    } else {
      state.selected = null;
    }
  }
}

function speakText(text, options = {}) {
  if (
    typeof window === 'undefined' ||
    !('speechSynthesis' in window) ||
    typeof SpeechSynthesisUtterance !== 'function'
  ) {
    return;
  }

  const content = typeof text === 'string' ? text.trim() : '';

  if (!content) {
    return;
  }

  const {
    lang = 'it-IT',
    rate = 0.92,
    pitch = 1.0,
    prefix = '',
    respectToggle = true,
  } = options;

  if (respectToggle && !state.audioEnabled) {
    if (state.currentUtterance) {
      window.speechSynthesis.cancel();
      state.currentUtterance = null;
    }
    return;
  }

  if (state.currentUtterance) {
    window.speechSynthesis.cancel();
  }

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
    respectToggle: false,
  });
}

function speakItalianText(entry) {
  if (!entry || !entry.italian) {
    return;
  }

  speakText(entry.italian, {
    lang: 'it-IT',
    rate: 0.96,
    respectToggle: false,
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
  const isDataLoading = state.dataLoadingState === LoadingStates.LOADING;
  const isDataError = state.dataLoadingState === LoadingStates.ERROR;

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
      const detailFallback =
        normalizedEntry.dialect || normalizedEntry.italian || '—';
      detailText = detailFallback;
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

  if (isDataLoading) {
    message = 'Caricamento del tabellone…';
  } else if (isDataError) {
    message = 'Errore nel caricamento dei numeri.';
  } else if (!state.storageErrorMessage && total > 0) {
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
    drawButton.disabled = noNumbersLoaded || finished || isDataLoading || isDataError;

    let drawLabel = 'Estrai numero';

    if (finished) {
      drawLabel = 'Fine estrazioni';
    } else if (isDataLoading) {
      drawLabel = 'Caricamento in corso';
    } else if (isDataError) {
      drawLabel = 'Estrazione non disponibile';
    } else if (!noNumbersLoaded && drawnCount === 0) {
      drawLabel = 'Estrai primo numero';
    } else if (!noNumbersLoaded && drawnCount > 0) {
      drawLabel = 'Estrai successivo';
    }

    if (elements.drawButtonLabel) {
      elements.drawButtonLabel.textContent = drawLabel;
    }

    drawButton.setAttribute('aria-label', drawLabel);
    drawButton.title = drawLabel;
  }

  if (elements.floatingDrawButton) {
    const floatingButton = elements.floatingDrawButton;
    const floatingSr = floatingButton.querySelector('[data-floating-draw-sr]');
    floatingButton.disabled =
      noNumbersLoaded || finished || isDataLoading || isDataError;

    let srMessage = 'Estrai numero';

    if (isDataLoading) {
      srMessage = 'Caricamento del tabellone in corso';
    } else if (isDataError) {
      srMessage = 'Estrazione non disponibile';
    } else if (noNumbersLoaded) {
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
    resetButton.disabled = drawnCount === 0 || isDataLoading || isDataError;
  }
}

function setupEventListeners() {
  if (elements.board) {
    elements.board.addEventListener('click', handleBoardCellClick);
    registerCleanup(() => {
      if (elements.board) {
        elements.board.removeEventListener('click', handleBoardCellClick);
      }
    });
  }

  elements.modalClose.addEventListener('click', closeModal);
  if (elements.modalDialectPlay) {
    elements.modalDialectPlay.addEventListener('click', () => {
      if (!state.selected) {
        blurButtonOnNextFrame(elements.modalDialectPlay);
        return;
      }

      const number = Number(state.selected.dataset.number);
      const entry = getEntryByNumber(number);
      if (entry) {
        speakDialectText(entry);
      }
      blurButtonOnNextFrame(elements.modalDialectPlay);
    });
  }

  if (elements.modalItalianPlay) {
    elements.modalItalianPlay.addEventListener('click', () => {
      if (!state.selected) {
        blurButtonOnNextFrame(elements.modalItalianPlay);
        return;
      }

      const number = Number(state.selected.dataset.number);
      const entry = getEntryByNumber(number);
      if (entry) {
        speakItalianText(entry);
      }
      blurButtonOnNextFrame(elements.modalItalianPlay);
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

  if (elements.resetDialog) {
    elements.resetDialog.addEventListener('click', (event) => {
      if (event.target === elements.resetDialog) {
        closeResetDialog();
      }
    });
  }

  if (elements.resetDialogConfirm) {
    elements.resetDialogConfirm.addEventListener('click', () => {
      closeResetDialog({ returnFocus: false });
      performGameReset();
    });
  }

  if (Array.isArray(elements.resetDialogCancelButtons)) {
    elements.resetDialogCancelButtons.forEach((button) => {
      if (button) {
        button.addEventListener('click', () => closeResetDialog());
      }
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
      return;
    }

    if (state.resetDialogOpen) {
      closeResetDialog();
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

  const handleHistoryMediaChange = () => {
    closeHistoryPanel({ immediate: true });
    syncHistoryPanelToLayout({ immediate: true });
  };

  if (historyMediaMatcher && typeof historyMediaMatcher.addEventListener === 'function') {
    historyMediaMatcher.addEventListener('change', handleHistoryMediaChange);
    registerCleanup(() => {
      historyMediaMatcher.removeEventListener('change', handleHistoryMediaChange);
    });
  } else if (
    historyMediaMatcher &&
    typeof historyMediaMatcher.addListener === 'function'
  ) {
    historyMediaMatcher.addListener(handleHistoryMediaChange);
    registerCleanup(() => {
      if (typeof historyMediaMatcher.removeListener === 'function') {
        historyMediaMatcher.removeListener(handleHistoryMediaChange);
      }
    });
  }
}

function init() {
  initializeAudioPreference();
  setupEventListeners();
  syncHistoryPanelToLayout({ immediate: true });
  updateLoadingUI();
  loadNumbers();
  loadSponsors().catch(() => {});
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

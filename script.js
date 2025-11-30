/* ============================================
   TOMBOLA NOJANA - SCRIPT (Optimized)
   ============================================ */

// ============================================
// 1. CONSTANTS
// ============================================
const STORAGE_KEYS = {
  AUDIO: 'tombola-audio-enabled',
  DRAW_STATE: 'TOMBOLA_DRAW_STATE',
};

const DATA_PATHS = {
  NUMBERS: 'data.json',
  SPONSORS: 'sponsors.json',
};

const illustrationFitCache = new Map();

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

const CSS_CLASSES = {
  CELL_DRAWN: 'board-cell--drawn',
  CELL_ACTIVE: 'board-cell--active',
  CELL_INCOMING: 'board-cell--incoming',
  CELL_JUST_DRAWN: 'board-cell--just-drawn',
  MODAL_OPEN: 'modal-open',
  MODAL_VISIBLE: 'modal--visible',
  HISTORY_OPEN: 'history--open',
  PORTAL_VISIBLE: 'draw-portal--visible',
  PORTAL_CLOSING: 'draw-portal--closing',
  PORTAL_FLIGHT: 'draw-portal--flight',
  PORTAL_CHARGING: 'draw-portal--charging',
  BALL_LOADING: 'draw-portal__ball--loading',
  BALL_REVEALED: 'draw-portal__ball--revealed',
};

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

const ANIMATION_DELAYS = {
  SHORT: 220,
  MEDIUM: 320,
  LONG: 520,
  SCROLL_IDLE_TIMEOUT: 900,
  SCROLL_IDLE_THRESHOLD: 160,
};

const SponsorMarqueeConfig = {
  VISIBLE_COUNT: 6,
  PIXELS_PER_SECOND: 32,
  FALLBACK_ITEM_HEIGHT: 120,
};

// ============================================
// 2. STATE
// ============================================
const state = {
  numbers: [],
  selected: null,
  currentAudio: null,
  audioPlaybackToken: 0,
  cellsByNumber: new Map(),
  entriesByNumber: new Map(),
  drawnNumbers: new Set(),
  drawHistory: [],
  isAnimatingDraw: false,
  historyOpen: false,
  historyWasOpenBeforeFullscreen: false,
  historyOriginalParent: null,
  historyOriginalNextSibling: null,
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
  fullscreenActive: false,
  sponsorRotationTimer: null,
};

// ============================================
// 3. DOM ELEMENTS
// ============================================
const elements = {
  board: document.querySelector('#board'),
  template: document.querySelector('#board-cell-template'),
  modal: document.querySelector('#number-modal'),
  modalNumber: document.querySelector('#modal-number'),
  modalItalian: document.querySelector('#modal-italian'),
  modalDialect: document.querySelector('#modal-dialect'),
  modalImageFrame: document.querySelector('#modal-image-frame'),
  modalClose: document.querySelector('#modal-close'),
  modalDialectCard: document.querySelector('#modal-dialect-card'),
  modalItalianCard: document.querySelector('#modal-italian-card'),
  modalNext: document.querySelector('#modal-next'),
  modalSponsorBlock: document.querySelector('#modal-sponsor-block'),
  modalSponsor: document.querySelector('#modal-sponsor'),
  modalSponsorLogo: document.querySelector('#modal-sponsor-logo'),
  drawButton: document.querySelector('#draw-button'),
  resetButton: document.querySelector('#reset-button'),
  resetDialog: document.querySelector('#reset-dialog'),
  resetDialogConfirm: document.querySelector('[data-reset-confirm]'),
  resetDialogCancelButtons: Array.from(document.querySelectorAll('[data-reset-cancel]')),
  drawStatus: document.querySelector('#draw-status'),
  drawOverlay: document.querySelector('#draw-portal'),
  drawOverlayNumber: document.querySelector('#draw-animation-number'),
  drawOverlayBall: document.querySelector('#draw-animation-ball'),
  drawOverlayAnnouncement: document.querySelector('#draw-animation-announcement'),
  drawOverlayLoader: document.querySelector('#draw-portal-loader'),
  drawSponsorBlock: document.querySelector('#draw-sponsor-block'),
  drawSponsor: document.querySelector('#draw-sponsor'),
  drawSponsorLogo: document.querySelector('#draw-sponsor-logo'),
  sponsorShowcase: document.querySelector('#sponsor-showcase'),
  sponsorShowcaseList: document.querySelector('#sponsor-showcase-list'),
  historyList: document.querySelector('#draw-history'),
  historyEmpty: document.querySelector('#draw-history-empty'),
  historyPanel: document.querySelector('#history-panel'),
  historyToggle: document.querySelector('#history-toggle'),
  historyScrim: document.querySelector('#history-scrim'),
  audioToggle: document.querySelector('#audio-toggle'),
  drawProgressValue: document.querySelector('#draw-progress-value'),
  drawProgressBar: document.querySelector('#draw-progress-bar'),
  drawProgressFill: document.querySelector('#draw-progress-bar .progress__fill'),
  drawLastMetric: document.querySelector('.status-card__metric--last'),
  drawLastNumber: document.querySelector('#draw-last-number'),
  drawLastDetail: document.querySelector('#draw-last-detail'),
  drawLastLanguages: document.querySelector('#draw-last-languages'),
  drawLastDialect: document.querySelector('#draw-last-dialect'),
  drawLastItalian: document.querySelector('#draw-last-italian'),
  drawLastDetailMessage: document.querySelector('#draw-last-detail-message'),
  fullscreenToggle: document.querySelector('#fullscreen-toggle'),
  fullscreenToggleLabel: document.querySelector('#fullscreen-toggle-label'),
  layout: document.querySelector('.layout'),
};

// ============================================
// 4. UTILITY FUNCTIONS
// ============================================

/** Sleep utility */
function sleep(duration) {
  return new Promise((resolve) => setTimeout(resolve, duration));
}

/** Sanitize URL */
function sanitizeUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return '#';

  const trimmed = url.trim();
  const isRelative = !/^([a-z][a-z0-9+.-]*:)?\/\//i.test(trimmed);

  try {
    const base = window?.location?.origin || 'https://example.com';
    const parsed = new URL(trimmed, base);

    if (!['http:', 'https:'].includes(parsed.protocol)) return '#';
    return isRelative ? trimmed : parsed.href;
  } catch {
    return '#';
  }
}

/** Dispatch custom event */
function dispatchTombolaEvent(name, detail = {}) {
  if (!name || typeof window === 'undefined') return;

  try {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch (error) {
    console.warn('Event dispatch failed', error);
  }
}

/** Validate loading state */
function isValidLoadingState(value) {
  return Object.values(LoadingStates).includes(value);
}

/** Create token element */
function createTokenElement(number, options = {}) {
  const { tag = 'span', className = '', ariaHidden = true } = options;

  const wrapper = document.createElement(tag);
  wrapper.className = ['token', className].filter(Boolean).join(' ');
  if (ariaHidden) wrapper.setAttribute('aria-hidden', 'true');

  const numberEl = document.createElement('span');
  numberEl.className = 'token__number';
  numberEl.textContent = number;
  wrapper.appendChild(numberEl);

  return { wrapper, numberElement: numberEl };
}

/** Blur button on next frame */
function blurButtonOnNextFrame(button) {
  if (!button?.blur) return;
  requestAnimationFrame(() => button.blur());
}

/** Wait for scroll idle */
function waitForScrollIdle(options = {}) {
  const { timeout = ANIMATION_DELAYS.SCROLL_IDLE_TIMEOUT, idleThreshold = ANIMATION_DELAYS.SCROLL_IDLE_THRESHOLD } = options;
  
  if (typeof requestAnimationFrame !== 'function') {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let lastX = window.scrollX;
    let lastY = window.scrollY;
    let lastChange = performance.now();
    const deadline = lastChange + timeout;

    const check = (timestamp) => {
      const currentTime = timestamp || performance.now();
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

      requestAnimationFrame(check);
    };

    requestAnimationFrame(check);
  });
}

// ============================================
// 5. CLEANUP & RESOURCE MANAGEMENT
// ============================================

function registerCleanup(callback) {
  if (typeof callback === 'function') {
    state.cleanupTasks.add(callback);
  }
}

function runCleanupTasks() {
  state.cleanupTasks.forEach((cleanup) => {
    try {
      cleanup();
    } catch (error) {
      console.warn('Cleanup error', error);
    }
  });
  state.cleanupTasks.clear();
}

function releaseActiveFocusTrap(targetElement) {
  if (!state.activeFocusTrapCleanup) return;
  if (targetElement && state.activeFocusTrapElement !== targetElement) return;

  try {
    state.activeFocusTrapCleanup();
  } catch (error) {
    console.warn('Focus trap cleanup error', error);
  } finally {
    state.activeFocusTrapCleanup = null;
    state.activeFocusTrapElement = null;
  }
}

registerCleanup(() => releaseActiveFocusTrap());

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', runCleanupTasks);
  window.addEventListener('beforeunload', runCleanupTasks);
}

// ============================================
// 6. FOCUS MANAGEMENT
// ============================================

function getFocusableElements(container) {
  if (!(container instanceof HTMLElement)) return [];

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

  return Array.from(container.querySelectorAll(selectors.join(','))).filter((el) => {
    if (!(el instanceof HTMLElement)) return false;
    if (el.hasAttribute('disabled')) return false;
    
    const tabIndex = el.getAttribute('tabindex');
    if (tabIndex !== null && parseInt(tabIndex, 10) < 0) return false;
    
    return el.getClientRects().length > 0 || el === container;
  });
}

function isolateModalBackground(modalElement) {
  if (!(modalElement instanceof HTMLElement)) return () => {};

  const siblings = Array.from(document.body.children).filter(
    (el) => el instanceof HTMLElement && el !== modalElement && !modalElement.contains(el)
  );

  const previousStates = siblings.map((el) => {
    const supportsInert = 'inert' in el;
    const previousInert = supportsInert ? el.inert : el.hasAttribute('inert');
    const hadInertAttribute = el.hasAttribute('inert');
    const previousAriaHidden = el.getAttribute('aria-hidden');

    if (supportsInert) {
      el.inert = true;
      if (!hadInertAttribute) el.setAttribute('data-modal-added-inert', '');
    } else {
      el.setAttribute('aria-hidden', 'true');
      el.setAttribute('data-modal-hidden', '');
      if (!hadInertAttribute) el.setAttribute('inert', '');
    }

    return { el, supportsInert, previousInert, hadInertAttribute, previousAriaHidden };
  });

  return () => {
    previousStates.forEach(({ el, supportsInert, previousInert, hadInertAttribute, previousAriaHidden }) => {
      if (supportsInert) {
        el.inert = Boolean(previousInert);
        if (!previousInert && el.hasAttribute('data-modal-added-inert')) {
          el.removeAttribute('data-modal-added-inert');
          el.removeAttribute('inert');
        }
      } else {
        if (!hadInertAttribute) el.removeAttribute('inert');
        if (el.hasAttribute('data-modal-hidden')) {
          el.removeAttribute('data-modal-hidden');
          if (previousAriaHidden === null) {
            el.removeAttribute('aria-hidden');
          } else {
            el.setAttribute('aria-hidden', previousAriaHidden);
          }
        }
      }
    });
  };
}

function activateModalFocusTrap(modalElement) {
  if (!(modalElement instanceof HTMLElement)) return null;

  releaseActiveFocusTrap();

  const backgroundCleanup = isolateModalBackground(modalElement);

  const enforceFocus = (event) => {
    if (!modalElement.contains(event.target)) {
      const focusable = getFocusableElements(modalElement);
      const fallback = focusable[0] || modalElement;
      event.stopPropagation();
      fallback?.focus();
    }
  };

  const handleKeydown = (event) => {
    if (event.key !== 'Tab') return;

    const focusable = getFocusableElements(modalElement);

    if (focusable.length === 0) {
      modalElement.setAttribute('tabindex', '-1');
      modalElement.focus();
      event.preventDefault();
      return;
    }

    const firstEl = focusable[0];
    const lastEl = focusable[focusable.length - 1];
    const activeEl = document.activeElement;

    if (event.shiftKey) {
      if (!modalElement.contains(activeEl) || activeEl === firstEl) {
        lastEl.focus();
        event.preventDefault();
      }
    } else {
      if (!modalElement.contains(activeEl) || activeEl === lastEl) {
        firstEl.focus();
        event.preventDefault();
      }
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

// ============================================
// 7. LOADING STATE MANAGEMENT
// ============================================

function setDataLoadingState(nextState) {
  if (!isValidLoadingState(nextState) || state.dataLoadingState === nextState) return;

  state.dataLoadingState = nextState;
  updateLoadingUI();
  updateDrawStatus();
}

function setSponsorLoadingState(nextState) {
  if (!isValidLoadingState(nextState) || state.sponsorLoadingState === nextState) return;

  state.sponsorLoadingState = nextState;
  updateLoadingUI();
}

function updateLoadingUI() {
  const isDataLoading = state.dataLoadingState === LoadingStates.LOADING;
  const isDataError = state.dataLoadingState === LoadingStates.ERROR;
  const isSponsorLoading = state.sponsorLoadingState === LoadingStates.LOADING;
  const isSponsorError = state.sponsorLoadingState === LoadingStates.ERROR;

  // Board loading
  if (elements.board) {
    elements.board.classList.toggle('board-grid--loading', isDataLoading);
    if (isDataLoading) {
      elements.board.setAttribute('aria-busy', 'true');
    } else {
      elements.board.removeAttribute('aria-busy');
    }
  }

  // Sponsor blocks loading
  const sponsorBlocks = [elements.drawSponsorBlock, elements.modalSponsorBlock];
  sponsorBlocks.forEach((block) => {
    if (!block) return;

    if (!block.dataset.placeholderLabel) {
      block.dataset.placeholderLabel = 'Sponsor in arrivo…';
    }
    if (!block.dataset.errorLabel) {
      block.dataset.errorLabel = 'Nessuno sponsor disponibile';
    }

    block.classList.toggle('sponsor-block--loading', isSponsorLoading);
    block.classList.toggle('sponsor-block--error', isSponsorError && !isSponsorLoading);

    if (isSponsorLoading) {
      block.setAttribute('aria-busy', 'true');
    } else {
      block.removeAttribute('aria-busy');
    }
  });

  // Draw status role
  if (elements.drawStatus) {
    if (isDataError) {
      elements.drawStatus.setAttribute('role', 'alert');
    } else {
      elements.drawStatus.removeAttribute('role');
    }
  }
}

// ============================================
// 8. SPONSOR UTILITIES
// ============================================

function getSponsorKey(sponsor) {
  return sponsor?.url || sponsor?.logo || null;
}

function normalizeSponsor(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const logo = typeof raw.logo === 'string' ? raw.logo.trim() : '';
  const url = typeof raw.url === 'string' ? raw.url.trim() : null;
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : '';
  const onlyShowcase = Boolean(raw.onlyShowcase);

  if (!logo) return null;

  return { logo, url, name, onlyShowcase };
}

function cloneSponsorData(sponsor) {
  return normalizeSponsor(sponsor);
}

function getSponsorDisplayName(sponsor) {
  if (!sponsor) return '';
  if (sponsor.name?.trim()) return sponsor.name.trim();
  if (!sponsor.url?.trim()) return '';

  try {
    const url = new URL(sponsor.url, window?.location?.origin);
    const host = url.hostname.replace(/^www\./i, '');
    const currentHost = window?.location?.hostname.replace(/^www\./i, '');
    return host === currentHost ? '' : host;
  } catch {
    return '';
  }
}

function getSponsorAccessibleLabel(sponsor) {
  const displayName = getSponsorDisplayName(sponsor);
  return displayName ? `Apri il sito di ${displayName}` : 'Apri il sito dello sponsor';
}

// ============================================
// 9. SPONSOR MANAGER CLASS
// ============================================

class SponsorManager {
  constructor(options = {}) {
    this.dataPath = options.dataPath || DATA_PATHS.SPONSORS;
    this.onSponsorsChanged = options.onSponsorsChanged || null;

    this.assignments = new Map();
    this.sponsors = [];
    this.loadPromise = null;
    this.preparationPromise = null;
    this.currentSponsor = null;
    this.lastSponsorKey = null;
  }

  hasSponsors() {
    return Array.isArray(this.sponsors) && this.sponsors.length > 0;
  }

  getAllSponsors() {
    return this.sponsors.map(cloneSponsorData).filter(Boolean);
  }

  resetAssignments() {
    this.assignments.clear();
  }

  hasAssignment(number) {
    return Number.isInteger(number) && this.assignments.has(number);
  }

  getAssignment(number) {
    if (!Number.isInteger(number)) return null;
    const stored = this.assignments.get(number);
    return stored ? cloneSponsorData(stored) : null;
  }

  assignToNumber(number, sponsor) {
    if (!Number.isInteger(number)) return null;
    const normalized = cloneSponsorData(sponsor);
    if (!normalized) return null;

    this.assignments.set(number, normalized);
    dispatchTombolaEvent(TombolaEvents.SPONSOR_ASSIGNED, {
      number,
      sponsor: cloneSponsorData(normalized),
    });
    return cloneSponsorData(normalized);
  }

  restoreAssignment(number, sponsor) {
    if (!Number.isInteger(number)) return;

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
    dispatchTombolaEvent(TombolaEvents.SPONSOR_ASSIGNED, { number, sponsor: null });
  }

  clearCurrentSponsor() {
    this.currentSponsor = null;
    this.lastSponsorKey = null;
  }

  getCurrentSponsor() {
    return this.currentSponsor ? cloneSponsorData(this.currentSponsor) : null;
  }

  setCurrentSponsor(sponsor) {
    const normalized = cloneSponsorData(sponsor);
    this.currentSponsor = normalized || null;
    this.lastSponsorKey = getSponsorKey(this.currentSponsor);
    
    dispatchTombolaEvent(TombolaEvents.SPONSOR_SELECTED, {
      sponsor: this.getCurrentSponsor(),
    });
    return this.getCurrentSponsor();
  }

  async load() {
    if (this.hasSponsors()) return Promise.resolve(this.getAllSponsors());
    if (this.loadPromise) return this.loadPromise;

    const task = (async () => {
      try {
        const response = await fetch(this.dataPath);
        if (!response.ok) throw new Error('Fetch failed');

        const data = await response.json();
        const rawList = Array.isArray(data?.sponsors) ? data.sponsors : Array.isArray(data) ? data : [];
        const normalized = rawList.map(normalizeSponsor).filter(Boolean);

        this.sponsors = normalized.map(cloneSponsorData);
        this.lastSponsorKey = null;
        this._notifySponsorsChanged(normalized.length > 0 ? 'remote' : 'empty');
        return this.getAllSponsors();
      } catch (error) {
        console.warn('Sponsor load error', error);
        this.sponsors = [];
        this.lastSponsorKey = null;
        this._notifySponsorsChanged('error');
        return [];
      }
    })();

    this.loadPromise = task.finally(() => {
      this.loadPromise = null;
    });

    return this.loadPromise;
  }

  pickRandom(excludeKey = null) {
    if (!this.hasSponsors()) return null;

    const eligibleSponsors = this.sponsors.filter((s) => !s.onlyShowcase);
    if (eligibleSponsors.length === 0) return null;

    let pool = eligibleSponsors;
    if (excludeKey) {
      const filtered = eligibleSponsors.filter((s) => getSponsorKey(s) !== excludeKey);
      if (filtered.length > 0) pool = filtered;
    }

    const index = Math.floor(Math.random() * pool.length);
    return cloneSponsorData(pool[index]);
  }

  async prepareNext() {
    if (this.preparationPromise) return this.preparationPromise;

    const preparation = this.load()
      .then(() => {
        if (!this.hasSponsors()) {
          this.clearCurrentSponsor();
          return null;
        }

        const next = this.pickRandom(this.lastSponsorKey);
        return this.setCurrentSponsor(next);
      })
      .catch((error) => {
        console.warn('Sponsor preparation error', error);
        this.clearCurrentSponsor();
        return null;
      })
      .finally(() => {
        this.preparationPromise = null;
      });

    this.preparationPromise = preparation;
    return preparation;
  }

  _notifySponsorsChanged(origin = 'unknown') {
    const snapshot = this.getAllSponsors();
    if (this.onSponsorsChanged) this.onSponsorsChanged(snapshot);
    dispatchTombolaEvent(TombolaEvents.SPONSOR_LOADED, { sponsors: snapshot, origin });
  }
}

const sponsorManager = new SponsorManager({
  dataPath: DATA_PATHS.SPONSORS,
  onSponsorsChanged: (sponsors) => {
    renderSponsorShowcase(sponsors, { force: true });
  },
});

// ============================================
// 10. ANIMATION MANAGER CLASS
// ============================================

class AnimationManager {
  constructor(options = {}) {
    this.elements = options.elements || {};
    this.timeline = { ...DRAW_TIMELINE, ...options.timeline };
    this.prefersReducedMotion = false;
    this.motionMatcher = null;
    this.cleanupCallbacks = new Set();

    this._initializeMotionPreferences();
  }

  _initializeMotionPreferences() {
    if (typeof matchMedia !== 'function') return;

    const matcher = matchMedia('(prefers-reduced-motion: reduce)');
    this.motionMatcher = matcher;
    this.prefersReducedMotion = Boolean(matcher.matches);

    const handleChange = (event) => {
      this.prefersReducedMotion = event?.matches ?? matcher.matches;
    };

    if (matcher.addEventListener) {
      matcher.addEventListener('change', handleChange);
      this.cleanupCallbacks.add(() => matcher.removeEventListener('change', handleChange));
    } else if (matcher.addListener) {
      matcher.addListener(handleChange);
      this.cleanupCallbacks.add(() => matcher.removeListener?.(handleChange));
    }
  }

  prefersReducedMotionEnabled() {
    return Boolean(this.prefersReducedMotion);
  }

  setOverlayBallLoading(isLoading) {
    const { drawOverlayBall, drawOverlay } = this.elements;
    if (!drawOverlayBall) return;

    if (isLoading) {
      drawOverlayBall.classList.add(CSS_CLASSES.BALL_LOADING);
      drawOverlayBall.classList.remove(CSS_CLASSES.BALL_REVEALED);
      drawOverlayBall.setAttribute('aria-busy', 'true');
      drawOverlay?.classList.add(CSS_CLASSES.PORTAL_CHARGING);
    } else {
      drawOverlayBall.classList.remove(CSS_CLASSES.BALL_LOADING);
      drawOverlayBall.removeAttribute('aria-busy');
      drawOverlay?.classList.remove(CSS_CLASSES.PORTAL_CHARGING);
    }
  }

  async animateBallFlight(entry, fromRect, targetCell, options = {}) {
    if (!targetCell || !fromRect) return;

    const { prefersReducedMotion = false, duration = this.timeline.flightDuration } = options;

    targetCell.classList.add(CSS_CLASSES.CELL_INCOMING);

    const finalize = () => {
      targetCell.classList.remove(CSS_CLASSES.CELL_INCOMING);
    };

    // Scroll into view
    try {
      targetCell.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'center',
        inline: 'center',
      });
    } catch {
      targetCell.scrollIntoView();
    }

    await waitForScrollIdle({
      timeout: prefersReducedMotion ? 320 : 900,
      idleThreshold: prefersReducedMotion ? 80 : 160,
    });

    if (prefersReducedMotion) {
      await sleep(ANIMATION_DELAYS.SHORT);
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
      } catch {
        cleanup();
      }
    });
  }

  async showDrawAnimation(entry, options = {}) {
    const { onFlightComplete = null } = options;
    const { drawOverlay, drawOverlayNumber, drawOverlayBall, drawOverlayAnnouncement } = this.elements;
    const targetCell = state.cellsByNumber.get(entry.number);

    let flightNotified = false;
    const notifyFlightComplete = () => {
      if (flightNotified) return;
      flightNotified = true;
      if (typeof onFlightComplete === 'function') {
        try {
          onFlightComplete();
        } catch (error) {
          console.warn('Flight complete handler error', error);
        }
      }
    };

    if (!drawOverlay || !drawOverlayNumber || !drawOverlayBall) {
      if (targetCell) {
        try {
          targetCell.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        } catch {
          targetCell.scrollIntoView();
        }
      }
      return false;
    }

    const prefersReducedMotion = this.prefersReducedMotionEnabled();
    const setAnnouncement = (text) => {
      if (drawOverlayAnnouncement) drawOverlayAnnouncement.textContent = text;
    };

    const revealNumber = () => {
      this.setOverlayBallLoading(false);
      drawOverlayNumber.textContent = entry.number;
      drawOverlayBall.classList.add(CSS_CLASSES.BALL_REVEALED);
      setAnnouncement(`Numero ${entry.number}`);
    };

    const hideOverlay = (immediate = false) => {
      drawOverlay.classList.remove(
        CSS_CLASSES.PORTAL_VISIBLE,
        CSS_CLASSES.PORTAL_CLOSING,
        CSS_CLASSES.PORTAL_FLIGHT
      );
      const finalize = () => {
        drawOverlay.setAttribute('aria-hidden', 'true');
        drawOverlay.hidden = true;
      };
      immediate ? finalize() : setTimeout(finalize, 20);
    };

    // Setup
    this.setOverlayBallLoading(true);
    drawOverlayBall.classList.remove(CSS_CLASSES.BALL_REVEALED);
    drawOverlayNumber.textContent = '';
    setAnnouncement('');

    drawOverlay.hidden = false;
    drawOverlay.setAttribute('aria-hidden', 'false');
    drawOverlay.classList.remove(CSS_CLASSES.PORTAL_CLOSING, CSS_CLASSES.PORTAL_FLIGHT);
    drawOverlay.classList.add(CSS_CLASSES.PORTAL_VISIBLE);

    try {
      if (prefersReducedMotion) {
        const fromRect = drawOverlayBall.getBoundingClientRect();
        await sleep(this.timeline.reducedMotionHold);
        revealNumber();

        drawOverlay.classList.add(CSS_CLASSES.PORTAL_FLIGHT);
        if (targetCell) {
          await this.animateBallFlight(entry, fromRect, targetCell, {
            prefersReducedMotion: true,
            duration: this.timeline.reducedMotionFlight,
          });
        } else {
          await sleep(this.timeline.reducedMotionFlight);
        }

        notifyFlightComplete();
        drawOverlay.classList.add(CSS_CLASSES.PORTAL_CLOSING);
        await sleep(this.timeline.overlayHideDelay);
      } else {
        await sleep(this.timeline.intro);
        await sleep(this.timeline.prepareHold);
        await sleep(this.timeline.revealAccent);
        revealNumber();
        await sleep(this.timeline.celebrationHold);

        const fromRect = drawOverlayBall.getBoundingClientRect();
        drawOverlay.classList.add(CSS_CLASSES.PORTAL_CLOSING);
        await sleep(this.timeline.flightDelay);
        
        drawOverlay.classList.add(CSS_CLASSES.PORTAL_FLIGHT);
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
      drawOverlay.classList.remove(CSS_CLASSES.PORTAL_FLIGHT);
      drawOverlayBall.classList.remove(CSS_CLASSES.BALL_REVEALED);
      drawOverlayNumber.textContent = '';
      setAnnouncement('');
    }

    return true;
  }

  getModalRevealDelay() {
    const delay = Number(this.timeline.modalRevealDelay);
    return Number.isFinite(delay) && delay > 0 ? delay : 0;
  }

  destroy() {
    this.cleanupCallbacks.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.warn('Animation cleanup error', error);
      }
    });
    this.cleanupCallbacks.clear();
  }
}

const animationManager = new AnimationManager({ elements, timeline: DRAW_TIMELINE });
registerCleanup(() => animationManager.destroy());

// ============================================
// 11. STORAGE FUNCTIONS
// ============================================

function persistDrawState() {
  if (typeof localStorage === 'undefined') return true;

  try {
    const payload = {
      drawnNumbers: Array.from(state.drawnNumbers),
      drawHistory: state.drawHistory.map((item) => ({ ...item })),
    };
    localStorage.setItem(STORAGE_KEYS.DRAW_STATE, JSON.stringify(payload));
    state.storageErrorMessage = '';
    return true;
  } catch (error) {
    console.warn('Storage persist error', error);
    state.storageErrorMessage = 'Impossibile salvare lo stato della partita.';
    return false;
  }
}

function clearPersistedDrawState() {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.removeItem(STORAGE_KEYS.DRAW_STATE);
    state.storageErrorMessage = '';
  } catch (error) {
    console.warn('Storage clear error', error);
    state.storageErrorMessage = 'Impossibile cancellare lo stato salvato.';
  }
}

function restoreDrawStateFromStorage() {
  if (typeof localStorage === 'undefined') return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEYS.DRAW_STATE);
    if (!stored) {
      state.storageErrorMessage = '';
      return null;
    }

    const parsed = JSON.parse(stored);
    const history = Array.isArray(parsed.drawHistory) ? parsed.drawHistory : [];
    const storedNumbers = Array.isArray(parsed.drawnNumbers)
      ? parsed.drawnNumbers.map(Number).filter(Number.isInteger)
      : [];

    const limitSet = storedNumbers.length ? new Set(storedNumbers) : null;
    const numbersMap = new Map(state.numbers.map((entry) => [entry.number, entry]));
    const seen = new Set();
    let latestEntry = null;

    state.drawnNumbers = new Set();
    sponsorManager.resetAssignments();

    const normalizedHistory = [];

    history.forEach((item) => {
      const number = Number(item.number);
      if (!Number.isInteger(number) || seen.has(number)) return;
      if (limitSet && !limitSet.has(number)) return;

      const entry = numbersMap.get(number);
      if (!entry) return;

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
        if (!Number.isInteger(number) || seen.has(number)) return;

        const entry = numbersMap.get(number);
        if (!entry) return;

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
      if (!entry) return;

      markNumberDrawn(entry, {
        animate: false,
        sponsor: record.sponsor,
        recordHistory: false,
      });
      latestEntry = entry;
    });

    state.drawHistory = normalizedHistory;
    updateDrawHistory();

    if (normalizedHistory.length > 0) persistDrawState();

    state.storageErrorMessage = '';
    return latestEntry;
  } catch (error) {
    console.warn('Storage restore error', error);
    state.storageErrorMessage = 'Impossibile ripristinare lo stato precedente.';
    return null;
  }
}

// ============================================
// 12. AUDIO FUNCTIONS
// ============================================

function initializeAudioPreference() {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEYS.AUDIO);
      if (stored !== null) {
        state.audioEnabled = stored === 'true';
      }
    }
  } catch (error) {
    console.warn('Audio preference read error', error);
  }

  updateAudioToggle();
}

function setAudioEnabled(enabled) {
  state.audioEnabled = Boolean(enabled);

  if (!enabled) stopAudioPlayback();

  updateAudioToggle();

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.AUDIO, enabled ? 'true' : 'false');
    }
  } catch (error) {
    console.warn('Audio preference save error', error);
  }
}

function updateAudioToggle() {
  if (!elements.audioToggle) return;

  const enabled = Boolean(state.audioEnabled);
  elements.audioToggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  const label = enabled ? 'Disattiva annuncio audio' : 'Attiva annuncio audio';
  elements.audioToggle.setAttribute('aria-label', label);
  elements.audioToggle.title = label;
}

function getAudioFilePath(number, variant = 'base') {
  if (typeof number !== 'number' && typeof number !== 'string') return null;

  const trimmed = String(number).trim();
  if (!trimmed) return null;

  const suffix = variant === 'italian' ? '_it' : variant === 'dialect' ? '_nj' : '';
  return `audio/${trimmed}${suffix}.mp3`;
}

function stopAudioPlayback() {
  state.audioPlaybackToken += 1;

  if (state.currentAudio) {
    try {
      state.currentAudio.pause();
      state.currentAudio.currentTime = 0;
    } catch (error) {
      console.warn('Audio stop error', error);
    }
    state.currentAudio = null;
  }
}

function playAudioSequence(sequence) {
  if (!Array.isArray(sequence) || sequence.length === 0) return null;

  stopAudioPlayback();
  const token = state.audioPlaybackToken;

  return new Promise((resolve) => {
    let finished = false;
    let requiredPlayed = false;

    const conclude = (success) => {
      if (finished) return;
      finished = true;
      if (state.currentAudio) {
        try {
          state.currentAudio.pause();
        } catch (error) {
          console.warn('Audio cleanup error', error);
        }
        state.currentAudio = null;
      }
      resolve(success);
    };

    const playNext = () => {
      if (finished) return;
      if (token !== state.audioPlaybackToken) {
        conclude(false);
        return;
      }

      const next = sequence.shift();
      if (!next || !next.src) {
        conclude(requiredPlayed);
        return;
      }

      const audio = new Audio(next.src);
      state.currentAudio = audio;

      const cleanup = () => {
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('error', handleError);
        if (state.currentAudio === audio) {
          state.currentAudio = null;
        }
      };

      const handleEnded = () => {
        cleanup();
        playNext();
      };

      const handleError = () => {
        cleanup();
        if (next.required) {
          conclude(false);
        } else {
          playNext();
        }
      };

      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('error', handleError);

      try {
        const result = audio.play();
        if (result && typeof result.then === 'function') {
          result
            .then(() => {
              if (next.required) requiredPlayed = true;
            })
            .catch(() => {
              handleError();
            });
        } else if (next.required) {
          requiredPlayed = true;
        }
      } catch (error) {
        handleError();
      }
    };

    playNext();
  });
}

function playEntryAudio(entry) {
  if (!entry) return null;

  const baseSource = getAudioFilePath(entry.number, 'base');
  if (!baseSource) return null;

  const sequence = [{ src: baseSource, required: true }];

  if (entry.dialect?.trim()) {
    const dialectSource = getAudioFilePath(entry.number, 'dialect');
    if (dialectSource) sequence.push({ src: dialectSource, required: false });
  }

  if (entry.italian?.trim()) {
    const italianSource = getAudioFilePath(entry.number, 'italian');
    if (italianSource) sequence.push({ src: italianSource, required: false });
  }

  return playAudioSequence(sequence);
}

function playEntryVariant(entry, variant) {
  if (!entry || !state.audioEnabled) return null;

  const source = getAudioFilePath(entry.number, variant);
  if (!source) return null;

  return playAudioSequence([{ src: source, required: true }]);
}

function announceEntry(entry) {
  if (!entry) return;

  if (!state.audioEnabled) return;

  playEntryAudio(entry);
}

// ============================================
// 13. SPONSOR UI FUNCTIONS
// ============================================

function setupSponsorLink(anchor, sponsor) {
  if (!anchor) return;

  const hasUrl = typeof sponsor?.url === 'string' && sponsor.url.trim();

  if (hasUrl) {
    const safeUrl = sanitizeUrl(sponsor.url);
    const isExternal = /^https?:\/\//i.test(safeUrl);
    anchor.href = safeUrl;
    anchor.target = isExternal ? '_blank' : '_self';
    anchor.rel = isExternal ? 'noopener noreferrer' : '';
    anchor.removeAttribute('tabindex');
    anchor.setAttribute('aria-label', getSponsorAccessibleLabel(sponsor));
    anchor.classList.remove('sponsor-card--static');

    const displayName = getSponsorDisplayName(sponsor);
    if (displayName) {
      anchor.title = displayName;
    } else {
      anchor.removeAttribute('title');
    }
  } else {
    anchor.removeAttribute('href');
    anchor.removeAttribute('target');
    anchor.removeAttribute('rel');
    anchor.removeAttribute('aria-label');
    anchor.removeAttribute('title');
    anchor.setAttribute('tabindex', '-1');
    anchor.classList.add('sponsor-card--static');
  }
}

function updateSponsorBlock(blockElements, sponsor, options = {}) {
  if (!blockElements) return;

  const { block, anchor, logo } = blockElements;
  const { showPlaceholder = false, preferLazy = false } = options;

  if (!block || !anchor || !logo) return;

  const placeholderClass = 'sponsor-block--placeholder';

  if (!sponsor) {
    block.hidden = !showPlaceholder;
    block.setAttribute('aria-hidden', showPlaceholder ? 'false' : 'true');
    block.classList.toggle(placeholderClass, showPlaceholder);

    anchor.classList.toggle('sponsor-card--placeholder', showPlaceholder);
    anchor.classList.add('sponsor-card--static');
    anchor.removeAttribute('href');
    anchor.removeAttribute('target');
    anchor.removeAttribute('rel');
    anchor.removeAttribute('aria-label');
    anchor.removeAttribute('title');
    anchor.setAttribute('tabindex', '-1');
    if (showPlaceholder) {
      anchor.setAttribute('aria-hidden', 'true');
    } else {
      anchor.removeAttribute('aria-hidden');
    }

    logo.hidden = true;
    logo.removeAttribute('src');
    logo.alt = '';
    if ('loading' in logo) logo.loading = preferLazy ? 'lazy' : 'eager';
    return;
  }

  block.hidden = false;
  block.removeAttribute('hidden');
  block.setAttribute('aria-hidden', 'false');
  block.classList.remove(placeholderClass);

  anchor.classList.remove('sponsor-card--placeholder');
  anchor.removeAttribute('aria-hidden');
  setupSponsorLink(anchor, sponsor);

  if ('loading' in logo) logo.loading = preferLazy ? 'lazy' : 'eager';
  logo.hidden = false;
  logo.removeAttribute('hidden');
  const logoSrc = sponsor.logo?.trim() || '';
  if (logoSrc && logo.src !== logoSrc) logo.src = logoSrc;
  logo.alt = '';

}

function applySponsorToOverlay(sponsor) {
  updateSponsorBlock(
    {
      block: elements.drawSponsorBlock,
      anchor: elements.drawSponsor,
      logo: elements.drawSponsorLogo,
    },
    sponsor,
    { 
      preferLazy: false, 
      showPlaceholder: !sponsor && state.sponsorLoadingState === LoadingStates.ERROR 
    }
  );

  if (elements.drawOverlay) {
    elements.drawOverlay.classList.toggle('draw-portal--has-sponsor', Boolean(sponsor));
  }
}

function applySponsorToModal(sponsor) {
  updateSponsorBlock(
    {
      block: elements.modalSponsorBlock,
      anchor: elements.modalSponsor,
      logo: elements.modalSponsorLogo,
    },
    sponsor,
    { 
      preferLazy: false, 
      showPlaceholder: !sponsor && state.sponsorLoadingState === LoadingStates.ERROR 
    }
  );
}

function ensureModalSponsor(entry, options = {}) {
  if (!entry) {
    applySponsorToModal(null);
    return;
  }

  const { fromDraw = false } = options;
  const storedSponsor = sponsorManager.getAssignment(entry.number);
  
  if (storedSponsor) {
    applySponsorToModal(storedSponsor);
    return;
  }

  const currentSponsor = sponsorManager.getCurrentSponsor();

  if (fromDraw && currentSponsor) {
    const remembered = sponsorManager.assignToNumber(entry.number, currentSponsor);
    applySponsorToModal(remembered);
    return;
  }

  const selectRandomSponsor = () => {
    const previousKey = sponsorManager.lastSponsorKey;
    const randomSponsor = sponsorManager.pickRandom(previousKey);
    if (randomSponsor) sponsorManager.lastSponsorKey = getSponsorKey(randomSponsor);
    return randomSponsor || null;
  };

  const immediateRandom = selectRandomSponsor();
  if (immediateRandom) {
    applySponsorToModal(immediateRandom);
    return;
  }

  applySponsorToModal(null);

  const pending = sponsorManager.loadPromise || 
    (sponsorManager.hasSponsors() ? Promise.resolve(sponsorManager.getAllSponsors()) : loadSponsors());

  pending
    .then(() => {
      const updatedStored = sponsorManager.getAssignment(entry.number);
      if (updatedStored) {
        applySponsorToModal(updatedStored);
        return;
      }

      const latestCurrent = sponsorManager.getCurrentSponsor();
      if (fromDraw && latestCurrent) {
        const remembered = sponsorManager.assignToNumber(entry.number, latestCurrent);
        if (remembered) {
          applySponsorToModal(remembered);
          return;
        }
      }

      const refreshed = selectRandomSponsor();
      applySponsorToModal(refreshed);
    })
    .catch(() => {
      const fallbackStored = sponsorManager.getAssignment(entry.number);
      applySponsorToModal(fallbackStored);
    });
}

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
      console.warn('Sponsor preparation error', error);
      sponsorManager.clearCurrentSponsor();
      setSponsorLoadingState(LoadingStates.ERROR);
      applySponsorToOverlay(null);
      return null;
    });
}

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
      console.warn('Sponsors load error', error);
      setSponsorLoadingState(LoadingStates.ERROR);
      applySponsorToOverlay(null);
      throw error;
    });
}

function renderSponsorShowcase(sponsors, options = {}) {
  const { force = false } = options;

  if (!elements.sponsorShowcase || !elements.sponsorShowcaseList) return;

  if (!Array.isArray(sponsors) || sponsors.length === 0) {
    elements.sponsorShowcaseList.innerHTML = '';
    elements.sponsorShowcase.hidden = true;
    state.sponsorShowcaseRendered = false;
    return;
  }

  if (state.sponsorShowcaseRendered && !force) return;

  elements.sponsorShowcaseList.innerHTML = '';

  sponsors.forEach((sponsor) => {
    if (!sponsor?.logo?.trim()) return;

    const item = document.createElement('li');
    item.className = 'sponsor-strip__item';

    const hasUrl = Boolean(sponsor.url?.trim());
    const container = document.createElement(hasUrl ? 'a' : 'div');
    container.className = 'sponsor-card sponsor-strip__card';

    if (hasUrl) {
      setupSponsorLink(container, sponsor);
    } else {
      container.classList.add('sponsor-card--static');
      container.setAttribute('role', 'presentation');
    }

    const logo = document.createElement('img');
    logo.className = 'sponsor-card__logo';
    logo.alt = '';
    logo.src = sponsor.logo.trim();
    if ('decoding' in logo) logo.decoding = 'async';
    if ('loading' in logo) logo.loading = 'lazy';

    container.appendChild(logo);
    item.appendChild(container);
    elements.sponsorShowcaseList.appendChild(item);
  });

  elements.sponsorShowcase.hidden = false;
  elements.sponsorShowcase.removeAttribute('aria-hidden');
  state.sponsorShowcaseRendered = true;

  restartSponsorRotation();
}

// ============================================
// 14. BOARD RENDERING
// ============================================

function getNumberIllustration(entry) {
  const number = Math.trunc(Number(entry?.number));
  if (!Number.isFinite(number) || number <= 0) return '';
  return `images/illustrazioni/${number}.png`;
}

function resolveIllustrationFit(url) {
  if (!url) return Promise.resolve('contain');

  if (illustrationFitCache.has(url)) {
    return Promise.resolve(illustrationFitCache.get(url));
  }

  return new Promise((resolve) => {
    const image = new Image();

    const finalize = (value) => {
      const fitValue = value || 'contain';
      illustrationFitCache.set(url, fitValue);
      resolve(fitValue);
    };

    image.onload = () => {
      const { naturalWidth: width = 0, naturalHeight: height = 0 } = image;
      if (width > 0 && height > 0) {
        finalize(width >= height ? '100% auto' : 'auto 100%');
      } else {
        finalize('contain');
      }
    };

    image.onerror = () => finalize('contain');

    image.decoding = 'async';
    image.src = url;
  });
}

function applyBackgroundFit(element, url, options = {}) {
  const { sizeProperty, forceSize } = options;

  if (!(element instanceof HTMLElement)) return;

  if (!url) {
    if (sizeProperty) {
      element.style.removeProperty(sizeProperty);
    } else {
      element.style.removeProperty('background-size');
    }
    delete element.dataset.illustrationSource;
    return;
  }

  element.dataset.illustrationSource = url;

  const applySize = (value) => {
    if (element.dataset.illustrationSource !== url) return;
    const sizeValue = value || 'contain';
    if (sizeProperty) {
      element.style.setProperty(sizeProperty, sizeValue);
    } else {
      element.style.backgroundSize = sizeValue;
    }
  };

  if (forceSize) {
    applySize(forceSize);
    return;
  }

  applySize('contain');

  resolveIllustrationFit(url).then(applySize).catch(() => {
    if (element.dataset.illustrationSource !== url) return;
    applySize('contain');
  });
}

function buildBoardCellLabel(entry, { drawn = false } = {}) {
  if (!entry) return '';

  const labelParts = [`Numero ${entry.number}`];

  const italian = entry.italian?.trim();
  const dialect = entry.dialect?.trim();

  if (italian) {
    labelParts.push(italian);
  } else if (dialect) {
    labelParts.push(dialect);
  }

  labelParts.push(drawn ? 'Estratto' : 'Disponibile');

  return labelParts.join(' – ');
}

function syncBoardCellAccessibility(cell, entry, { drawn = false } = {}) {
  if (!cell || !entry) return;

  const srLabel = cell.querySelector('.sr-only');
  if (srLabel) srLabel.textContent = buildBoardCellLabel(entry, { drawn });
}

function renderBoard() {
  if (!elements.board || !elements.template) return;

  elements.board.innerHTML = '';
  state.cellsByNumber = new Map();
  state.selected = null;
  state.entriesByNumber = new Map();

  const fragment = document.createDocumentFragment();

  state.numbers.forEach((entry) => {
    state.entriesByNumber.set(entry.number, entry);
    const cell = elements.template.content.firstElementChild.cloneNode(true);
    cell.dataset.number = entry.number;

    const numberEl = cell.querySelector('.board-cell__number');
    if (numberEl) numberEl.textContent = entry.number;

    const imageEl = cell.querySelector('.board-cell__image');
    if (imageEl) {
      const fallbackSrc = 'images/caselle/casella.png';
      const desiredSrc = `images/caselle/${entry.number}.png`;

      imageEl.src = desiredSrc;
      imageEl.onerror = () => {
        imageEl.onerror = null;
        imageEl.src = fallbackSrc;
      };
    }

    const tokenNumberEl = cell.querySelector('.board-cell__token-number');
    if (tokenNumberEl) tokenNumberEl.textContent = entry.number;

    const isDrawn = state.drawnNumbers.has(entry.number);
    cell.classList.toggle(CSS_CLASSES.CELL_DRAWN, isDrawn);
    cell.setAttribute('aria-pressed', isDrawn ? 'true' : 'false');
    syncBoardCellAccessibility(cell, entry, { drawn: isDrawn });

    state.cellsByNumber.set(entry.number, cell);
    fragment.appendChild(cell);
  });

  elements.board.appendChild(fragment);
}

function handleBoardCellClick(event) {
  const cell = event.target.closest('.board-cell');
  if (!cell || !elements.board?.contains(cell)) return;

  const number = Number(cell.dataset.number);
  if (!Number.isInteger(number)) return;

  const entry = state.entriesByNumber.get(number);
  if (entry) handleSelection(entry, cell);
}

// ============================================
// 15. HISTORY PANEL
// ============================================

function updateHistoryToggleText() {
  if (!elements.historyToggle) return;

  const label = state.historyOpen ? 'Chiudi cronologia' : 'Cronologia';
  elements.historyToggle.setAttribute('aria-label', label);
  elements.historyToggle.title = label;
}

function syncHistoryPanelToLayout(options = {}) {
  const { immediate = false } = options;

  if (!elements.historyPanel) {
    state.historyOpen = false;
    updateHistoryToggleText();
    return;
  }

  elements.historyPanel.hidden = !state.historyOpen;
  elements.historyPanel.classList.toggle(CSS_CLASSES.HISTORY_OPEN, state.historyOpen);
  
  if (elements.historyToggle) {
    elements.historyToggle.setAttribute('aria-expanded', state.historyOpen ? 'true' : 'false');
  }
  
  updateHistoryToggleText();

  if (!elements.historyScrim) return;

  const shouldShowScrim = state.historyOpen && !state.fullscreenActive;

  if (shouldShowScrim) {
    elements.historyScrim.hidden = false;
    requestAnimationFrame(() => {
      elements.historyScrim.classList.add('history-scrim--visible');
    });
  } else {
    elements.historyScrim.classList.remove('history-scrim--visible');
    const finalizeHide = () => {
      if (!shouldShowScrim) {
        elements.historyScrim.hidden = true;
      }
      elements.historyScrim.removeEventListener('transitionend', finalizeHide);
    };

    if (immediate) {
      finalizeHide();
    } else {
      elements.historyScrim.addEventListener('transitionend', finalizeHide);
      setTimeout(finalizeHide, 520);
    }
  }
}

function openHistoryPanel() {
  if (state.historyOpen) return;
  state.historyOpen = true;
  syncHistoryPanelToLayout();
  setTimeout(() => {
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
  state.historyOpen ? closeHistoryPanel() : openHistoryPanel();
}

function updateDrawHistory() {
  if (!elements.historyList) return;

  const draws = state.drawHistory;
  elements.historyList.innerHTML = '';

  if (draws.length === 0) {
    elements.historyList.hidden = true;
    if (elements.historyEmpty) {
      elements.historyEmpty.hidden = false;
    }
    return;
  }

  if (elements.historyEmpty) {
    elements.historyEmpty.hidden = true;
  }

  elements.historyList.hidden = false;

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
    const italianValue = item.italian?.trim() || '';
    italianLine.textContent = `Italiano: ${italianValue || '—'}`;
    if (!italianValue) italianLine.classList.add('history-item__lang--empty');
    meta.appendChild(italianLine);

    const dialectLine = document.createElement('span');
    dialectLine.className = 'history-item__lang history-item__lang--dialect';
    const dialectValue = item.dialect?.trim() || '';
    dialectLine.textContent = `Nojano: ${dialectValue || '—'}`;
    if (!dialectValue) dialectLine.classList.add('history-item__lang--empty');
    meta.appendChild(dialectLine);

    details.appendChild(meta);
    listItem.appendChild(details);
    elements.historyList.appendChild(listItem);
  }

  const prefersReducedMotion = animationManager?.prefersReducedMotionEnabled() || 
    matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

  if (typeof elements.historyList.scrollTo === 'function') {
    elements.historyList.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  } else {
    elements.historyList.scrollTop = 0;
  }
}

// ============================================
// 16. FULLSCREEN MODE
// ============================================

function getNativeFullscreenElement() {
  return document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement ||
    null;
}

function updateFullscreenToggleLabel(active) {
  const label = active ? 'Esci da schermo intero' : 'Schermo intero';

  if (elements.fullscreenToggleLabel) {
    elements.fullscreenToggleLabel.textContent = label;
  }

  if (elements.fullscreenToggle) {
    elements.fullscreenToggle.setAttribute('aria-pressed', active ? 'true' : 'false');
    elements.fullscreenToggle.setAttribute('aria-label', label);
    elements.fullscreenToggle.title = label;
  }
}

function placeHistoryInSidebar() {
  if (!elements.historyPanel || !elements.fullscreenToggle) return;

  if (!state.historyOriginalParent) {
    state.historyOriginalParent = elements.historyPanel.parentElement;
    state.historyOriginalNextSibling = elements.historyPanel.nextSibling;
  }

  const dashboardGrid = document.querySelector('.dashboard__grid');
  if (dashboardGrid && elements.historyPanel.parentElement !== dashboardGrid) {
    dashboardGrid.appendChild(elements.historyPanel);
    elements.historyPanel.classList.add('history--sidebar');
  }
}

function restoreHistoryPlacement() {
  if (!elements.historyPanel || !state.historyOriginalParent) return;

  const { historyOriginalParent: parent, historyOriginalNextSibling: nextSibling } = state;
  if (elements.historyPanel.parentElement !== parent) {
    parent.insertBefore(elements.historyPanel, nextSibling);
  }
  elements.historyPanel.classList.remove('history--sidebar');
}

function startSponsorRotation() {
  if (!state.fullscreenActive || state.sponsorRotationTimer || !elements.sponsorShowcaseList) return;

  const list = elements.sponsorShowcaseList;
  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

  list.style.removeProperty('--sponsor-scroll-distance');
  list.style.removeProperty('--sponsor-scroll-duration');
  list.style.removeProperty('--sponsor-visible-height');
  list.style.removeProperty('height');
  list.classList.remove('sponsor-strip--scrolling');
  list.classList.remove('sponsor-strip--marquee');
  list.style.removeProperty('transform');

  list.querySelectorAll('.sponsor-strip__item--clone').forEach((node) => node.remove());

  const items = Array.from(list.querySelectorAll('.sponsor-strip__item'));
  if (items.length === 0) return;

  const visibleCount = Math.min(SponsorMarqueeConfig.VISIBLE_COUNT, items.length);
  const listStyles = getComputedStyle(list);
  const gapValue = parseFloat(listStyles.rowGap || listStyles.gap || '0') || 0;

  // Force reflow for accurate measurements
  list.offsetHeight;

  const measuredHeights = items.map((item) => {
    const rect = item.getBoundingClientRect();
    return rect.height || item.offsetHeight || SponsorMarqueeConfig.FALLBACK_ITEM_HEIGHT;
  });

  const maxHeight = Math.max(...measuredHeights, SponsorMarqueeConfig.FALLBACK_ITEM_HEIGHT);
  const visibleHeight = maxHeight * visibleCount + gapValue * Math.max(visibleCount - 1, 0);

  if (visibleHeight > 0) {
    list.style.setProperty('--sponsor-visible-height', `${visibleHeight}px`);
    list.style.height = `${visibleHeight}px`;
  }

  const hasEnoughSponsors = items.length > visibleCount;
  if (!hasEnoughSponsors || prefersReducedMotion) {
    state.sponsorRotationTimer = true;
    return;
  }

  let offset = 0;
  let lastTimestamp = null;
  const averageHeight = measuredHeights.reduce((sum, value) => sum + value, 0) / measuredHeights.length || SponsorMarqueeConfig.FALLBACK_ITEM_HEIGHT;

  const step = (timestamp) => {
    if (!state.fullscreenActive) {
      stopSponsorRotation();
      return;
    }

    if (lastTimestamp === null) {
      lastTimestamp = timestamp;
      state.sponsorRotationTimer = requestAnimationFrame(step);
      return;
    }

    const deltaSeconds = Math.max(0, Math.min(0.05, (timestamp - lastTimestamp) / 1000));
    lastTimestamp = timestamp;

    offset += deltaSeconds * SponsorMarqueeConfig.PIXELS_PER_SECOND;

    let firstItem = list.firstElementChild;
    let guard = 0;

    const measureDistance = (item) => {
      const rect = item?.getBoundingClientRect?.();
      const height = (rect?.height || item?.offsetHeight || averageHeight);
      return height + gapValue;
    };

    while (firstItem && offset >= measureDistance(firstItem)) {
      offset -= measureDistance(firstItem);
      list.appendChild(firstItem);
      firstItem = list.firstElementChild;
      guard += 1;
      if (guard > items.length * 2) break;
    }

    list.style.transform = `translateY(-${offset}px)`;
    list.classList.add('sponsor-strip--marquee');
    state.sponsorRotationTimer = requestAnimationFrame(step);
  };

  state.sponsorRotationTimer = requestAnimationFrame(step);
}

function stopSponsorRotation() {
  if (typeof state.sponsorRotationTimer === 'number') {
    cancelAnimationFrame(state.sponsorRotationTimer);
  }

  if (elements.sponsorShowcaseList) {
    const list = elements.sponsorShowcaseList;
    list.scrollTop = 0;
    list.style.removeProperty('transform');
    list.style.removeProperty('--sponsor-scroll-distance');
    list.style.removeProperty('--sponsor-scroll-duration');
    list.style.removeProperty('--sponsor-visible-height');
    list.style.removeProperty('height');
    list.classList.remove('sponsor-strip--scrolling');
    list.classList.remove('sponsor-strip--marquee');
  }

  state.sponsorRotationTimer = null;
}

function restartSponsorRotation() {
  stopSponsorRotation();
  if (state.fullscreenActive) {
    startSponsorRotation();
  }
}

function applyFullscreenLayoutState(active) {
  if (state.fullscreenActive === active) {
    updateFullscreenToggleLabel(active);
    return;
  }

  const wasHistoryOpen = state.historyOpen;
  state.fullscreenActive = active;
  document.body.classList.toggle('is-fullscreen', active);
  updateFullscreenToggleLabel(active);

  if (active) {
    state.historyWasOpenBeforeFullscreen = wasHistoryOpen;
    placeHistoryInSidebar();
    openHistoryPanel({ immediate: true });
    startSponsorRotation();
  } else {
    if (!state.historyWasOpenBeforeFullscreen) {
      closeHistoryPanel({ immediate: true });
    }
    stopSponsorRotation();
    restoreHistoryPlacement();
    state.historyWasOpenBeforeFullscreen = false;
  }

  syncHistoryPanelToLayout({ immediate: true });
}

async function enterFullscreenMode() {
  applyFullscreenLayoutState(true);

  const target = document.documentElement;
  const requestFullscreen = target.requestFullscreen ||
    target.webkitRequestFullscreen ||
    target.mozRequestFullScreen ||
    target.msRequestFullscreen;

  if (typeof requestFullscreen === 'function') {
    try {
      await requestFullscreen.call(target);
    } catch (error) {
      console.warn('Fullscreen request failed', error);
    }
  }
}

async function exitFullscreenMode() {
  const exitFullscreen = document.exitFullscreen ||
    document.webkitExitFullscreen ||
    document.mozCancelFullScreen ||
    document.msExitFullscreen;

  if (typeof exitFullscreen === 'function') {
    try {
      await exitFullscreen.call(document);
    } catch (error) {
      console.warn('Exit fullscreen failed', error);
      applyFullscreenLayoutState(false);
    }
  } else {
    applyFullscreenLayoutState(false);
  }
}

function toggleFullscreenMode() {
  const active = state.fullscreenActive || Boolean(getNativeFullscreenElement());
  if (active) {
    exitFullscreenMode();
  } else {
    enterFullscreenMode();
  }
}

function handleFullscreenChange() {
  const active = Boolean(getNativeFullscreenElement());
  applyFullscreenLayoutState(active);
}

// ============================================
// 17. GAME LOGIC
// ============================================

function markNumberDrawn(entry, options = {}) {
  if (!entry) return;

  const { animate = false, sponsor: sponsorOverride = null, recordHistory = true } = options;
  const number = entry.number;

  if (state.drawnNumbers.has(number)) return;

  const previousDrawnNumbers = new Set(state.drawnNumbers);
  const previousHistoryLength = state.drawHistory.length;
  const hadStoredSponsor = sponsorManager.hasAssignment(number);
  const previousSponsor = hadStoredSponsor ? sponsorManager.getAssignment(number) : null;

  state.drawnNumbers.add(number);

  const activeSponsor = sponsorOverride || sponsorManager.getCurrentSponsor();
  const sponsorData = sponsorManager.assignToNumber(number, activeSponsor);
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

  if (state.storageErrorMessage) updateDrawStatus();

  const cell = state.cellsByNumber.get(number);
  if (cell) {
    const isDrawn = state.drawnNumbers.has(number);
    cell.classList.toggle(CSS_CLASSES.CELL_DRAWN, isDrawn);
    cell.setAttribute('aria-pressed', isDrawn ? 'true' : 'false');
    syncBoardCellAccessibility(cell, entry, { drawn: isDrawn });

    if (isDrawn && animate) {
      cell.classList.add(CSS_CLASSES.CELL_JUST_DRAWN);
      const handleAnimationEnd = (event) => {
        if (event?.animationName && event.animationName !== 'boardCellCelebrate') return;
        cell.classList.remove(CSS_CLASSES.CELL_JUST_DRAWN);
        cell.removeEventListener('animationend', handleAnimationEnd);
      };
      cell.addEventListener('animationend', handleAnimationEnd);
      setTimeout(() => cell.classList.remove(CSS_CLASSES.CELL_JUST_DRAWN), 900);
    }
  }

  if (shouldNotify && recordHistory) {
    dispatchTombolaEvent(TombolaEvents.NUMBER_DRAWN, {
      entry: { number, italian: entry.italian || '', dialect: entry.dialect || '' },
      sponsor: sponsorPayload,
      animate,
    });
  }
}

async function handleDraw() {
  if (state.isAnimatingDraw) return;
  if (state.historyOpen) closeHistoryPanel();

  const remaining = state.numbers.filter((entry) => !state.drawnNumbers.has(entry.number));
  if (!remaining.length) {
    updateDrawStatus();
    return;
  }

  const modalWasOpen = elements.modal && !elements.modal.hasAttribute('hidden');
  if (modalWasOpen) closeModal({ returnFocus: false });

  const entry = remaining[Math.floor(Math.random() * remaining.length)];

  state.isAnimatingDraw = true;
  let restoreDrawButton = false;
  let markRecorded = false;
  let shouldDelayModal = false;

  try {
    await prepareSponsorForNextDraw();

    if (elements.drawButton) {
      restoreDrawButton = !elements.drawButton.disabled;
      elements.drawButton.disabled = true;
    }

    try {
      if (animationManager?.showDrawAnimation) {
        const didAnimate = await animationManager.showDrawAnimation(entry, {
          onFlightComplete: () => {
            if (!markRecorded) {
              markNumberDrawn(entry, { animate: true });
              markRecorded = true;
            }
          },
        });
        shouldDelayModal = didAnimate && animationManager.getModalRevealDelay() > 0;
      }
    } catch (error) {
      console.warn('Animation error', error);
    }

    if (!markRecorded) {
      markNumberDrawn(entry, { animate: true });
      markRecorded = true;
    }
  } finally {
    state.isAnimatingDraw = false;
    if (elements.drawButton && restoreDrawButton) elements.drawButton.disabled = false;
  }

  if (shouldDelayModal) {
    await sleep(animationManager.getModalRevealDelay());
  }

  handleSelection(entry, state.cellsByNumber.get(entry.number), { fromDraw: true });
  updateDrawStatus(entry);
}

function performGameReset() {
  if (!state.numbers.length) return;

  const drawnBeforeReset = state.drawnNumbers.size;

  if (!elements.modal.hasAttribute('hidden')) closeModal({ returnFocus: false });

  if (elements.drawOverlay && !elements.drawOverlay.hasAttribute('hidden')) {
    elements.drawOverlay.classList.remove(CSS_CLASSES.PORTAL_VISIBLE, CSS_CLASSES.PORTAL_CLOSING);
    elements.drawOverlay.hidden = true;
  }
  
  state.isAnimatingDraw = false;
  sponsorManager.clearCurrentSponsor();
  applySponsorToOverlay(null);

  stopAudioPlayback();

  state.drawnNumbers.clear();
  state.drawHistory = [];
  sponsorManager.resetAssignments();
  updateDrawHistory();
  clearPersistedDrawState();
  if (state.storageErrorMessage) updateDrawStatus();

  state.cellsByNumber.forEach((cell, number) => {
    cell.classList.remove(CSS_CLASSES.CELL_DRAWN, CSS_CLASSES.CELL_ACTIVE);
    cell.setAttribute('aria-pressed', 'false');
    const entry = state.entriesByNumber.get(number);
    syncBoardCellAccessibility(cell, entry, { drawn: false });
  });

  state.selected = null;
  updateDrawStatus();
  
  if (elements.drawStatus && !state.storageErrorMessage) {
    elements.drawStatus.textContent = 'Tabellone azzerato. Pronto a estrarre il primo numero!';
  }

  elements.drawButton?.focus();

  dispatchTombolaEvent(TombolaEvents.GAME_RESET, {
    drawnCount: drawnBeforeReset,
    totalNumbers: state.numbers.length,
  });
}

function resetGame() {
  if (!state.numbers.length) return;

  closeHistoryPanel({ immediate: true });

  if (state.drawnNumbers.size > 0) {
    const handled = openResetDialog();
    if (handled) return;

    const shouldReset = confirm('Vuoi ricominciare la partita? Tutti i numeri estratti verranno azzerati.');
    if (!shouldReset) return;
  }

  performGameReset();
}

// ============================================
// 18. MODALS
// ============================================

function handleSelection(entry, cell, options = {}) {
  if (!entry) return;

  const targetCell = cell || state.cellsByNumber.get(entry.number);
  if (!targetCell) return;

  const { fromDraw = false } = options;

  if (state.selected) {
    state.selected.classList.remove(CSS_CLASSES.CELL_ACTIVE);
  }
  state.selected = targetCell;
  targetCell.classList.add(CSS_CLASSES.CELL_ACTIVE);

  openModal(entry, { fromDraw });
  announceEntry(entry);
}

function applyModalIllustration(frameEl, entry) {
  if (!(frameEl instanceof HTMLElement)) return;

  const illustration = getNumberIllustration(entry);

  if (illustration) {
    const trimmedItalian = entry?.italian?.trim();
    const label = trimmedItalian
      ? `Illustrazione del numero ${entry.number}: ${trimmedItalian}`
      : `Illustrazione del numero ${entry.number}`;

    frameEl.style.backgroundImage = `url('${illustration}')`;
    applyBackgroundFit(frameEl, illustration, { forceSize: 'contain' });
    frameEl.classList.remove('number-dialog__visual--placeholder');
    frameEl.setAttribute('aria-label', label);
    frameEl.removeAttribute('aria-hidden');
  } else {
    frameEl.style.removeProperty('background-image');
    applyBackgroundFit(frameEl, '');
    frameEl.classList.add('number-dialog__visual--placeholder');
    frameEl.removeAttribute('aria-label');
    frameEl.setAttribute('aria-hidden', 'true');
  }
}

function openModal(entry, options = {}) {
  const { fromDraw = false } = options;

  const paddedNumber = String(entry.number).padStart(2, '0');
  elements.modalNumber.textContent = `Numero ${paddedNumber}`;
  if (elements.modal) {
    elements.modal.setAttribute('data-number', paddedNumber);
  }

  const hasItalian = Boolean(entry.italian?.trim());
  const hasDialect = Boolean(entry.dialect?.trim());

  if (elements.modalItalian) {
    elements.modalItalian.textContent = hasItalian ? entry.italian.trim() : '—';
    elements.modalItalian.classList.toggle('number-dialog__phrase--empty', !hasItalian);
  }

  if (elements.modalDialect) {
    elements.modalDialect.textContent = hasDialect ? entry.dialect.trim() : '—';
    elements.modalDialect.classList.toggle('number-dialog__phrase--empty', !hasDialect);
  }

  if (elements.modalItalianCard) {
    elements.modalItalianCard.disabled = !hasItalian;
  }

  if (elements.modalDialectCard) {
    elements.modalDialectCard.disabled = !hasDialect;
  }

  if (elements.modalImageFrame) {
    applyModalIllustration(elements.modalImageFrame, entry);
  }

  ensureModalSponsor(entry, { fromDraw });

  elements.modal.removeAttribute('hidden');
  elements.modal.classList.add(CSS_CLASSES.MODAL_VISIBLE);
  document.body.classList.add(CSS_CLASSES.MODAL_OPEN);

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
      focusTarget = elements.modalNext;
    }
  }

  focusTarget.focus();
}

function closeModal(options = {}) {
  const { returnFocus = true } = options instanceof Event ? {} : options;

  stopAudioPlayback();

  releaseActiveFocusTrap(elements.modal);
  elements.modal.classList.remove(CSS_CLASSES.MODAL_VISIBLE);
  elements.modal.setAttribute('hidden', '');
  document.body.classList.remove(CSS_CLASSES.MODAL_OPEN);
  
  if (elements.modalNext) {
    elements.modalNext.hidden = true;
    elements.modalNext.disabled = true;
  }
  
  applySponsorToModal(null);

  if (returnFocus && state.selected && document.body.contains(state.selected)) {
    state.selected.focus();
  } else {
    state.selected = null;
  }
}

function openResetDialog() {
  if (!elements.resetDialog || !elements.resetDialog.hasAttribute('hidden')) {
    return true;
  }

  state.resetDialogTrigger = document.activeElement instanceof HTMLElement 
    ? document.activeElement 
    : elements.resetButton;

  state.resetDialogOpen = true;
  elements.resetDialog.removeAttribute('hidden');
  elements.resetDialog.classList.add(CSS_CLASSES.MODAL_VISIBLE);
  document.body.classList.add(CSS_CLASSES.MODAL_OPEN);

  activateModalFocusTrap(elements.resetDialog);

  const focusTarget = elements.resetDialogConfirm || elements.resetDialogCancelButtons[0] || elements.resetButton;
  requestAnimationFrame(() => focusTarget?.focus());

  return true;
}

function closeResetDialog(options = {}) {
  const { returnFocus = true } = options instanceof Event ? {} : options;

  state.resetDialogOpen = false;
  const shouldRestoreModalTrap = Boolean(elements.modal) && !elements.modal.hasAttribute('hidden');

  releaseActiveFocusTrap(elements.resetDialog);

  if (!elements.resetDialog) {
    if (shouldRestoreModalTrap) activateModalFocusTrap(elements.modal);
    if (returnFocus && state.resetDialogTrigger instanceof HTMLElement) {
      state.resetDialogTrigger.focus();
    }
    state.resetDialogTrigger = null;
    if (!elements.modal || elements.modal.hasAttribute('hidden')) {
      document.body.classList.remove(CSS_CLASSES.MODAL_OPEN);
    }
    return;
  }

  elements.resetDialog.classList.remove(CSS_CLASSES.MODAL_VISIBLE);
  elements.resetDialog.setAttribute('hidden', '');

  if (!elements.modal || elements.modal.hasAttribute('hidden')) {
    document.body.classList.remove(CSS_CLASSES.MODAL_OPEN);
  }

  if (shouldRestoreModalTrap) {
    activateModalFocusTrap(elements.modal);
    requestAnimationFrame(() => {
      const focusable = getFocusableElements(elements.modal);
      const fallback = focusable[0] || elements.modalClose || elements.modal;
      fallback?.focus({ preventScroll: true });
    });
  } else if (returnFocus) {
    const focusTarget = (state.resetDialogTrigger && document.body.contains(state.resetDialogTrigger))
      ? state.resetDialogTrigger
      : elements.resetButton || elements.drawButton;
    focusTarget?.focus();
  }

  state.resetDialogTrigger = null;
}

// ============================================
// 19. STATUS UPDATE
// ============================================

function updateDrawStatus(latestEntry) {
  const total = state.numbers.length;
  const drawnCount = state.drawnNumbers.size;
  const isDataLoading = state.dataLoadingState === LoadingStates.LOADING;
  const isDataError = state.dataLoadingState === LoadingStates.ERROR;

  let normalizedEntry = null;

  if (latestEntry?.number) {
    normalizedEntry = latestEntry;
  } else if (state.drawHistory.length > 0) {
    const lastHistory = state.drawHistory[state.drawHistory.length - 1];
    if (lastHistory?.number) {
      const reference = state.entriesByNumber.get(lastHistory.number);
      normalizedEntry = {
        number: lastHistory.number,
        italian: lastHistory.italian || reference?.italian || '',
        dialect: lastHistory.dialect || reference?.dialect || '',
      };
    }
  }

  if (elements.drawProgressValue) {
    elements.drawProgressValue.textContent = total > 0 ? `${drawnCount}/${total}` : '0/0';
  }

  if (elements.drawProgressBar) {
    const ratio = total > 0 ? drawnCount / total : 0;
    const percentage = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
    elements.drawProgressBar.setAttribute('aria-valuemax', `${total}`);
    elements.drawProgressBar.setAttribute('aria-valuenow', `${drawnCount}`);
    elements.drawProgressBar.setAttribute('aria-valuetext', total > 0 ? `${drawnCount} su ${total}` : '0 su 0');
    if (elements.drawProgressFill) {
      elements.drawProgressFill.style.width = `${percentage}%`;
    }
  }

  if (elements.drawLastNumber) {
    elements.drawLastNumber.textContent = normalizedEntry ? `${normalizedEntry.number}` : '—';
  }

  let detailText = '';
  let showLanguages = false;
  let dialectText = '';
  let italianText = '';

  if (state.storageErrorMessage) {
    detailText = 'Verifica la connessione e riprova.';
  } else if (total === 0) {
    detailText = 'Caricamento del tabellone in corso';
  } else if (normalizedEntry) {
    showLanguages = true;
    dialectText = normalizedEntry.dialect?.trim() || '';
    italianText = normalizedEntry.italian?.trim() || '';
  } else if (drawnCount === 0) {
    detailText = 'In attesa della prima estrazione';
  } else if (drawnCount === total) {
    detailText = 'Tutti i numeri sono stati estratti';
  } else {
    detailText = 'Prosegui con le estrazioni';
  }

  if (
    elements.drawLastLanguages &&
    elements.drawLastDetailMessage &&
    elements.drawLastDialect &&
    elements.drawLastItalian
  ) {
    if (showLanguages) {
      elements.drawLastLanguages.hidden = false;
      elements.drawLastDetailMessage.hidden = true;
      elements.drawLastDialect.textContent = dialectText || '—';
      elements.drawLastItalian.textContent = italianText || '—';
    } else {
      elements.drawLastLanguages.hidden = true;
      elements.drawLastDetailMessage.hidden = false;
      elements.drawLastDetailMessage.textContent = detailText;
    }
  } else if (elements.drawLastDetail) {
    const fallbackText = showLanguages ? (dialectText || italianText || '—') : detailText;
    elements.drawLastDetail.textContent = fallbackText;
  }

  if (elements.drawLastMetric && normalizedEntry) {
    const illustration = getNumberIllustration(normalizedEntry);
    if (illustration) {
      elements.drawLastMetric.style.setProperty('--last-number-image', `url('${illustration}')`);
      applyBackgroundFit(elements.drawLastMetric, illustration, {
        sizeProperty: '--last-number-image-size',
        forceSize: 'auto 100%',
      });
      elements.drawLastMetric.dataset.hasImage = 'true';
    } else {
      elements.drawLastMetric.style.removeProperty('--last-number-image');
      applyBackgroundFit(elements.drawLastMetric, '', {
        sizeProperty: '--last-number-image-size',
      });
      delete elements.drawLastMetric.dataset.hasImage;
    }
  } else if (elements.drawLastMetric) {
    elements.drawLastMetric.style.removeProperty('--last-number-image');
    applyBackgroundFit(elements.drawLastMetric, '', {
      sizeProperty: '--last-number-image-size',
    });
    delete elements.drawLastMetric.dataset.hasImage;
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
      if (detail) message += ` — ${detail}`;
      message += `. ${drawnCount}/${total} numeri estratti.`;
    } else if (drawnCount === 0) {
      message = 'Pronto a estrarre il primo numero!';
    } else if (drawnCount === total) {
      message = 'Tutti i numeri sono stati estratti.';
    } else {
      message = `${drawnCount}/${total} numeri estratti.`;
    }
  }

  if (elements.drawStatus) {
    elements.drawStatus.textContent = message;
  }

  const noNumbersLoaded = total === 0;
  const finished = drawnCount === total && total > 0;

  if (elements.drawButton) {
    elements.drawButton.disabled = noNumbersLoaded || finished || isDataLoading || isDataError;
  }

  if (elements.resetButton) {
    elements.resetButton.disabled = drawnCount === 0 || isDataLoading || isDataError;
  }
}

// ============================================
// 20. DATA LOADING
// ============================================

async function loadNumbers() {
  setDataLoadingState(LoadingStates.LOADING);
  try {
    const response = await fetch(DATA_PATHS.NUMBERS);
    if (!response.ok) throw new Error('Fetch failed');
    
    const data = await response.json();
    const incomingNumbers = Array.isArray(data?.numbers) ? data.numbers : null;
    if (!incomingNumbers) throw new Error('Invalid data format');

    const seenNumbers = new Set();
    const sanitizedNumbers = [];

    incomingNumbers.forEach((item) => {
      if (!item || typeof item !== 'object') return;

      const numericValue = Number(item.number);
      if (!Number.isFinite(numericValue) || seenNumbers.has(numericValue)) return;

      seenNumbers.add(numericValue);
      sanitizedNumbers.push({
        ...item,
        number: numericValue,
        italian: typeof item.italian === 'string' ? item.italian : '',
        dialect: typeof item.dialect === 'string' ? item.dialect : '',
      });
    });

    if (!sanitizedNumbers.length) throw new Error('No valid numbers');

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
    console.error('Numbers load error', error);
    state.numbers = [];
    state.drawnNumbers = new Set();
    state.drawHistory = [];
    state.entriesByNumber = new Map();
    state.cellsByNumber = new Map();
    state.selected = null;
    sponsorManager.resetAssignments();
    state.storageErrorMessage = 'Impossibile caricare i numeri della tombola.';
    
    if (elements.board) {
      elements.board.innerHTML = '<p class="board-error">Errore nel caricamento dei dati della tombola.</p>';
    }
    if (elements.drawStatus) {
      elements.drawStatus.textContent = 'Errore nel caricamento dei numeri.';
    }
    if (elements.drawButton) elements.drawButton.disabled = true;
    
    setDataLoadingState(LoadingStates.ERROR);
    updateDrawHistory();
  }
}

// ============================================
// 21. EVENT HANDLERS
// ============================================

function setupEventListeners() {
  if (elements.board) {
    elements.board.addEventListener('click', handleBoardCellClick);
  }

  elements.modalClose?.addEventListener('click', closeModal);
  
  elements.modalDialectCard?.addEventListener('click', () => {
    if (!state.selected || elements.modalDialectCard?.disabled) return;
    const entry = state.entriesByNumber.get(Number(state.selected.dataset.number));
    if (entry?.dialect) playEntryVariant(entry, 'dialect');
  });

  elements.modalItalianCard?.addEventListener('click', () => {
    if (!state.selected || elements.modalItalianCard?.disabled) return;
    const entry = state.entriesByNumber.get(Number(state.selected.dataset.number));
    if (entry?.italian) playEntryVariant(entry, 'italian');
  });

  elements.modalNext?.addEventListener('click', () => {
    elements.modalNext.disabled = true;
    handleDraw();
  });

  elements.modal?.addEventListener('click', (event) => {
    if (event.target === elements.modal) closeModal();
  });

  elements.resetDialog?.addEventListener('click', (event) => {
    if (event.target === elements.resetDialog) closeResetDialog();
  });

  elements.resetDialogConfirm?.addEventListener('click', () => {
    closeResetDialog({ returnFocus: false });
    performGameReset();
  });

  elements.resetDialogCancelButtons.forEach((button) => {
    button?.addEventListener('click', () => closeResetDialog());
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;

    if (state.resetDialogOpen) {
      closeResetDialog();
    } else if (!elements.modal.hasAttribute('hidden')) {
      closeModal();
    } else if (state.historyOpen) {
      closeHistoryPanel();
    }
  });

  elements.drawButton?.addEventListener('click', handleDraw);
  elements.resetButton?.addEventListener('click', resetGame);
  elements.historyToggle?.addEventListener('click', toggleHistoryPanel);
  elements.audioToggle?.addEventListener('click', () => setAudioEnabled(!state.audioEnabled));
  elements.historyScrim?.addEventListener('click', () => closeHistoryPanel());
  elements.fullscreenToggle?.addEventListener('click', toggleFullscreenMode);
  document.addEventListener('fullscreenchange', handleFullscreenChange);
}

// ============================================
// 22. INITIALIZATION
// ============================================

function init() {
  initializeAudioPreference();
  setupEventListeners();
  updateFullscreenToggleLabel(state.fullscreenActive);
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

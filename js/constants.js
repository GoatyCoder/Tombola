export const LoadingStates = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error',
});

export const TombolaEvents = Object.freeze({
  NUMBER_DRAWN: 'tombola:numberDrawn',
  GAME_RESET: 'tombola:gameReset',
  SPONSOR_LOADED: 'tombola:sponsorLoaded',
  SPONSOR_SELECTED: 'tombola:sponsorSelected',
  SPONSOR_ASSIGNED: 'tombola:sponsorAssigned',
});

export const STORAGE_KEYS = Object.freeze({
  AUDIO: 'tombola-audio-enabled',
  DRAW_STATE: 'TOMBOLA_DRAW_STATE',
});

export const EMPTY_DRAW_STATE = Object.freeze({
  drawnNumbers: [],
  drawHistory: [],
});

export const DATA_PATHS = Object.freeze({
  SPONSORS: 'sponsors.json',
});

export const MEDIA = Object.freeze({
  TILE_FALLBACK: 'images/empty.jpg',
});

export const EMBEDDED_SPONSORS = Object.freeze([
  {
    logo: 'images/sponsor-panificio-stella.svg',
    url: 'https://www.panificiostella.it/',
    name: 'Panificio Stella',
  },
  {
    logo: 'images/sponsor-agrumi-del-sud.svg',
    url: 'https://www.agrumidelsud.it/',
    name: 'Agrumi del Sud',
  },
  {
    logo: 'images/sponsor-cantina-nojana.svg',
    url: 'https://www.cantinanojana.it/',
    name: 'Cantina Nojana',
  },
]);

export const DRAW_TIMELINE = Object.freeze({
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

export const ANIMATION_DELAYS = Object.freeze({
  SHORT: 220,
  MEDIUM: 320,
  LONG: 520,
  FALLBACK: 900,
});

export const CSS_CLASSES = Object.freeze({
  BOARD_CELL_DRAWN: 'board-cell--drawn',
  BOARD_CELL_ACTIVE: 'board-cell--active',
  BOARD_CELL_JUST_DRAWN: 'board-cell--just-drawn',
  DRAW_PORTAL_HAS_SPONSOR: 'draw-portal--has-sponsor',
  HISTORY_ITEM_LATEST: 'history-item--latest',
});

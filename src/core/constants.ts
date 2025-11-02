export const DRAW_STATE_STORAGE_KEY = 'tombola:draw-state';
export const AUDIO_STORAGE_KEY = 'tombola:audio-enabled';
export const APP_EVENTS = Object.freeze({
  numberDrawn: 'tombola:number-drawn',
  gameReset: 'tombola:game-reset',
  dataLoaded: 'tombola:data-loaded',
  sponsorsLoaded: 'tombola:sponsors-loaded',
});

export const REQUEST_IDLE_TIMEOUT = 16;

export const BOARD_BATCH_SIZE = 15;

export const MAX_DRAWN_NUMBERS = 90;

export const FALLBACK_IMAGE = '/images/empty.jpg';

export const SPEECH_LOCALES = Object.freeze({
  italian: 'it-IT',
  dialect: 'it-IT',
});

export const ERROR_MESSAGES = Object.freeze({
  data: 'Impossibile caricare il tabellone. Riprova più tardi.',
  sponsors: 'Impossibile caricare gli sponsor. Riprova più tardi.',
  storage: 'I dati salvati non sono validi e sono stati ignorati.',
});

export const SELECTORS = Object.freeze({
  board: '#board',
  boardTemplate: '#board-cell-template',
  drawButton: '#draw-button',
  drawButtonLabel: '[data-draw-label]',
  resetButton: '#reset-button',
  resetDialog: '#reset-dialog',
  resetDialogConfirm: '[data-reset-confirm]',
  resetDialogCancel: '[data-reset-cancel]',
  drawStatus: '#draw-status',
  drawProgressValue: '#draw-progress-value',
  drawProgressBar: '#draw-progress-bar',
  drawProgressFill: '#draw-progress-bar .progress__fill',
  drawLastNumber: '#draw-last-number',
  drawLastDetail: '#draw-last-detail',
  historyList: '#draw-history',
  historyEmpty: '#draw-history-empty',
  historyPanel: '#history-panel',
  historyToggle: '#history-toggle',
  historyLabel: '[data-history-label]',
  historyScrim: '#history-scrim',
  drawOverlay: '#draw-portal',
  drawOverlayNumber: '#draw-animation-number',
  drawOverlayBall: '#draw-animation-ball',
  drawOverlayAnnouncement: '#draw-animation-announcement',
  drawOverlayLoader: '#draw-portal-loader',
  drawSponsorBlock: '#draw-sponsor-block',
  drawSponsor: '#draw-sponsor',
  drawSponsorLogo: '#draw-sponsor-logo',
  drawSponsorHeading: '#draw-sponsor-heading',
  sponsorShowcase: '#sponsor-showcase',
  sponsorShowcaseList: '#sponsor-showcase-list',
  audioToggle: '#audio-toggle',
  floatingDrawButton: '#floating-draw-button',
  modal: '#number-modal',
  modalNumber: '#modal-number',
  modalItalian: '#modal-italian',
  modalDialect: '#modal-dialect',
  modalImage: '#modal-image',
  modalImageFrame: '#modal-image-frame',
  modalClose: '#modal-close',
  modalNext: '#modal-next',
  modalNextLabel: '[data-modal-next-label]',
  modalSponsorBlock: '#modal-sponsor-block',
  modalSponsor: '#modal-sponsor',
  modalSponsorLogo: '#modal-sponsor-logo',
  modalItalianPlay: '#modal-italian-play',
  modalDialectPlay: '#modal-dialect-play',
});

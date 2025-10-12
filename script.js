const DEFAULT_MISSING_TEXT =
  'Pronuncia dialettale non ancora disponibile: verrà usato il testo italiano.';

const state = {
  numbers: [],
  html5QrCode: null,
  isScanning: false,
  currentUtterance: null,
  activeEntry: null,
};

function isIntegerValue(value) {
  return typeof value === 'number' && isFinite(value) && Math.floor(value) === value;
}

const elements = {
  board: document.querySelector('#board'),
  manualTrigger: document.querySelector('#manual-trigger'),
  scannerTrigger: document.querySelector('#scanner-trigger'),
  numberModal: document.querySelector('[data-modal="number"]'),
  manualModal: document.querySelector('[data-modal="manual"]'),
  scannerModal: document.querySelector('[data-modal="scanner"]'),
  manualForm: document.querySelector('#manual-form'),
  manualInput: document.querySelector('#number-input'),
  playButton: document.querySelector('#play-number'),
  numberHeading: document.querySelector('#number-heading'),
  detailItalian: document.querySelector('#detail-italian'),
  detailDialect: document.querySelector('#detail-dialect'),
  missingHint: document.querySelector('#missing-hint'),
  scannerStatus: document.querySelector('#scanner-status'),
};

async function loadNumbers() {
  function ingestNumbers(data) {
    if (!data || !Array.isArray(data.numbers)) {
      throw new Error('Struttura dati non valida.');
    }
    state.numbers = data.numbers.slice().sort(function (a, b) {
      return a.number - b.number;
    });
    renderBoard();
  }

  try {
    if (window.__TOMBOLA_DATA) {
      ingestNumbers(window.__TOMBOLA_DATA);
      return;
    }
  } catch (error) {
    console.error('Errore nel dataset incorporato', error);
  }

  try {
    const response = await fetch('data.json');
    if (!response.ok) throw new Error('Impossibile caricare i dati della tombola');
    const data = await response.json();
    ingestNumbers(data);
  } catch (error) {
    console.error(error);
    elements.board.innerHTML = '<p class="status-text">Errore nel caricamento dei numeri.</p>';
  }
}

function renderBoard() {
  elements.board.innerHTML = '';
  const fragment = document.createDocumentFragment();

  state.numbers.forEach(function (entry) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'board-cell';
    button.dataset.number = entry.number;
    if (!entry.dialect) button.classList.add('missing');

    const caption = entry.dialect || (entry.italian != null ? entry.italian : '—');
    const italianForAria = entry.italian != null ? entry.italian : 'non disponibile';
    button.innerHTML = `
      <span class="cell-number">${entry.number}</span>
      <span class="cell-caption" title="${caption}">${caption}</span>
    `;
    button.setAttribute(
      'aria-label',
      `Numero ${entry.number}. ${entry.dialect ? `Dialetto: ${entry.dialect}` : `Italiano: ${italianForAria}`}`
    );
    button.addEventListener('click', function () {
      showEntry(entry);
    });

    fragment.appendChild(button);
  });

  elements.board.appendChild(fragment);
}

function showEntry(entry) {
  state.activeEntry = entry;
  elements.numberHeading.textContent = entry.number;
  elements.detailItalian.textContent = entry.italian != null ? entry.italian : '—';
  const hasDialect = Boolean(entry.dialect);
  elements.detailDialect.textContent = hasDialect ? entry.dialect : 'In attesa di registrazione';
  elements.missingHint.textContent = DEFAULT_MISSING_TEXT;
  elements.missingHint.hidden = hasDialect;
  openModal(elements.numberModal);
  speakEntry(entry);
}

function findEntryByNumber(targetNumber) {
  for (let index = 0; index < state.numbers.length; index += 1) {
    const current = state.numbers[index];
    if (current.number === targetNumber) {
      return current;
    }
  }
  return null;
}

function speakEntry(entry) {
  if (!('speechSynthesis' in window)) {
    elements.missingHint.hidden = false;
    elements.missingHint.textContent = 'Sintesi vocale non supportata dal dispositivo.';
    return;
  }

  if (state.currentUtterance) {
    window.speechSynthesis.cancel();
  }

  const textToSpeak = entry.dialect || entry.italian || `Numero ${entry.number}`;
  const utterance = new SpeechSynthesisUtterance(textToSpeak);
  utterance.lang = 'it-IT';
  utterance.rate = 0.9;
  utterance.pitch = 1.0;

  state.currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}

function openModal(modal) {
  if (!modal) return;
  modal.hidden = false;
  requestAnimationFrame(function () {
    modal.classList.add('visible');
    document.body.classList.add('modal-open');
  });
}

function closeModal(modal) {
  if (!modal || modal.hidden) return;
  modal.classList.remove('visible');
  const onTransitionEnd = function () {
    modal.hidden = true;
    modal.removeEventListener('transitionend', onTransitionEnd);
    if (!document.querySelector('.modal-backdrop.visible')) {
      document.body.classList.remove('modal-open');
    }
  };
  modal.addEventListener('transitionend', onTransitionEnd, { once: true });
  const { transitionDuration } = getComputedStyle(modal);
  if (!transitionDuration || parseFloat(transitionDuration) === 0) {
    onTransitionEnd();
  }
}

async function openScanner() {
  elements.scannerStatus.textContent = 'Preparazione della fotocamera…';
  openModal(elements.scannerModal);
  try {
    if (!state.html5QrCode) {
      state.html5QrCode = new Html5Qrcode('qr-reader');
    }

    const cameras = await Html5Qrcode.getCameras();
    if (!cameras || cameras.length === 0) {
      throw new Error('Nessuna fotocamera disponibile');
    }

    await state.html5QrCode.start(
      { deviceId: cameras[0].id },
      { fps: 10, qrbox: { width: 240, height: 240 } },
      function (decodedText) {
        const parsedNumber = Number.parseInt(decodedText, 10);
        if (isIntegerValue(parsedNumber)) {
          const entry = findEntryByNumber(parsedNumber);
          if (entry) {
            closeScanner();
            showEntry(entry);
          } else {
            elements.scannerStatus.textContent = `Il numero ${parsedNumber} non è stato trovato.`;
          }
        } else {
          elements.scannerStatus.textContent = `QR non valido: ${decodedText}`;
        }
      },
      function (errorMessage) {
        elements.scannerStatus.textContent = errorMessage;
      }
    );
    state.isScanning = true;
    elements.scannerStatus.textContent = 'Inquadra il codice QR per ascoltare il numero.';
  } catch (error) {
    console.error(error);
    elements.scannerStatus.textContent = error.message || 'Errore nella scansione del codice QR.';
    await closeScanner();
  }
}

async function closeScanner() {
  if (state.html5QrCode && state.isScanning) {
    try {
      await state.html5QrCode.stop();
      await state.html5QrCode.clear();
    } catch (error) {
      console.debug("Errore durante l'arresto dello scanner", error);
    }
  }
  state.isScanning = false;
  closeModal(elements.scannerModal);
}

function handleManualSubmit(event) {
  event.preventDefault();
  const value = Number.parseInt(elements.manualInput.value, 10);
  if (!isIntegerValue(value) || value < 1 || value > 90) {
    elements.manualInput.setCustomValidity('Inserisci un numero compreso tra 1 e 90');
    elements.manualInput.reportValidity();
    return;
  }
  const entry = findEntryByNumber(value);
  if (!entry) {
    elements.manualInput.setCustomValidity('Numero non disponibile');
    elements.manualInput.reportValidity();
    return;
  }
  elements.manualInput.setCustomValidity('');
  elements.manualInput.value = '';
  closeModal(elements.manualModal);
  showEntry(entry);
}

function setupModalInteractions() {
  var backdrops = document.querySelectorAll('.modal-backdrop');
  for (var i = 0; i < backdrops.length; i += 1) {
    (function (backdrop) {
      backdrop.addEventListener('mousedown', function (event) {
        if (event.target === backdrop) {
          if (backdrop === elements.scannerModal) {
            closeScanner();
          } else {
            closeModal(backdrop);
          }
        }
      });
    })(backdrops[i]);
  }

  var closeButtons = document.querySelectorAll('[data-close]');
  for (var j = 0; j < closeButtons.length; j += 1) {
    (function (button) {
      button.addEventListener('click', function () {
        const modal = button.closest('.modal-backdrop');
        if (modal === elements.scannerModal) {
          closeScanner();
        } else {
          closeModal(modal);
        }
      });
    })(closeButtons[j]);
  }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      const openModals = document.querySelectorAll('.modal-backdrop.visible');
      const activeModal = openModals.length ? openModals[openModals.length - 1] : null;
      if (!activeModal) return;
      if (activeModal === elements.scannerModal) {
        closeScanner();
      } else {
        closeModal(activeModal);
      }
    }
  });
}

function setupEventListeners() {
  elements.manualTrigger.addEventListener('click', function () {
    openModal(elements.manualModal);
    setTimeout(function () {
      try {
        elements.manualInput.focus({ preventScroll: true });
      } catch (error) {
        elements.manualInput.focus();
      }
    }, 120);
  });

  elements.scannerTrigger.addEventListener('click', function () {
    openScanner();
  });

  elements.manualForm.addEventListener('submit', handleManualSubmit);

  elements.playButton.addEventListener('click', function () {
    if (state.activeEntry) {
      speakEntry(state.activeEntry);
    }
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && state.isScanning) {
      closeScanner();
    }
  });
}

function init() {
  setupModalInteractions();
  setupEventListeners();
  loadNumbers();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

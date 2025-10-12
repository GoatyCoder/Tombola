const state = {
  numbers: [],
  filteredNumbers: [],
  showCompleteOnly: false,
  speechReady: false,
  currentUtterance: null,
  html5QrCode: null,
  isScanning: false,
};

const elements = {
  list: document.querySelector('#numbers-list'),
  template: document.querySelector('#number-template'),
  output: document.querySelector('#selection-output'),
  manualForm: document.querySelector('#manual-form'),
  numberInput: document.querySelector('#number-input'),
  toggleScanner: document.querySelector('#toggle-scanner'),
  scannerContainer: document.querySelector('#scanner-container'),
  closeScanner: document.querySelector('#close-scanner'),
  completeOnly: document.querySelector('#complete-only'),
};

async function loadNumbers() {
  try {
    const response = await fetch('data.json');
    if (!response.ok) {
      throw new Error('Impossibile caricare i dati');
    }
    const data = await response.json();
    state.numbers = data.numbers.sort((a, b) => a.number - b.number);
    applyFilter();
  } catch (error) {
    console.error(error);
    elements.output.textContent = 'Errore nel caricamento dei dati della tombola.';
  }
}

function applyFilter() {
  state.filteredNumbers = state.numbers.filter((entry) => {
    if (!state.showCompleteOnly) return true;
    return Boolean(entry.dialect && entry.italian);
  });
  renderList();
}

function renderList() {
  elements.list.innerHTML = '';
  const fragment = document.createDocumentFragment();

  state.filteredNumbers.forEach((entry) => {
    const card = elements.template.content.firstElementChild.cloneNode(true);
    card.querySelector('.number-badge').textContent = entry.number;
    card.querySelector('h3').textContent = `Numero ${entry.number}`;
    card.querySelector('.italian').textContent = entry.italian ?? '—';
    const dialectField = card.querySelector('.dialect');
    dialectField.textContent = entry.dialect ?? 'Registrazione da fornire';
    if (!entry.dialect) {
      dialectField.classList.add('missing');
    }

    const playButton = card.querySelector('.play-number');
    playButton.addEventListener('click', () => handleSelection(entry));

    fragment.appendChild(card);
  });

  elements.list.appendChild(fragment);
}

function handleSelection(entry) {
  if (!entry) return;
  const lines = [
    `Numero ${entry.number}`,
    entry.italian ? `Italiano: ${entry.italian}` : null,
    entry.dialect ? `Dialetto: ${entry.dialect}` : 'Pronuncia dialettale mancante, verrà usato il testo italiano.',
  ].filter(Boolean);

  elements.output.innerHTML = lines.map((line) => `<span>${line}</span>`).join('');
  speakEntry(entry);
}

function speakEntry(entry) {
  if (!('speechSynthesis' in window)) {
    elements.output.insertAdjacentHTML('beforeend', '<span class="warning">Sintesi vocale non supportata dal dispositivo.</span>');
    return;
  }

  if (state.currentUtterance) {
    window.speechSynthesis.cancel();
  }

  const textToSpeak = entry.dialect || entry.italian || `Numero ${entry.number}`;
  const utterance = new SpeechSynthesisUtterance(textToSpeak);
  utterance.lang = 'it-IT';
  utterance.rate = 0.92;
  utterance.pitch = 1.0;

  state.currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}

async function startScanner() {
  if (state.isScanning) return;
  try {
    state.isScanning = true;
    elements.toggleScanner.disabled = true;
    elements.toggleScanner.textContent = 'Preparazione…';
    elements.scannerContainer.hidden = false;

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
      (decodedText) => {
        const parsedNumber = parseInt(decodedText, 10);
        if (Number.isInteger(parsedNumber)) {
          const entry = state.numbers.find((item) => item.number === parsedNumber);
          if (entry) {
            handleSelection(entry);
            stopScanner();
          } else {
            elements.output.textContent = `Il numero ${decodedText} non è presente nell'elenco.`;
          }
        } else {
          elements.output.textContent = `QR non valido: ${decodedText}`;
        }
      },
      (errorMessage) => {
        console.debug('Scanner log:', errorMessage);
      }
    );
    elements.toggleScanner.textContent = 'Ferma scansione';
  } catch (error) {
    console.error(error);
    elements.output.textContent = error.message || 'Errore durante l\'avvio dello scanner.';
    stopScanner();
  } finally {
    elements.toggleScanner.disabled = false;
  }
}

async function stopScanner() {
  if (!state.html5QrCode) return;
  try {
    await state.html5QrCode.stop();
    await state.html5QrCode.clear();
  } catch (error) {
    console.debug('Errore durante lo stop dello scanner', error);
  }
  state.isScanning = false;
  elements.scannerContainer.hidden = true;
  elements.toggleScanner.textContent = 'Avvia scansione';
}

function setupEventListeners() {
  elements.manualForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = Number(elements.numberInput.value);
    if (!Number.isInteger(value) || value < 1 || value > 90) {
      elements.output.textContent = 'Inserisci un numero valido tra 1 e 90.';
      return;
    }
    const entry = state.numbers.find((item) => item.number === value);
    if (!entry) {
      elements.output.textContent = `Il numero ${value} non è ancora stato definito.`;
      return;
    }
    handleSelection(entry);
  });

  elements.toggleScanner.addEventListener('click', () => {
    if (state.isScanning) {
      stopScanner();
    } else {
      startScanner();
    }
  });

  elements.closeScanner.addEventListener('click', stopScanner);

  elements.completeOnly.addEventListener('change', (event) => {
    state.showCompleteOnly = event.target.checked;
    applyFilter();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.isScanning) {
      stopScanner();
    }
  });
}

function announceMissingVoices() {
  if (!('speechSynthesis' in window)) {
    elements.output.textContent = 'Questo dispositivo non supporta la sintesi vocale.';
  } else if (window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.addEventListener('voiceschanged', () => {
      state.speechReady = true;
    });
  } else {
    state.speechReady = true;
  }
}

function init() {
  setupEventListeners();
  announceMissingVoices();
  loadNumbers();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

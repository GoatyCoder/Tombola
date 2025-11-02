import './styles/main.css';

document.documentElement.classList.remove('no-js');

async function bootstrap() {
  const root = document.documentElement;
  root.dataset.appReady = 'initializing';

  try {
    const { initializeApp } = await import('./app');
    await initializeApp();
    root.dataset.appReady = 'ready';
  } catch (error) {
    console.error('Errore critico durante l\'inizializzazione', error);
    root.dataset.appReady = 'error';
    const messageElement = document.querySelector('#draw-status');
    if (messageElement) {
      messageElement.textContent =
        'Si è verificato un errore imprevisto durante il caricamento. Riprova a ricaricare la pagina.';
      messageElement.setAttribute('role', 'alert');
    }
  }
}

void bootstrap();

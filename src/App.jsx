import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEYS = {
  AUDIO: 'tombola-audio-enabled',
  VOICE: 'tombola-dialect-voice',
};

const DialectVoices = Object.freeze({
  PRUDENZA: 'ps',
  RITA: 'nj',
});

const LoadingStates = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error',
});

function useStoredBoolean(key, fallback) {
  const [value, setValue] = useState(() => {
    if (typeof window === 'undefined') return fallback;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return fallback;
      return raw === 'true';
    } catch (error) {
      return fallback;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, value ? 'true' : 'false');
    } catch (error) {
      /* ignore storage errors */
    }
  }, [key, value]);

  return [value, setValue];
}

function useStoredVoice(key, fallback) {
  const [voice, setVoice] = useState(() => {
    if (typeof window === 'undefined') return fallback;
    try {
      const raw = window.localStorage.getItem(key);
      return raw || fallback;
    } catch (error) {
      return fallback;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, voice);
    } catch (error) {
      /* ignore storage errors */
    }
  }, [key, voice]);

  return [voice, setVoice];
}

function getAudioPath(number, variant, dialectVoice) {
  if (!number) return '';
  const suffix =
    variant === 'dialect' ? `_${dialectVoice}` : variant === 'italian' ? '_it' : '';
  return `/audio/${String(number).trim()}${suffix}.mp3`;
}

function formatNumberLabel(entry) {
  if (!entry) return '';
  const prefix = `Numero ${entry.number}`;
  if (entry.dialect && entry.italian) {
    return `${prefix}: ${entry.dialect} — ${entry.italian}`;
  }
  return prefix;
}

function HeaderHero() {
  return (
    <header className="hero">
      <div className="shell hero__shell">
        <h1 className="sr-only">La Tombola Nojana</h1>
        <div className="hero__identity">
          <img
            src="/images/logo_amicidelteatro.svg"
            alt="Associazione Culturale Nojana Amici del Teatro"
            className="hero__logo hero__logo--presenter"
            loading="lazy"
            decoding="async"
          />
          <span className="hero__presenter-label">presenta</span>
          <img
            src="/images/tombola_nojana_red.svg"
            alt="Logo La Tombola Nojana"
            className="hero__logo hero__logo--main"
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>
    </header>
  );
}

function StatusCard({
  loadingState,
  onDraw,
  onReset,
  canDraw,
  progress,
  lastEntry,
  historyOpen,
  onToggleHistory,
  audioEnabled,
  onToggleAudio,
  dialectVoice,
  onVoiceChange,
  sponsor,
}) {
  const progressLabel = `${progress.drawn}/${progress.total}`;
  const progressPercent = progress.total > 0 ? (progress.drawn / progress.total) * 100 : 0;

  return (
    <article className="status-card" aria-live="polite">
      <header className="status-card__header">
        <div className="status-card__title-block">
          <p className="eyebrow">Tombola Nojana</p>
          <div className="status-card__heading">
            <div>
              <h2 className="section-heading">Estrai e tieni traccia</h2>
              <p className="status-card__subheading">Gestisci il tabellone senza rinunciare allo stile.</p>
            </div>
            <img
              src="/images/tombola_nojana_red.svg"
              className="status-card__logo"
              alt="Logo La Tombola Nojana"
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
      </header>

      <div className="status-card__body">
        <div className="status-card__metrics">
          <div className="status-card__metric" role="group" aria-label="Ultimo numero estratto">
            <p className="status-card__label">Ultimo numero</p>
            <p className="status-card__value" aria-live="assertive">
              {lastEntry ? lastEntry.number : '—'}
            </p>
            <p
              className="status-card__description"
              id="last-number-description"
              aria-live="polite"
            >
              {lastEntry ? formatNumberLabel(lastEntry) : 'In attesa della prima estrazione.'}
            </p>
            <p id="draw-last-languages" className="status-card__lang-group" hidden={!lastEntry}>
              <span className="status-card__lang status-card__lang--dialect">
                {lastEntry?.dialect || ''}
              </span>
              <span className="status-card__lang status-card__lang--italian">{lastEntry?.italian || ''}</span>
            </p>
          </div>

          <div
            className="status-card__metric status-card__metric--progress"
            role="group"
            aria-labelledby="progress-label"
          >
            <p id="progress-label" className="status-card__label sr-only">
              Numeri estratti
            </p>
            <p className="status-card__value status-card__value--compact">{progressLabel}</p>
            <div
              className="progress"
              role="progressbar"
              aria-valuemin="0"
              aria-valuemax={progress.total}
              aria-valuenow={progress.drawn}
            >
              <span
                className="progress__fill"
                style={{ width: `${progressPercent}%` }}
                aria-hidden="true"
              />
            </div>
          </div>
        </div>

        <div className="status-card__control-area">
          <div className="status-card__actions">
            <button
              type="button"
              className="button button--dashboard button--primary"
              onClick={onDraw}
              disabled={!canDraw}
            >
              <span className="button__label">Estrai numero</span>
              <img src="/images/icon-die.svg" className="button__icon die-icon" alt="" aria-hidden="true" />
            </button>

            <button
              type="button"
              className="button button--dashboard button--icon"
              aria-label="Reset partita"
              onClick={onReset}
              disabled={progress.drawn === 0 && loadingState !== LoadingStates.LOADING}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="button__icon">
                <path
                  d="M6 7.5A6.75 6.75 0 0 1 18.32 9"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M18 4.5v4.25h-4.25"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M18 16.5a6.75 6.75 0 0 1-12.32-1.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M6 19.5V15.25h4.25"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <button
              type="button"
              className="button button--dashboard button--icon"
              aria-expanded={historyOpen}
              aria-controls="history-panel"
              aria-label="Cronologia"
              onClick={onToggleHistory}
            >
              <svg className="button__icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M5.75 4.5h12.5a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H5.75a.75.75 0 0 1-.75-.75V5.25a.75.75 0 0 1 .75-.75Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M8 7h8m-8 4h8m-8 4h5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <button
              type="button"
              className="button button--dashboard button--icon audio-toggle"
              aria-pressed={audioEnabled}
              aria-label={audioEnabled ? 'Disattiva annuncio audio' : 'Attiva annuncio audio'}
              title={audioEnabled ? 'Disattiva annuncio audio' : 'Attiva annuncio audio'}
              onClick={onToggleAudio}
            >
              <svg className="button__icon audio-toggle__icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  className="audio-toggle__speaker"
                  d="M5.5 9.5H8l3.5-3.5v12L8 14.5H5.5a1.5 1.5 0 0 1-1.5-1.5v-2a1.5 1.5 0 0 1 1.5-1.5Z"
                />
                <path className="audio-toggle__wave" d="M15.5 9.5a3 3 0 0 1 0 5" />
                <path
                  className="audio-toggle__wave audio-toggle__wave--strong"
                  d="M17.8 7.8a6 6 0 0 1 0 8.5"
                />
                <path className="audio-toggle__cross" d="M16 9l5 5m0-5-5 5" />
              </svg>
            </button>
          </div>

          <div className="status-card__settings" aria-label="Impostazioni voce">
            <div className="status-card__settings-field">
              <span className="status-card__settings-label" id="dialect-voice-label">
                Voce di:
              </span>
              <div
                className="status-card__settings-control status-card__voice-options"
                role="radiogroup"
                aria-labelledby="dialect-voice-label"
              >
                <label className="voice-option" htmlFor="dialect-voice-ps">
                  <input
                    type="radio"
                    name="dialect-voice"
                    id="dialect-voice-ps"
                    value={DialectVoices.PRUDENZA}
                    checked={dialectVoice === DialectVoices.PRUDENZA}
                    onChange={(event) => onVoiceChange(event.target.value)}
                  />
                  <span className="voice-option__label">Prudenza Scarfó</span>
                </label>
                <label className="voice-option" htmlFor="dialect-voice-nj">
                  <input
                    type="radio"
                    name="dialect-voice"
                    id="dialect-voice-nj"
                    value={DialectVoices.RITA}
                    checked={dialectVoice === DialectVoices.RITA}
                    onChange={(event) => onVoiceChange(event.target.value)}
                  />
                  <span className="voice-option__label">Rita Tagarelli</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {sponsor ? (
        <div className="sponsor-banner sponsor-banner--modal">
          <a
            className="sponsor-card sponsor-card--static"
            href={sponsor.url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={sponsor.name ? `Apri il sito di ${sponsor.name}` : 'Visita lo sponsor'}
          >
            <img
              src={sponsor.logo}
              className="sponsor-card__logo"
              alt={sponsor.name || 'Sponsor della tombola'}
              loading="lazy"
              decoding="async"
            />
          </a>
        </div>
      ) : null}
    </article>
  );
}

function Board({ numbers, drawn, currentNumber, onSelect }) {
  return (
    <article className="board-wrapper">
      <h2 id="board-heading" className="sr-only">
        Tabellone
      </h2>
      <div className="board-grid" id="board" aria-live="polite">
        {numbers.map((entry) => {
          const isDrawn = drawn.has(entry.number);
          const isActive = currentNumber?.number === entry.number;
          const classNames = [
            'board-cell',
            isDrawn ? 'board-cell--drawn' : '',
            isActive ? 'board-cell--active' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <button
              key={entry.number}
              className={classNames}
              type="button"
              onClick={() => onSelect(entry)}
              aria-pressed={isDrawn}
            >
              <span className="board-cell__token token" aria-hidden="true">
                <span className="board-cell__token-number token__number">{entry.number}</span>
              </span>
              <span className="board-cell__number" aria-hidden="true">
                {String(entry.number).padStart(2, '0')}
              </span>
              <span className="sr-only">{formatNumberLabel(entry)}</span>
            </button>
          );
        })}
      </div>
    </article>
  );
}

function HistoryPanel({ history, open, onClose }) {
  return (
    <>
      <aside id="history-panel" className="history" aria-label="Cronologia estrazioni" hidden={!open}>
        <header className="history__header">
          <h3 className="history__title">Cronologia</h3>
          <p className="history__subtitle">L'ordine completo delle estrazioni.</p>
        </header>
        {history.length === 0 ? (
          <p className="history__empty" id="draw-history-empty">
            Nessun numero estratto finora.
          </p>
        ) : (
          <ol className="history__list" id="draw-history" aria-live="polite">
            {history.map((entry, index) => (
              <li key={`${entry.number}-${index}`} className="history__item">
                <span className="history__index">{index + 1}</span>
                <span className="history__number">{entry.number}</span>
                <span className="history__label">{entry.italian}</span>
              </li>
            ))}
          </ol>
        )}
      </aside>
      {open ? <div id="history-scrim" className="scrim" onClick={onClose} /> : null}
    </>
  );
}

function NumberModal({ entry, open, onClose, onPlayDialect, onPlayItalian, onNext }) {
  if (!entry) return null;
  const showItalian = Boolean(entry.italian);
  const showDialect = Boolean(entry.dialect);

  return (
    <div
      id="number-modal"
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-number"
      hidden={!open}
    >
      <div className="number-dialog">
        <header className="number-dialog__header">
          <p id="modal-number" className="number-dialog__headline" aria-live="polite">
            Numero {entry.number}
          </p>
          <button type="button" className="number-dialog__close" id="modal-close" aria-label="Chiudi" onClick={onClose}>
            <span aria-hidden="true">&times;</span>
          </button>
        </header>

        <div className="number-dialog__body">
          <div className="number-dialog__visual" aria-hidden="true">
            <img
              src={`/images/illustrazioni/${entry.number}.png`}
              alt=""
              loading="lazy"
              decoding="async"
            />
          </div>

          <div className="number-dialog__details">
            <div className="number-dialog__languages">
              {showDialect ? (
                <button
                  type="button"
                  className="number-dialog__language-card number-dialog__language-card--dialect"
                  onClick={onPlayDialect}
                  aria-describedby="modal-dialect"
                  aria-label="Riproduci la pronuncia in nojano"
                >
                  <span className="number-dialog__language-header">
                    <span className="number-dialog__language-emblem">
                      <img src="/images/logo_noicattaro.svg" alt="" loading="lazy" decoding="async" />
                    </span>
                    <span className="number-dialog__language-name">Nojano</span>
                    <span className="number-dialog__language-audio" aria-hidden="true">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="12" cy="12" r="8.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M10 8.5v7l5-3.5-5-3.5Z" fill="currentColor" />
                      </svg>
                    </span>
                  </span>
                  <p id="modal-dialect" className="number-dialog__phrase">
                    {entry.dialect}
                  </p>
                </button>
              ) : null}

              {showItalian ? (
                <button
                  type="button"
                  className="number-dialog__language-card number-dialog__language-card--italian"
                  onClick={onPlayItalian}
                  aria-describedby="modal-italian"
                  aria-label="Riproduci la pronuncia in italiano"
                >
                  <span className="number-dialog__language-header">
                    <span className="number-dialog__language-emblem">
                      <img src="/images/logo_italia.svg" alt="" loading="lazy" decoding="async" />
                    </span>
                    <span className="number-dialog__language-name">Italiano</span>
                    <span className="number-dialog__language-audio" aria-hidden="true">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="12" cy="12" r="8.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M10 8.5v7l5-3.5-5-3.5Z" fill="currentColor" />
                      </svg>
                    </span>
                  </span>
                  <p id="modal-italian" className="number-dialog__phrase">
                    {entry.italian}
                  </p>
                </button>
              ) : null}
            </div>

            <footer className="number-dialog__footer">
              {onNext ? (
                <button type="button" className="number-dialog__next" onClick={onNext} aria-label="Estrai successivo">
                  <span className="number-dialog__next-label">Estrai successivo</span>
                  <img src="/images/icon-die.svg" className="die-icon" alt="" aria-hidden="true" />
                </button>
              ) : null}
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResetDialog({ open, onConfirm, onCancel }) {
  return (
    <div
      id="reset-dialog"
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-dialog-title"
      aria-describedby="reset-dialog-message"
      hidden={!open}
    >
      <div className="confirm-dialog">
        <h2 id="reset-dialog-title" className="confirm-dialog__title">
          Azzerare la partita?
        </h2>
        <p id="reset-dialog-message" className="confirm-dialog__message">
          Tutti i numeri estratti e la cronologia verranno cancellati.
        </p>
        <div className="confirm-dialog__actions">
          <button type="button" className="button" onClick={onCancel} data-reset-cancel>
            Continua a giocare
          </button>
          <button type="button" className="button button--primary" onClick={onConfirm} data-reset-confirm>
            Azzera tabellone
          </button>
        </div>
      </div>
    </div>
  );
}

function SponsorShowcase({ sponsors }) {
  if (!sponsors.length) return null;
  return (
    <section className="layout__section layout__section--sponsor sponsor" id="sponsor-showcase">
      <div className="shell sponsor__shell">
        <div className="sponsor__scroller">
          <ul className="sponsor__strip" id="sponsor-showcase-list" aria-label="Elenco sponsor">
            {sponsors.map((sponsor) => (
              <li className="sponsor-strip__item" key={sponsor.logo}>
                <a
                  className="sponsor-card sponsor-strip__card"
                  href={sponsor.url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={sponsor.name ? `Apri il sito di ${sponsor.name}` : 'Apri il sito dello sponsor'}
                >
                  <img
                    src={sponsor.logo}
                    className="sponsor-card__logo"
                    alt={sponsor.name || 'Sponsor Tombola'}
                    loading="lazy"
                    decoding="async"
                  />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="app-footer" role="contentinfo">
      <div className="app-footer__bottom">
        <div className="app-footer__meta">
          <a
            className="app-footer__association"
            href="https://www.amicidelteatro.it/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img src="/images/logo_amicidelteatro_footer.svg" alt="Associazione Culturale Nojana Amici del Teatro" />
          </a>
          <p className="app-footer__legal">
            Evento organizzato per sostenere i progetti dell'Associazione Culturale Nojana Amici del Teatro.
          </p>
        </div>
        <div className="app-footer__author">
          <p className="app-footer__author-credit">Made by</p>
          <a
            className="app-footer__author-link"
            href="https://goatycoder.dev"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img src="/images/logo_goatycoder.svg" alt="Goaty Coder" />
          </a>
        </div>
      </div>
    </footer>
  );
}

function App() {
  const [numbers, setNumbers] = useState([]);
  const [numbersState, setNumbersState] = useState(LoadingStates.LOADING);
  const [sponsors, setSponsors] = useState([]);
  const [sponsorState, setSponsorState] = useState(LoadingStates.LOADING);
  const [currentSponsor, setCurrentSponsor] = useState(null);
  const [drawnNumbers, setDrawnNumbers] = useState([]);
  const [currentEntry, setCurrentEntry] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [audioEnabled, setAudioEnabled] = useStoredBoolean(STORAGE_KEYS.AUDIO, true);
  const [dialectVoice, setDialectVoice] = useStoredVoice(
    STORAGE_KEYS.VOICE,
    DialectVoices.PRUDENZA,
  );
  const audioRef = useRef(null);

  useEffect(() => {
    fetch('/data.json')
      .then((response) => response.json())
      .then((data) => {
        const parsed = Array.isArray(data?.numbers) ? data.numbers : [];
        const normalized = parsed
          .map((entry) => ({
            number: Number(entry.number),
            italian: entry.italian || '',
            dialect: entry.dialect || '',
          }))
          .filter((entry) => Number.isFinite(entry.number))
          .sort((a, b) => a.number - b.number);
        setNumbers(normalized);
        setNumbersState(LoadingStates.SUCCESS);
      })
      .catch(() => setNumbersState(LoadingStates.ERROR));
  }, []);

  useEffect(() => {
    fetch('/sponsors.json')
      .then((response) => response.json())
      .then((data) => {
        const parsed = Array.isArray(data?.sponsors) ? data.sponsors : [];
        const normalized = parsed
          .map((sponsor) => ({
            logo: sponsor.logo,
            url: sponsor.url,
            name: sponsor.name,
            onlyShowcase: Boolean(sponsor.onlyShowcase),
          }))
          .filter((sponsor) => sponsor.logo);
        setSponsors(normalized);
        setSponsorState(LoadingStates.SUCCESS);
      })
      .catch(() => setSponsorState(LoadingStates.ERROR));
  }, []);

  const numbersMap = useMemo(() => {
    const map = new Map();
    numbers.forEach((entry) => map.set(entry.number, entry));
    return map;
  }, [numbers]);

  const drawnSet = useMemo(() => new Set(drawnNumbers), [drawnNumbers]);
  const eligibleSponsors = useMemo(
    () => sponsors.filter((sponsor) => !sponsor.onlyShowcase),
    [sponsors],
  );

  const pickRandomSponsor = useCallback(() => {
    if (!eligibleSponsors.length) return null;
    const index = Math.floor(Math.random() * eligibleSponsors.length);
    return eligibleSponsors[index];
  }, [eligibleSponsors]);

  useEffect(() => {
    if (!eligibleSponsors.length) {
      setCurrentSponsor(null);
    }
  }, [eligibleSponsors]);

  const latestEntry = useMemo(() => {
    const lastNumber = drawnNumbers[drawnNumbers.length - 1];
    return numbersMap.get(lastNumber) || null;
  }, [drawnNumbers, numbersMap]);

  const progress = {
    drawn: drawnNumbers.length,
    total: numbers.length,
  };

  const canDraw = numbersState === LoadingStates.SUCCESS && drawnNumbers.length < numbers.length;

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const playAudio = (number, variant) => {
    if (!audioEnabled) return;
    const src = getAudioPath(number, variant, dialectVoice);
    stopAudio();
    const audio = new Audio(src);
    audioRef.current = audio;
    audio.play().catch(() => {});
  };

  const handleDraw = () => {
    if (!canDraw) return;
    const remaining = numbers.filter((entry) => !drawnSet.has(entry.number));
    if (!remaining.length) return;
    const next = remaining[Math.floor(Math.random() * remaining.length)];
    setDrawnNumbers((previous) => [...previous, next.number]);
    setCurrentEntry(next);
    setCurrentSponsor(pickRandomSponsor());
    setModalOpen(true);
    if (audioEnabled) {
      playAudio(next.number, 'dialect');
    }
  };

  const handleSelect = (entry) => {
    setCurrentEntry(entry);
    setModalOpen(true);
  };

  const handleReset = () => {
    if (drawnNumbers.length === 0) return;
    setResetOpen(true);
  };

  const confirmReset = () => {
    stopAudio();
    setDrawnNumbers([]);
    setCurrentEntry(null);
    setCurrentSponsor(null);
    setModalOpen(false);
    setResetOpen(false);
  };

  const toggleAudio = () => setAudioEnabled((previous) => !previous);

  const toggleHistory = () => setHistoryOpen((open) => !open);

  const nextFromModal = () => {
    setModalOpen(false);
    setTimeout(handleDraw, 120);
  };

  const historyEntries = drawnNumbers.map((number) => numbersMap.get(number)).filter(Boolean);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (modalOpen) setModalOpen(false);
        if (historyOpen) setHistoryOpen(false);
        if (resetOpen) setResetOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [historyOpen, modalOpen, resetOpen]);

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">
        Salta al contenuto principale
      </a>
      <HeaderHero />

      <main id="main-content" className="layout">
        <section className="layout__section layout__section--status" aria-labelledby="controls-heading">
          <div className="shell">
            <div className="section-heading-group">
              <p className="eyebrow">Gameplay</p>
              <div className="section-heading__row">
                <div>
                  <h2 id="controls-heading" className="section-heading">
                    Controlla l'estrazione
                  </h2>
                  <p className="section-subheading">
                    Estrai numeri unici, ascolta la pronuncia e consulta la cronologia.
                  </p>
                </div>
              </div>
            </div>

            <div className="status-card__grid">
              <StatusCard
                loadingState={numbersState}
                onDraw={handleDraw}
                onReset={handleReset}
                canDraw={canDraw}
                progress={progress}
                lastEntry={latestEntry}
                historyOpen={historyOpen}
                onToggleHistory={toggleHistory}
                audioEnabled={audioEnabled}
                onToggleAudio={toggleAudio}
                dialectVoice={dialectVoice}
                onVoiceChange={setDialectVoice}
                sponsor={currentSponsor}
              />
            </div>
          </div>
        </section>

        <section className="layout__section layout__section--board" aria-labelledby="board-heading">
          <div className="shell board-area__shell">
            <div className="board-area__layout">
              <Board numbers={numbers} drawn={drawnSet} currentNumber={currentEntry || latestEntry} onSelect={handleSelect} />
              <HistoryPanel history={historyEntries} open={historyOpen} onClose={() => setHistoryOpen(false)} />
            </div>
          </div>
        </section>

        <SponsorShowcase sponsors={sponsors.filter((sponsor) => sponsor.logo)} />
      </main>

      <NumberModal
        entry={currentEntry}
        open={modalOpen && Boolean(currentEntry)}
        onClose={() => setModalOpen(false)}
        onPlayDialect={() => playAudio(currentEntry?.number, 'dialect')}
        onPlayItalian={() => playAudio(currentEntry?.number, 'italian')}
        onNext={canDraw ? nextFromModal : null}
      />

      <ResetDialog open={resetOpen} onConfirm={confirmReset} onCancel={() => setResetOpen(false)} />

      <Footer />
    </div>
  );
}

export default App;

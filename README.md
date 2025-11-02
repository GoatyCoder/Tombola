# Tombola Nojana

Applicazione web responsive e accessibile che digitalizza la tradizione della Tombola Nojana con estrazioni animate, cronologia persistente e rotazione degli sponsor. Il progetto è stato rifattorizzato con un'architettura modulare in TypeScript per garantire manutenzione semplice, performance elevate e qualità enterprise-ready.

## Funzionalità principali

- 🎲 **Estrazione guidata** con stato persistente, progresso visivo e overlay animato.
- 🧩 **Tabellone interattivo** ottimizzato per tastiera, screen reader e dispositivi touch.
- 🗂️ **Cronologia** con apertura mobile-friendly e timestamp localizzati.
- 🗣️ **Sintesi vocale opzionale** (con fallback automatico quando l'API non è supportata).
- 🤝 **Gestione sponsor** con showcase dedicato e rotazione automatica durante le estrazioni.
- 💾 **Salvataggio resiliente** su `localStorage` con validazione dei dati e messaggi d'errore user-friendly.
- ⚙️ **Architettura modulare** con build Vite, bundle ottimizzato e test automatici via Vitest.

## Requisiti

- Node.js 18 o superiore
- npm 9+

## Installazione e comandi principali

```bash
npm install          # installa le dipendenze
npm run dev          # avvia il server di sviluppo (http://localhost:5173)
npm run build        # produce il bundle ottimizzato in dist/
npm run preview      # anteprima della build di produzione
npm test             # esegue la suite unitaria con coverage
```

## Struttura del progetto

```
.
├── public/
│   ├── data.json          # dataset dei numeri con testi e immagini
│   ├── sponsors.json      # elenco sponsor
│   └── images/            # asset statici
├── src/
│   ├── app.ts             # bootstrap dell'applicazione
│   ├── core/              # store, costanti e tipi condivisi
│   ├── data/              # loader remoto + persistenza
│   ├── features/          # moduli UI (board, draw, history, modal, audio…)
│   ├── styles/            # foglio di stile principale
│   └── main.ts            # entrypoint Vite
├── tests/                 # test unitari Vitest
├── vite.config.ts
└── README.md
```

## Qualità, accessibilità e performance

- **Performance**: rendering del tabellone batch con `requestIdleCallback`, immagini lazy e skeleton loader.
- **Accessibilità**: stato annunciato con `role="status"`, navigazione via frecce e focus trap nei modali, fallback per `backdrop-filter` e `aspect-ratio`.
- **Resilienza**: gestione centralizzata degli errori di caricamento dati, validazione del `localStorage`, blocco della sintesi vocale su device non supportati.
- **Testing**: copertura unit test per store e sponsor manager, con configurazione Vitest + jsdom.

## Deploy

La build di produzione (`npm run build`) genera la cartella `dist/` pronta per l'hosting su CDN o piattaforme statiche (Netlify, Vercel, GitHub Pages). Tutti gli asset statici sono serviti da `public/` e referenziati con percorsi assoluti.

## Licenza

Il codice è rilasciato con licenza MIT. I contenuti testuali e grafici restano di proprietà dei rispettivi autori.

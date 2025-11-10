# Tombola Nojana

Interfaccia web statica per condurre la tombola tradizionale nojana in modo digitale. La pagina offre estrazioni animate, annuncio vocale opzionale, cronologia dettagliata e un pannello sponsor, pensati per l'utilizzo durante eventi dal vivo o trasmissioni in streaming.

## Funzionalità principali
- **Tabellone interattivo 1–90** con stati "estratto" e "attivo" sincronizzati tra griglia, cronologia e dialoghi di dettaglio.
- **Animazioni di estrazione** con sovrapposizione dedicata e gestione progressiva delle tempistiche per modalità standard o "ridotta" (rispetto della preferenza _prefers-reduced-motion_).
- **Annuncio audio opzionale** tramite Web Speech API con memorizzazione della preferenza in `localStorage` e fallback silenzioso.
- **Cronologia consultabile** come foglio mobile su smartphone e pannello laterale su desktop, con ultimo numero evidenziato e scorrimento automatico.
- **Sponsor rotativi** caricati da `sponsors.json` con placeholder integrati e assegnazione persistente per numero estratto.
- **Persistenza della partita** (numeri estratti e cronologia) in `localStorage` con gestione errori e messaggi utente dedicati.

## Struttura del progetto
```
.
├── data.json        # Elenco numeri con traduzioni e metadati
├── index.html       # Pagina principale e struttura dell'interfaccia
├── js/
│   ├── constants.js # Costanti condivise per stato, eventi e asset
│   └── main.js      # Logica dell'applicazione, stato, animazioni e audio
├── sponsors.json    # Configurazione sponsor remoti
├── styles.css       # Stili e design token
└── images/          # Asset grafici per tabellone e sponsor
```

## Avvio in locale
La web app non richiede build: è sufficiente servire i file statici da un web server (necessario per permettere a `fetch` di leggere `data.json` e `sponsors.json`).

```bash
# con Python 3
python3 -m http.server 8000

# con Node.js (http-server)
npx http-server -p 8000
```

Apri quindi <http://localhost:8000> nel browser. Per la riproduzione vocale e l'accesso eventuale alla fotocamera (per futuri sviluppi) è consigliato utilizzare HTTPS in produzione.

## Personalizzazione dati
- **Numeri**: aggiorna `data.json` modificando nomi italiani, dialettali e immagini (`image` con percorso relativo). In assenza di immagine viene mostrato un segnaposto.
- **Sponsor**: gestiti tramite `sponsors.json` oppure fallback integrati in `js/constants.js`. Ogni sponsor deve includere `logo` (percorso immagine) e `url`.
- **Stato iniziale**: per partire da tabellone pulito elimina la chiave `TOMBOLA_DRAW_STATE` dal `localStorage` del dominio.

## Accessibilità e usabilità
- Navigazione da tastiera completa con _skip link_, comandi con `:focus-visible` e dialoghi modali dotati di focus trap e isolamento del contenuto retrostante.
- Annunci live via `aria-live` per ultimo numero estratto, barra di avanzamento e cronologia.
- Cronologia e animazioni rispettano le preferenze di movimento ridotto (`prefers-reduced-motion`).
- Palette cromatica ottimizzata per il contrasto WCAG AA su pulsanti principali e testi su sfondi accent.

## Considerazioni per la produzione
- Servire gli asset con caching statico e `Content-Type` corretti; le immagini possono essere convertite in WebP mantenendo i fallback dichiarati in `data.json`/`sponsors.json`.
- Per contesti multi-istanza, sostituire il semplice `localStorage` con uno storage centralizzato o sincronizzato lato server.
- L'annuncio vocale dipende dalla disponibilità della Web Speech API: valutare un fallback audio personalizzato o disabilitare la funzione sui browser non supportati.
- Prevedere una pipeline di validazione per `data.json` e `sponsors.json` (es. linting JSON) per evitare crash dovuti a formati errati.

## Stato attuale e limitazioni
- Nessuna autenticazione o multiutenza: l'app è pensata per l'uso su un unico dispositivo.
- Le immagini vengono caricate in modo eager; per eventi con connessioni lente si consiglia di adottare varianti ottimizzate o CDN.
- Non è presente un sistema di build: eventuali ottimizzazioni (minificazione, bundling) vanno aggiunte esternamente.

## Licenza
Il codice può essere riutilizzato internamente previa attribuzione agli autori originali della Tombola Nojana. Valuta l'aggiunta di una licenza formale se prevedi una distribuzione pubblica.

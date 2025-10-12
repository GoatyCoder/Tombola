# Tombola Nojana – Web App dimostrativa

Questa repository contiene una web app statica che permette di esplorare i numeri della **Tombola Nojana** e ascoltarne la pronuncia attraverso la sintesi vocale del browser. L'applicazione offre anche uno scanner di QR code per leggere rapidamente il numero associato a ogni casella della tombola.

## Funzionalità principali

- ✅ **Catalogo completo (1-90)** con corrispondenze italiano/dialetto nojano.
- ✅ **Filtro "solo numeri completi"** per individuare rapidamente le voci con pronuncia dialettale presente.
- ✅ **Riproduzione vocale** tramite Web Speech API (con fallback ai termini italiani quando la voce dialettale non è disponibile).
- ✅ **Scansione QR code** basata su [`html5-qrcode`](https://github.com/mebjas/html5-qrcode): inquadra un codice contenente il numero e ascolta subito la pronuncia.
- ✅ **Interfaccia responsive** pensata per schermi mobili e desktop, con modalità scura rispettata automaticamente.

## Struttura del progetto

```
.
├── data.json      # Archivio dei numeri con testi italiano/dialetto
├── index.html     # Pagina principale dell'app
├── script.js      # Logica dell'interfaccia, sintesi vocale e scanner QR
└── styles.css     # Stili grafici (tema tombola, responsive)
```

## Come eseguire l'app

Trattandosi di una SPA statica non è necessario alcun build step. È sufficiente servire i file con un web server locale (necessario per permettere al browser di accedere alla fotocamera e leggere `data.json`).

### Utilizzando Python 3

```bash
python3 -m http.server 8000
```

Quindi apri il browser su [http://localhost:8000](http://localhost:8000).

### Utilizzando Node.js (`http-server`)

```bash
npx http-server -p 8000
```

> **Nota:** per permettere l'accesso alla fotocamera, il browser richiede il protocollo `https` oppure `http` su `localhost`. In produzione pubblica la pagina su un dominio `https` (GitHub Pages, Netlify, Vercel, ecc.).

## Formato dei QR code

Lo scanner si aspetta un QR code che contenga **semplicemente il numero** (es. `42`). Quando il valore è valido e presente in `data.json`, l'app mostra la scheda relativa e riproduce l'audio.

## Personalizzazione delle pronunce

Al momento la pronuncia sfrutta la sintesi vocale (`speechSynthesis`) del dispositivo. Per ottenere un risultato fedele al dialetto nojano è possibile:

1. Registrare i file audio originali (uno per numero) e salvarli nella cartella `audio/`.
2. Aggiornare `data.json` aggiungendo un attributo `audio` con il percorso del file.
3. Estendere `script.js` per riprodurre i file locali al posto della sintesi vocale quando disponibili.

## Stato dei dati

Alcune voci dialettali non sono ancora state fornite. In questi casi la UI mostra il messaggio "Registrazione da fornire" e, alla riproduzione, viene letto il testo italiano come fallback. Puoi aggiornare `data.json` man mano che ricevi le traduzioni complete.

## Requisiti del browser

- Supporto alla Web Speech API per la sintesi vocale (Chrome, Edge e Safari moderni).
- Autorizzazione all'uso della fotocamera per la scansione dei QR.

## Licenza

Il contenuto dei testi appartiene ai creatori della Tombola Nojana. Il codice presente in questa repository è rilasciato con licenza MIT (vedi [LICENSE](LICENSE) se presente) oppure può essere riutilizzato liberamente con attribuzione.

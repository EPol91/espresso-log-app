// Invia il promemoria peso via Web Push.
// Eseguito dalla GitHub Action due volte al mattino (UTC); invia solo se in Italia sono ~07:30.
const webpush = require('web-push');

// Chiave pubblica VAPID: pubblica per definizione, ok in chiaro.
const VAPID_PUBLIC = 'BHjSMO8NpAtmamGNWSd8XeR11-cTVPpgkNCE0SbTcSGWph-iRFk_eh_7RNg8GD4EWxAM2KZ32P2alCVTrFpuGAA';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE;
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:emanuel.pol91@gmail.com';
const SUB_RAW = process.env.PUSH_SUBSCRIPTION;

// Orario target in Italia (default 07:30) e finestra di tolleranza (min).
const TH = parseInt(process.env.REMIND_H || '7', 10);
const TM = parseInt(process.env.REMIND_M || '30', 10);
const WINDOW = 30;

if (!VAPID_PRIVATE) { console.error('Manca il secret VAPID_PRIVATE'); process.exit(1); }
if (!SUB_RAW) { console.error('Manca il secret PUSH_SUBSCRIPTION'); process.exit(1); }

// Ora attuale in Europe/Rome (gestisce da sé l'ora legale).
const parts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hour12: false
}).formatToParts(new Date());
const rh = parseInt(parts.find(p => p.type === 'hour').value, 10);
const rm = parseInt(parts.find(p => p.type === 'minute').value, 10);
const nowMin = rh * 60 + rm;
const tgtMin = TH * 60 + TM;

if (Math.abs(nowMin - tgtMin) > WINDOW) {
  console.log(`In Italia sono ${rh}:${String(rm).padStart(2,'0')}, non è ~${TH}:${String(TM).padStart(2,'0')}. Nessun invio.`);
  process.exit(0);
}

let sub;
try { sub = JSON.parse(SUB_RAW); } catch (e) { console.error('PUSH_SUBSCRIPTION non è JSON valido'); process.exit(1); }

webpush.setVapidDetails(SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const payload = JSON.stringify({ title: 'Promemoria peso', body: 'Registra il peso di oggi' });

webpush.sendNotification(sub, payload)
  .then(() => { console.log(`Push inviato (Italia ${rh}:${String(rm).padStart(2,'0')}).`); })
  .catch((err) => {
    console.error('Errore invio push:', err.statusCode, err.body || err.message);
    // 404/410 = iscrizione scaduta: l'utente deve rigenerare il recapito.
    process.exit(1);
  });

// Invia il promemoria peso via Web Push.
// Eseguito dalla GitHub Action ogni 15 min. Logica robusta ai ritardi delle cron di GitHub:
// invia al PRIMO run del giorno che cade DOPO l'orario scelto, e una sola volta al giorno (marker).
const webpush = require('web-push');
const fs = require('fs');
const path = require('path');

// Chiave pubblica VAPID: pubblica per definizione, ok in chiaro.
const VAPID_PUBLIC = 'BHjSMO8NpAtmamGNWSd8XeR11-cTVPpgkNCE0SbTcSGWph-iRFk_eh_7RNg8GD4EWxAM2KZ32P2alCVTrFpuGAA';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE;
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:emanuel.pol91@gmail.com';
const SUB_RAW = process.env.PUSH_SUBSCRIPTION;
const MARKER = path.join(__dirname, '.last-sent');

// Orario target in Italia — repo Variable REMIND_TIME ("HH:MM"). Default 07:30.
const RT = (process.env.REMIND_TIME || '07:30').split(':');
const TH = parseInt(RT[0], 10); const TM = parseInt(RT[1], 10);
const targetH = isNaN(TH) ? 7 : TH;
const targetM = isNaN(TM) ? 30 : TM;
// Non inviare oltre queste ore dopo il target (evita notifiche a metà giornata se GitHub è molto in ritardo).
const CAP_MIN = 180;

const FORCE = String(process.env.FORCE || '').toLowerCase() === 'true';

if (!VAPID_PRIVATE) { console.error('Manca il secret VAPID_PRIVATE'); process.exit(1); }
if (!SUB_RAW) { console.error('Manca il secret PUSH_SUBSCRIPTION'); process.exit(1); }

// Ora + data attuali in Europe/Rome (gestisce da sé l'ora legale).
const p = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false
}).formatToParts(new Date());
const get = t => p.find(x => x.type === t).value;
const rh = parseInt(get('hour'), 10);
const rm = parseInt(get('minute'), 10);
const romeDate = `${get('year')}-${get('month')}-${get('day')}`;
const nowMin = rh * 60 + rm;
const tgtMin = targetH * 60 + targetM;
const hhmm = `${String(rh).padStart(2,'0')}:${String(rm).padStart(2,'0')}`;

if (!FORCE) {
  if (nowMin < tgtMin) { console.log(`In Italia sono ${hhmm}, prima di ${process.env.REMIND_TIME || '07:30'}. Attendo.`); process.exit(0); }
  if (nowMin > tgtMin + CAP_MIN) { console.log(`In Italia sono ${hhmm}, troppo tardi rispetto al target. Salto per oggi.`); process.exit(0); }
  let last = '';
  try { last = fs.readFileSync(MARKER, 'utf8').trim(); } catch (e) {}
  if (last === romeDate) { console.log(`Già inviato oggi (${romeDate}).`); process.exit(0); }
}

let sub;
try { sub = JSON.parse(SUB_RAW); } catch (e) { console.error('PUSH_SUBSCRIPTION non è JSON valido'); process.exit(1); }

webpush.setVapidDetails(SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
const payload = JSON.stringify({ title: 'Promemoria peso', body: 'Registra il peso di oggi' });

webpush.sendNotification(sub, payload)
  .then(() => {
    if (!FORCE) { try { fs.writeFileSync(MARKER, romeDate); } catch (e) {} }
    console.log(`Push inviato (Italia ${hhmm}).`);
  })
  .catch((err) => {
    console.error('Errore invio push:', err.statusCode, err.body || err.message);
    process.exit(1);
  });

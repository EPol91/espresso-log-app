// Cloudflare Worker — Promemoria peso via Web Push.
// Cron affidabile (Cloudflare) → firma VAPID (Web Crypto) → push "a vuoto" al recapito.
// Il service worker della PWA mostra la notifica di default ("Promemoria peso").
//
// Variabili/secret da impostare nel dashboard (Settings → Variables and Secrets):
//   VAPID_PRIVATE      (Secret)   chiave privata VAPID
//   PUSH_SUBSCRIPTION  (Secret)   recapito push (JSON dal telefono)
//   REMIND_TIME        (Variable) orario in Italia, es. "07:30" (sui quarti d'ora). Default 07:30.
//   VAPID_SUBJECT      (Variable) opzionale, default mailto sotto.
//
// Cron Trigger consigliato: */15 * * * *  (ogni 15 min; invia solo all'orario scelto)

const VAPID_PUBLIC = 'BHjSMO8NpAtmamGNWSd8XeR11-cTVPpgkNCE0SbTcSGWph-iRFk_eh_7RNg8GD4EWxAM2KZ32P2alCVTrFpuGAA';
const WINDOW_MIN = 7;

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(run(env, false));
  },
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.searchParams.get('force') === '1') {
      const msg = await run(env, true);
      return new Response(msg, { status: 200 });
    }
    return new Response('Worker promemoria peso attivo. Aggiungi ?force=1 per un invio di test.', { status: 200 });
  }
};

async function run(env, force) {
  try {
    const remind = (env.REMIND_TIME || '07:30').trim();
    const [th, tm] = remind.split(':').map(n => parseInt(n, 10));
    const tgt = (isNaN(th) ? 7 : th) * 60 + (isNaN(tm) ? 30 : tm);

    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(new Date());
    const rh = parseInt(parts.find(p => p.type === 'hour').value, 10);
    const rm = parseInt(parts.find(p => p.type === 'minute').value, 10);
    const cur = rh * 60 + rm;
    const hhmm = `${String(rh).padStart(2,'0')}:${String(rm).padStart(2,'0')}`;

    if (!force && Math.abs(cur - tgt) > WINDOW_MIN) {
      return `Roma ${hhmm}: non è ${remind}. Nessun invio.`;
    }
    if (!env.PUSH_SUBSCRIPTION) return 'Manca PUSH_SUBSCRIPTION.';
    if (!env.VAPID_PRIVATE) return 'Manca VAPID_PRIVATE.';

    const sub = JSON.parse(env.PUSH_SUBSCRIPTION);
    const res = await sendPush(sub, env);
    return `Roma ${hhmm}: push inviato, stato HTTP ${res.status}.`;
  } catch (e) {
    return 'Errore: ' + (e && e.message || e);
  }
}

async function sendPush(sub, env) {
  const endpoint = sub.endpoint;
  const aud = new URL(endpoint).origin;
  const jwt = await vapidJWT(aud, env);
  return fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `vapid t=${jwt}, k=${VAPID_PUBLIC}`,
      'TTL': '86400'
    }
  });
}

async function vapidJWT(aud, env) {
  const header = b64url(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const now = Math.floor(Date.now() / 1000);
  const claims = { aud, exp: now + 12 * 3600, sub: env.VAPID_SUBJECT || 'mailto:emanuel.pol91@gmail.com' };
  const payload = b64url(new TextEncoder().encode(JSON.stringify(claims)));
  const unsigned = `${header}.${payload}`;

  const pub = b64urlToU8(VAPID_PUBLIC); // 65 byte: 0x04 || X(32) || Y(32)
  const jwk = {
    kty: 'EC', crv: 'P-256',
    x: b64url(pub.slice(1, 33)),
    y: b64url(pub.slice(33, 65)),
    d: env.VAPID_PRIVATE.trim(),
    ext: true
  };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${b64url(new Uint8Array(sig))}`;
}

function b64url(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlToU8(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = str.length % 4 ? '='.repeat(4 - (str.length % 4)) : '';
  const bin = atob(str + pad);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

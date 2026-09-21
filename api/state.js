import { put, list, del } from '@vercel/blob';

/* Vercel Blob vynucuje minimálně 60s CDN cache, takže přepisovat pořád stejný
   pathname nejde — čtení pak vrací starou verzi. Proto se každý zápis ukládá pod
   NOVÝ pathname (`state/<verze>-<ts>.json`) a aktuální se hledá přes list(),
   které jde na API, ne přes CDN. Staré blobs se průběžně mažou.               */

const PREFIX = 'state/';
const KEEP = 12;                 // historie pro "Vrátit zpět"
const EMPTY = {
  version: 0,
  updatedAt: null,
  updatedBy: null,
  data: { assign: {}, spani: {}, caps: {}, floor: {}, seats: {}, seatVers: null, seatCur: null },
};
// Počítá odvedenou práci: lůžka i židle. Sezení musí být chráněné stejně jako spaní.
const nAssign = p => Object.keys((p && p.data && p.data.assign) || {}).length
                   + Object.keys((p && p.data && p.data.seats) || {}).length;

async function readAll() {
  const { blobs } = await list({ prefix: PREFIX, limit: 1000 });
  // pathname začíná nulami doplněnou verzí → sestupně lexikograficky = nejnovější první
  return [...blobs].sort((a, b) => (a.pathname < b.pathname ? 1 : a.pathname > b.pathname ? -1 : 0));
}

async function fetchPayload(blob) {
  try {
    const r = await fetch(blob.url, { cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    return typeof j.version === 'number' ? j : null;
  } catch { return null; }
}

async function readCurrent() {
  const blobs = await readAll();
  if (!blobs.length) return { payload: EMPTY, blobs: [] };
  return { payload: (await fetchPayload(blobs[0])) || EMPTY, blobs };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  try {
    if (req.method === 'GET') {
      // ?history=1 → přehled posledních verzí pro obnovu
      if (req.query && req.query.history) {
        const blobs = await readAll();
        const items = [];
        for (const b of blobs.slice(0, KEEP)) {
          const p = await fetchPayload(b);
          if (p) items.push({ version: p.version, updatedAt: p.updatedAt,
                              updatedBy: p.updatedBy, count: nAssign(p) });
        }
        return res.status(200).json({ history: items });
      }
      // ?version=N → konkrétní verze (obnova)
      if (req.query && req.query.version) {
        const want = +req.query.version;
        for (const b of await readAll()) {
          const p = await fetchPayload(b);
          if (p && p.version === want) return res.status(200).json(p);
        }
        return res.status(404).json({ error: 'verze nenalezena' });
      }
      const { payload } = await readCurrent();
      return res.status(200).json(payload);
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const { payload: cur, blobs } = await readCurrent();

      // optimistický zámek — klient posílá verzi, na které stavěl
      if (typeof body.version === 'number' && body.version !== cur.version) {
        return res.status(409).json({ conflict: true, current: cur });
      }

      const d = body.data || {};
      const next = {
        version: cur.version + 1,
        updatedAt: new Date().toISOString(),
        updatedBy: String(body.by || 'někdo').slice(0, 40),
        data: {
          assign: d.assign && typeof d.assign === 'object' ? d.assign : {},
          spani: d.spani && typeof d.spani === 'object' ? d.spani : {},
          caps: d.caps && typeof d.caps === 'object' ? d.caps : {},
          floor: d.floor && typeof d.floor === 'object' ? d.floor : {},
          seats: d.seats && typeof d.seats === 'object' ? d.seats : {},
          /* Varianty zasedačky. Musí být v tomhle seznamu, jinak je server při
             každém zápisu zahodí a varianty pak žijí jen v localStorage
             jednotlivých zařízení — každý organizátor má svoje a nikdy se
             nepotkají. Narazili jsme na to a hledalo se to dlouho.            */
          seatVers: d.seatVers && typeof d.seatVers === 'object' ? d.seatVers : null,
          seatCur: typeof d.seatCur === 'string' ? d.seatCur : null,
        },
      };

      /* Pojistka proti vymazání práce: zápis, který smaže VŠECHNA přiřazení,
         projde jen s explicitním force. Chrání proti omylu i proti závodu
         mezi klienty. Klient dostane 409 a nabídne obnovu.                  */
      if (nAssign(cur) > 0 && nAssign(next) === 0 && !body.force) {
        return res.status(409).json({ blocked: 'would_erase', current: cur });
      }

      const pathname = `${PREFIX}${String(next.version).padStart(9, '0')}-${Date.now()}.json`;
      await put(pathname, JSON.stringify(next), {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'application/json',
      });

      const stale = blobs.slice(KEEP - 1);
      if (stale.length) { try { await del(stale.map((b) => b.url)); } catch {} }

      return res.status(200).json(next);
    }

    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
}

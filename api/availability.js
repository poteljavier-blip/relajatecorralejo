'use strict';

const FEEDS = {
  relajate: ['RELAX_BOOKING_ICAL', 'RELAX_AIRBNB_ICAL'],
  downtown: ['DOWNTOWN_BOOKING_ICAL', 'DOWNTOWN_AIRBNB_ICAL']
};

function datesFromIcal(ical) {
  const lines = ical.replace(/\r\n[ \t]/g, '').split(/\r?\n/);
  const events = [];
  let start = null, end = null, inEvent = false;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { inEvent = true; start = end = null; }
    else if (line === 'END:VEVENT') {
      if (inEvent && start && end && start < end) events.push([start, end]);
      inEvent = false;
    } else if (inEvent) {
      const match = line.match(/^DT(START|END)(?:;[^:]*)?:(\d{8})/);
      if (match) {
        const date = match[2].replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
        if (match[1] === 'START') start = date; else end = date;
      }
    }
  }
  return events;
}

function merge(ranges) {
  ranges.sort((a, b) => a[0].localeCompare(b[0]));
  const merged = [];
  for (const [start, end] of ranges) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) last[1] = last[1] > end ? last[1] : end;
    else merged.push([start, end]);
  }
  return merged;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Método no permitido' }); }
  const apartment = req.query.apartment;
  if (!Object.prototype.hasOwnProperty.call(FEEDS, apartment)) return res.status(400).json({ error: 'Apartamento incorrecto' });
  const { arrival, departure } = req.query;
  const valid = /^\\d{4}-\\d{2}-\\d{2}$/;
  if (typeof arrival !== 'string' || typeof departure !== 'string' || !valid.test(arrival) || !valid.test(departure) ||
      new Date(arrival).toISOString().slice(0, 10) !== arrival || new Date(departure).toISOString().slice(0, 10) !== departure ||
      departure <= arrival || (new Date(departure) - new Date(arrival)) / 86400000 > 90) {
    return res.status(400).json({ error: 'Fechas incorrectas' });
  }
  const urls = FEEDS[apartment].map(key => process.env[key]);
  if (urls.some(url => !url || !/^https:\/\//.test(url))) return res.status(503).json({ error: 'Calendario pendiente de configurar' });
  try {
    const calendars = await Promise.all(urls.map(async url => {
      const response = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { Accept: 'text/calendar' } });
      if (!response.ok) throw Error('Calendar fetch failed');
      const content = await response.text();
      if (!content.includes('BEGIN:VCALENDAR') || content.length > 2_000_000) throw Error('Invalid calendar');
      return datesFromIcal(content);
    }));
    const occupied = merge(calendars.flat()).some(([start, end]) => arrival < end && departure > start);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json({ available: !occupied, note: 'Disponibilidad orientativa; reserva pendiente de confirmación.' });
  } catch {
    return res.status(503).json({ error: 'No se pudo comprobar la ocupación. Consulta por WhatsApp.' });
  }
};

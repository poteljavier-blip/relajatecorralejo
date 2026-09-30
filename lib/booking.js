'use strict';
const crypto = require('node:crypto');
const APARTMENTS = {
  relajate: { name: 'Relájate y Disfruta Corralejo', rate: 120, guests: 4, feeds: ['RELAX_BOOKING_ICAL','RELAX_AIRBNB_ICAL'] },
  downtown: { name: 'Corralejo Downtown', rate: 60, guests: 2, feeds: ['DOWNTOWN_BOOKING_ICAL','DOWNTOWN_AIRBNB_ICAL'] }
};
function today(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB',{timeZone:'Atlantic/Canary',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const value = key => parts.find(p=>p.type===key).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
function quote(input, now = new Date()) {
  const apartment = APARTMENTS[input.apartment];
  const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
  if (!apartment || !validDate(input.arrival) || !validDate(input.departure)) throw Error('Fechas o apartamento incorrectos');
  const nights = (Date.parse(input.departure)-Date.parse(input.arrival))/86400000;
  const guests = Number(input.guests);
  if(input.arrival<today(now)||nights<3||nights>90||!Number.isInteger(nights)||!Number.isInteger(guests)||guests<1||guests>apartment.guests) throw Error('Estancia o huéspedes incorrectos');
  const total = nights*apartment.rate*100;
  return {apartment:input.apartment,arrival:input.arrival,departure:input.departure,guests,nights,total,deposit:total/5,balance:total*4/5,cancellationDeadline:new Date(Date.parse(input.arrival)-15*86400000).toISOString().slice(0,10)};
}
function datesFromIcal(content) {
  if(!content.includes('BEGIN:VCALENDAR')||content.length>2_000_000) throw Error('Calendario incorrecto');
  const ranges=[];
  let event=null;
  for(const line of content.replace(/\r?\n[ \t]/g,'').split(/\r?\n/)) {
    if(line==='BEGIN:VEVENT') event={};
    else if(line==='END:VEVENT') {
      if(event && event.status!=='CANCELLED') {
        if(!event.start||!event.end||event.start>=event.end) throw Error('Evento incompleto');
        ranges.push([event.start,event.end]);
      }
      event=null;
    } else if(event) {
      if(line.startsWith('STATUS:')) event.status=line.slice(7);
      const match=line.match(/^DT(START|END)(?:;[^:]*)?:(\d{4})(\d{2})(\d{2})(?:T\d{6}Z?)?$/);
      if(match) event[match[1]==='START'?'start':'end']=`${match[2]}-${match[3]}-${match[4]}`;
    }
  }
  if(event) throw Error('Evento sin cerrar');
  return ranges;
}
async function availableOnChannels(q) {
  const ranges=await Promise.all(APARTMENTS[q.apartment].feeds.map(async key=>{
    const url=process.env[key];
    if(!url||!url.startsWith('https://')) throw Error('Calendario no configurado');
    const response=await fetch(url,{signal:AbortSignal.timeout(8000),headers:{Accept:'text/calendar'}});
    if(!response.ok) throw Error('Calendario no disponible');
    return datesFromIcal(await response.text());
  }));
  return !ranges.flat().some(([start,end])=>q.arrival<end&&q.departure>start);
}
const tokenHash = token => crypto.createHash('sha256').update(token).digest('hex');
function paymentMatches(session, booking) {
  return session.payment_status==='paid' && session.currency==='eur' && session.amount_total===booking.deposit_cents && session.metadata?.booking_id===booking.id && (!booking.session_id||booking.session_id===session.id);
}
module.exports={APARTMENTS,today,quote,datesFromIcal,availableOnChannels,tokenHash,paymentMatches};

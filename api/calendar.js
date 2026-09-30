'use strict';
const crypto=require('node:crypto');
const {db,headers}=require('../lib/services');
const {APARTMENTS}=require('../lib/booking');
module.exports=async(req,res)=>{
  headers(res);
  if(req.method!=='GET')return res.status(405).end();
  const {apartment,token}=req.query,secret=process.env.CALENDAR_EXPORT_TOKEN;
  if(!secret||typeof token!=='string'||!APARTMENTS[apartment]||Buffer.byteLength(token)!==Buffer.byteLength(secret)||!crypto.timingSafeEqual(Buffer.from(token),Buffer.from(secret)))return res.status(404).end();
  try {
    const {rows}=await db().query("SELECT id,arrival::text,departure::text FROM bookings WHERE apartment=$1 AND status IN ('held','confirmed') ORDER BY arrival",[apartment]);
    const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
    const events=rows.flatMap(b=>['BEGIN:VEVENT',`UID:${b.id}@relajatecorralejo.com`,`DTSTAMP:${stamp}`,`DTSTART;VALUE=DATE:${b.arrival.replace(/-/g,'')}`,`DTEND;VALUE=DATE:${b.departure.replace(/-/g,'')}`,'SUMMARY:No disponible','END:VEVENT']);
    res.setHeader('Content-Type','text/calendar; charset=utf-8');
    return res.status(200).send(['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Relajate Corralejo//Reservas//ES','CALSCALE:GREGORIAN',...events,'END:VCALENDAR',''].join('\r\n'));
  } catch{return res.status(503).end();}
};

'use strict';
const crypto=require('node:crypto');
const {quote,availableOnChannels,APARTMENTS,tokenHash}=require('../lib/booking');
const {db,stripe,enabled,origin,headers}=require('../lib/services');
module.exports=async (req,res)=>{
  headers(res);
  if(req.method!=='POST') {res.setHeader('Allow','POST');return res.status(405).json({error:'Método no permitido'});}
  if(req.headers.origin!==origin()) return res.status(403).json({error:'Origen incorrecto'});
  if(!enabled()) return res.status(503).json({error:'Pago online pendiente de activar. Solicita la reserva por WhatsApp.'});
  let q;
  try { q=quote(req.body||{}); } catch { return res.status(400).json({error:'Fechas o huéspedes incorrectos'}); }
  try {
    if(!await availableOnChannels(q)) return res.status(409).json({error:'Fechas ocupadas'});
    const id=crypto.randomUUID(),token=crypto.randomBytes(32).toString('hex');
    await db().query('INSERT INTO bookings(id,apartment,arrival,departure,guests,total_cents,deposit_cents,token_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,q.apartment,q.arrival,q.departure,q.guests,q.total,q.deposit,tokenHash(token)]);
    // On an ambiguous Stripe/network failure retain the hold for reconciliation: a payment session may exist.
    const session=await stripe().checkout.sessions.create({mode:'payment',payment_method_types:['card'],locale:'es',expires_at:Math.floor(Date.now()/1000)+1800,
      line_items:[{quantity:1,price_data:{currency:'eur',unit_amount:q.deposit,product_data:{name:`Señal del 20 % · ${APARTMENTS[q.apartment].name}`,description:`${q.arrival} a ${q.departure} · ${q.nights} noches · Total ${q.total/100} € · 80 % (${q.balance/100} €) al llegar`}}}],
      metadata:{booking_id:id},client_reference_id:id,
      success_url:`${origin()}/reserva.html?id=${id}&token=${token}`,
      cancel_url:`${origin()}/reserva.html?id=${id}&token=${token}&cancelled=1`
    },{idempotencyKey:`booking-${id}`});
    await db().query('UPDATE bookings SET session_id=$2 WHERE id=$1 AND (session_id IS NULL OR session_id=$2)',[id,session.id]);
    return res.status(200).json({url:session.url});
  } catch(error) {
    if(error.code==='23P01') return res.status(409).json({error:'Otra reserva ha bloqueado estas fechas. Elige otras fechas.'});
    return res.status(503).json({error:'No se ha podido iniciar el pago. Contacta por WhatsApp antes de reintentarlo.'});
  }
};

'use strict';
const {stripe,db,headers}=require('../lib/services');
const {fulfill,expire}=require('../lib/fulfill');
module.exports=async(req,res)=>{
  headers(res);
  if(req.method!=='POST') {res.setHeader('Allow','POST');return res.status(405).end();}
  if(!process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).end();
  let event;
  try {
    const chunks=[];let length=0;
    for await(const chunk of req) {length+=chunk.length;if(length>1024*1024)throw Error('Too large');chunks.push(Buffer.from(chunk));}
    event=stripe().webhooks.constructEvent(Buffer.concat(chunks),req.headers['stripe-signature'],process.env.STRIPE_WEBHOOK_SECRET);
  } catch {return res.status(400).json({error:'Firma incorrecta'});}
  try {
    if(event.type==='checkout.session.completed') await fulfill(event.data.object,db());
    if(event.type==='checkout.session.expired') await expire(event.data.object,db());
    return res.status(200).json({received:true});
  } catch { return res.status(500).json({error:'Confirmación pendiente; reintentar notificación'}); }
};
module.exports.config={api:{bodyParser:false}};

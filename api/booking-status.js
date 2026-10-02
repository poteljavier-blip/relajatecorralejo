'use strict';
const {db,headers}=require('../lib/services');
const {tokenHash,APARTMENTS}=require('../lib/booking');
module.exports=async(req,res)=>{
  headers(res);
  if(req.method!=='GET') return res.status(405).end();
  const {id,token}=req.query;
  if(typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id)||typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token)) return res.status(404).end();
  try {
    const {rows}=await db().query("SELECT status,apartment,arrival::text,departure::text,total_cents,deposit_cents FROM bookings WHERE id=$1 AND token_hash=$2",[id,tokenHash(token)]);
    if(!rows.length)return res.status(404).end();
    const b=rows[0];
    return res.status(200).json({status:b.status,name:APARTMENTS[b.apartment].name,arrival:b.arrival,departure:b.departure,total:b.total_cents/100,deposit:b.deposit_cents/100,balance:(b.total_cents-b.deposit_cents)/100});
  } catch{return res.status(503).json({error:'Confirmación no disponible'});}
};

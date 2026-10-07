'use strict';
const crypto=require('node:crypto');
const {db,stripe,headers}=require('../lib/services');
const {fulfill,expire}=require('../lib/fulfill');
function authorized(req) {
  const secret=process.env.BOOKING_RECOVERY_SECRET;
  const value=req.headers.authorization || '';
  if(!secret || secret.length<32) return false;
  const expected=Buffer.from('Bearer '+secret),actual=Buffer.from(value);
  return actual.length===expected.length && crypto.timingSafeEqual(actual,expected);
}
module.exports=async(req,res)=>{
  headers(res);
  if(req.method!=='POST') {res.setHeader('Allow','POST');return res.status(405).end();}
  if(!authorized(req)) return res.status(401).end();
  const pool=db(),client=stripe();
  const result={confirmed:0,expired:0,open:0,unresolved:0,failed:0};
  try {
    const {rows}=await pool.query("SELECT id,session_id,created_at FROM bookings WHERE status='held' AND created_at<now()-interval '35 minutes' ORDER BY created_at LIMIT 10");
    for(const booking of rows) {
      try {
        let session;
        if(booking.session_id) session=await client.checkout.sessions.retrieve(booking.session_id);
        else {
          // Recover orphan sessions by metadata. An absent result never proves no payment exists.
          let cursor,found=[],finished=false;
          const from=Math.floor(new Date(booking.created_at).getTime()/1000)-60;
          for(let page=0;page<5;page++) {
            const batch=await client.checkout.sessions.list({limit:100,created:{gte:from,lte:from+3660},...(cursor?{starting_after:cursor}:{})});
            found.push(...batch.data.filter(s=>s.metadata?.booking_id===booking.id));
            if(!batch.has_more){finished=true;break;}
            cursor=batch.data[batch.data.length-1]?.id;
            if(!cursor) break;
          }
          if(!finished || found.length!==1) {result.unresolved++;continue;}
          session=found[0];
          await pool.query("UPDATE bookings SET session_id=$2 WHERE id=$1 AND status='held' AND session_id IS NULL",[booking.id,session.id]);
        }
        if(session.metadata?.booking_id!==booking.id) {result.unresolved++;continue;}
        if(session.payment_status==='paid') {await fulfill(session,pool);result.confirmed++;}
        else if(session.status==='expired') {await expire(session,pool);result.expired++;}
        else {result.open++;}
      } catch {result.failed++;}
    }
    return res.status(200).json(result);
  } catch {return res.status(503).json({error:'Recuperación no disponible'});}
};

'use strict';
const {paymentMatches}=require('./booking');
async function fulfill(session,pool) {
  const id=session.metadata?.booking_id;
  if(!id||!/^[a-f0-9-]{36}$/.test(id)) return false;
  const conn=await pool.connect();
  try {
    await conn.query('BEGIN');
    const {rows}=await conn.query('SELECT * FROM bookings WHERE id=$1 FOR UPDATE',[id]);
    if(!rows.length) throw Error('Reserva desconocida');
    const booking=rows[0];
    if(!paymentMatches(session,booking)||booking.status==='expired') throw Error('Pago no coincide con la reserva');
    if(booking.status!=='confirmed') await conn.query("UPDATE bookings SET status='confirmed',session_id=$2,confirmed_at=now() WHERE id=$1",[id,session.id]);
    await conn.query('COMMIT');
    return true;
  } catch(error) {await conn.query('ROLLBACK');throw error;} finally {conn.release();}
}
async function expire(session,pool) {
  if(session.status!=='expired'||session.payment_status==='paid') return;
  await pool.query("UPDATE bookings SET status='expired' WHERE id=$1 AND status='held' AND (session_id=$2 OR session_id IS NULL)",[session.metadata?.booking_id,session.id]);
}
module.exports={fulfill,expire};

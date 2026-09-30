'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {quote,datesFromIcal,today,paymentMatches}=require('../lib/booking');
const {fulfill,expire}=require('../lib/fulfill');
const now=new Date('2026-09-30T09:00:00Z');
const input={apartment:'relajate',arrival:'2026-11-01',departure:'2026-11-04',guests:4};
test('three nights cost 360 EUR / 72 deposit / 288 at arrival; downtown 180 / 36 / 144',()=>{
  const q=quote(input,now);assert.deepEqual([q.total,q.deposit,q.balance,q.cancellationDeadline],[36000,7200,28800,'2026-10-17']);
  const d=quote({...input,apartment:'downtown',guests:2},now);assert.deepEqual([d.total,d.deposit,d.balance],[18000,3600,14400]);
});
test('reject past, invalid calendar days, less than minimum, excessive guests and client supplied prices',()=>{
  for(const change of [{arrival:'2026-02-30'},{arrival:'2026-01-01',departure:'2026-01-05'},{departure:'2026-11-03'},{guests:5},{apartment:'downtown',guests:3}])assert.throws(()=>quote({...input,...change},now));
  assert.equal(quote({...input,total:1,deposit:1},now).deposit,7200);
});
test('use Canary date across summer midnight',()=>assert.equal(today(new Date('2026-09-30T23:30:00Z')),'2026-10-01'));
test('parse occupied nights and ignore cancelled events; malformed calendar fails closed',()=>{
  const ical='BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20261101\r\nDTEND;VALUE=DATE:20261104\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nSTATUS:CANCELLED\r\nEND:VEVENT\r\nEND:VCALENDAR';
  assert.deepEqual(datesFromIcal(ical),[['2026-11-01','2026-11-04']]);
  assert.throws(()=>datesFromIcal('BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20261101\nEND:VEVENT\nEND:VCALENDAR'));
});
const booking={id:'12345678-1234-1234-1234-123456789abc',deposit_cents:7200,session_id:'cs_test_1',status:'held'};
const session={id:'cs_test_1',metadata:{booking_id:booking.id},amount_total:7200,currency:'eur',payment_status:'paid'};
test('payment must match amount, currency, booking and session',()=>{
  assert.equal(paymentMatches(session,booking),true);
  for(const change of [{amount_total:1},{currency:'usd'},{id:'cs_other'},{payment_status:'unpaid'},{metadata:{booking_id:'other'}}])assert.equal(paymentMatches({...session,...change},booking),false);
});
function mockPool(record){
  const calls=[];
  const conn={query:async(sql,args)=>{calls.push(sql);if(sql.startsWith('SELECT'))return {rows:[record]};if(sql.startsWith('UPDATE'))record.status='confirmed';return {rows:[]};},release:()=>calls.push('release')};
  return {connect:async()=>conn,calls,query:conn.query};
}
test('duplicate payment notification confirms only once',async()=>{
  const pool=mockPool({...booking});await fulfill(session,pool);await fulfill(session,pool);
  assert.equal(pool.calls.filter(s=>s.startsWith('UPDATE')).length,1);
});
test('bad amount rolls back and never confirms; expired hold cannot become confirmed',async()=>{
  const pool=mockPool({...booking});await assert.rejects(fulfill({...session,amount_total:1},pool));assert(pool.calls.includes('ROLLBACK'));assert(!pool.calls.some(s=>s.startsWith('UPDATE')));
  await assert.rejects(fulfill(session,mockPool({...booking,status:'expired'})));
});
test('release dates only for Stripe-expired unpaid sessions',async()=>{
  const pool=mockPool({...booking});await expire({...session,status:'open',payment_status:'unpaid'},pool);await expire({...session,status:'expired'},pool);assert.equal(pool.calls.length,0);
  await expire({...session,status:'expired',payment_status:'unpaid'},pool);assert.equal(pool.calls.length,1);
});

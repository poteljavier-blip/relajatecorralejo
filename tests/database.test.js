'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
// Run against an isolated test database only; verifies actual concurrent exclusion, not a mock.
test('database rejects simultaneous overlapping holds but accepts adjacent stays',{skip:!process.env.TEST_DATABASE_URL},async()=>{
  const {Pool}=require('pg'),pool=new Pool({connectionString:process.env.TEST_DATABASE_URL,max:3});
  const ids=[crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID()];
  const insert=(id,start,end)=>pool.query("INSERT INTO bookings(id,apartment,arrival,departure,guests,total_cents,deposit_cents,token_hash) VALUES($1,'downtown',$2,$3,2,18000,3600,'test')",[id,start,end]);
  try{
    const results=await Promise.allSettled([insert(ids[0],'2099-01-01','2099-01-04'),insert(ids[1],'2099-01-02','2099-01-05')]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.code,'23P01');
    await insert(ids[2],'2099-01-05','2099-01-08');
  }finally{await pool.query('DELETE FROM bookings WHERE id=ANY($1::uuid[])',[ids]);await pool.end();}
});

'use strict';
let pool, client;
function db() {
  if(!process.env.DATABASE_URL) throw Error('Base de datos no configurada');
  if(!pool) pool=new (require('pg').Pool)({connectionString:process.env.DATABASE_URL,max:3,connectionTimeoutMillis:8000});
  return pool;
}
function stripeKey() { return process.env.STRIPE_SECRET_KEY || process.env.STRIPEIPE_SECRET_KEY; }
function stripe() {
  if(!stripeKey()) throw Error('Stripe no configurado');
  if(!client) client=new (require('stripe'))(stripeKey(),{timeout:15000,maxNetworkRetries:2});
  return client;
}
function enabled() { return process.env.BOOKING_ENABLED==='true' && process.env.BOOKING_CHANNELS_READY==='true' && Boolean(process.env.DATABASE_URL && stripeKey() && process.env.STRIPE_WEBHOOK_SECRET && process.env.CALENDAR_EXPORT_TOKEN); }
function origin() { return 'https://relajatecorralejo.com'; }
function headers(res) {res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');}
module.exports={db,stripe,enabled,origin,headers};

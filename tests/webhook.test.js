'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{Readable}=require('node:stream');
const Stripe=require('stripe');
process.env.STRIPE_SECRET_KEY='sk_test_local_only';process.env.STRIPE_WEBHOOK_SECRET='whsec_local_only';
const handler=require('../api/stripe-webhook');
function response(){return{code:0,body:null,setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;},end(){return this;}};}
const payload=JSON.stringify({id:'evt_test',type:'unhandled.event',data:{object:{}}});
const signature=Stripe.webhooks.generateTestHeaderString({payload,secret:process.env.STRIPE_WEBHOOK_SECRET});
function request(content,signature){const req=Readable.from([Buffer.from(content)]);req.method='POST';req.headers={'stripe-signature':signature};return req;}
test('accept genuine signature without making a Stripe network call',async()=>{const res=response();await handler(request(payload,signature),res);assert.equal(res.code,200);});
test('reject body tampering and missing signatures',async()=>{for(const req of [request(payload+' ',signature),request(payload,undefined)]){const res=response();await handler(req,res);assert.equal(res.code,400);}});
test('checkout disabled without every required configuration',()=>{const {enabled}=require('../lib/services');assert.equal(enabled(),false);});

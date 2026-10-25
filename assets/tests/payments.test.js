import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server.js";
import { clean } from "../validate.js";
import { signature, createCheckout, resultXml, verifySignature } from "../payments.js";

const token="a".repeat(48),id="12345678",orderId="b".repeat(32),secret="test-only-secret";
const env={SUPABASE_URL:"https://db.example/rest/v1/",SUPABASE_SERVICE_KEY:"sb_secret_test",PUBLIC_URL:"https://shop.example",FREEDOMPAY_MERCHANT_ID:"123",FREEDOMPAY_SECRET_KEY:secret,ADMIN_KEY:"test-admin"};
async function fixture(overrides={},missingLedger=false) {
  const invitation={id,edit_token:token,data:clean({names:"Тест",dsg:0}),price:2490,paid:true,paid_tier:4};
  const order={id:orderId,inv:id,amount:2490,tier:1,provider_id:"987",status:"pending"};
  let confirms=0;
  const fakeFetch=async(url,options={})=>{
    const u=new URL(url),body=options.body?JSON.parse(options.body):undefined;
    if(u.pathname.endsWith("/shq_invitations")){
      if(options.method==="PATCH"){
        const expected=u.searchParams.get("data->>_rev");
        if(expected!==(invitation.data._rev?"eq."+invitation.data._rev:"is.null"))return Response.json([]);
        Object.assign(invitation,body);
      }
      return Response.json([invitation]);
    }
    if(u.pathname.endsWith("/shq_payments")) {
      if(missingLedger)return new Response("Missing table",{status:404});
      if(options.method==="PATCH"){if(order.status!=="confirmed"&&body.status)order.status=body.status;return Response.json([])}
      if(u.searchParams.get("status")==="eq.confirmed")return Response.json(order.status==="confirmed"?[order]:[]);
      return Response.json([order]);
    }
    if(u.pathname.endsWith("/rpc/shq_confirm_payment")){
      if(body.p_order!==orderId||body.p_provider!==order.provider_id)return Response.json(false);
      if(order.status!=="confirmed")confirms++;order.status="confirmed";order.confirmed_at=new Date().toISOString();return Response.json(true);
    }
    throw new Error("Unexpected test request: "+u.pathname);
  };
  const app=createApp({env:{...env,...overrides},fetchImpl:fakeFetch});
  const server=app.listen(0,"127.0.0.1");await new Promise(r=>server.on("listening",r));
  const origin="http://127.0.0.1:"+server.address().port;
  const call=(p,options={})=>fetch(origin+p,options);
  return {call,invitation,order,get confirms(){return confirms},close:()=>new Promise(r=>server.close(r))};
}
function result(overrides={}) {
  const params={pg_order_id:orderId,pg_payment_id:"987",pg_amount:"2490.00",pg_currency:"KZT",pg_result:"1",pg_testing_mode:"0",pg_captured:"1",pg_salt:"test-salt",...overrides};
  params.pg_sig=signature("result",params,secret);return params;
}
const callback=(f,params)=>f.call("/api/payments/result",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams(params)});

test("Legacy fake paid flags, local tokens in URLs and admin bypass cannot unlock tickets",async()=>{
  const f=await fixture();try{
    assert.equal((await f.call("/api/i/"+id)).status,402);
    assert.equal((await f.call("/api/i/"+id+"?t="+token)).status,402);
    assert.equal((await f.call("/api/inv/"+id+"/guests",{headers:{"x-owner-token":token}})).status,402);
    assert.equal((await f.call("/api/rsvp/"+id,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:"test",status:"yes"})})).status,404);
    assert.equal((await f.call("/api/admin/confirm/"+id,{method:"POST",headers:{"x-admin-key":"test-admin"}})).status,410);
    assert.equal((await f.call("/api/i/"+id,{headers:{"x-owner-token":token}})).status,200);
    assert.equal((await (await f.call("/api/inv/"+id+"/status",{headers:{"x-owner-token":token}})).json()).paid,false);
  }finally{await f.close()}
});
test("Missing merchant account and fake card input never activate a ticket",async()=>{
  const f=await fixture({FREEDOMPAY_SECRET_KEY:""});try{
    assert.equal((await f.call("/api/pay/"+id,{method:"POST",headers:{"Content-Type":"application/json","x-owner-token":token},body:JSON.stringify({card:"1111111111111111",cvv:"123"})})).status,410);
    assert.equal((await f.call("/api/i/"+id)).status,402);
  }finally{await f.close()}
  const configured=await fixture();try{
    assert.equal((await configured.call("/api/pay/"+id,{method:"POST",headers:{"Content-Type":"application/json","x-owner-token":token},body:JSON.stringify({card:"1111111111111111"})})).status,410);
  }finally{await configured.close()}
});
test("Before migration, existing drafts remain editable but legacy payments grant no access",async()=>{
  const f=await fixture({},true);try{
    assert.equal((await f.call("/api/i/"+id)).status,402);
    assert.equal((await f.call("/api/inv/"+id,{method:"PUT",headers:{"Content-Type":"application/json","x-owner-token":token},body:JSON.stringify({data:{names:"Новый черновик"}})})).status,200);
    assert.equal((await f.call("/api/pay/"+id,{method:"POST",headers:{"Content-Type":"application/json","x-owner-token":token},body:"{}"})).status,410);
  }finally{await f.close()}
});
test("Forged, test, wrong amount/currency/merchant/payment and uncaptured payments are rejected",async()=>{
  const cases=[{pg_sig:"0".repeat(32)},{pg_testing_mode:"1"},{pg_amount:"1"},{pg_currency:"USD"},{pg_merchant_id:"999"},{pg_payment_id:"999"},{pg_captured:"0"}];
  for(const patch of cases){const f=await fixture();try{
    const params=result(patch);if(patch.pg_sig)params.pg_sig=patch.pg_sig;
    assert.notEqual((await callback(f,params)).status,200,JSON.stringify(patch));
    assert.equal((await f.call("/api/i/"+id)).status,402);assert.equal(f.confirms,0);
  }finally{await f.close()}}
});
test("Only captured live signed payment grants access; retries are idempotent",async()=>{
  const f=await fixture();try{
    const first=await callback(f,result());assert.equal(first.status,200);
    assert.match(await first.text(),/<pg_status>ok<\/pg_status>/);
    assert.equal((await callback(f,result())).status,200);assert.equal(f.confirms,1);
    assert.equal((await f.call("/api/i/"+id)).status,200);
    await callback(f,result({pg_result:"0"}));assert.equal((await f.call("/api/i/"+id)).status,200);
    f.invitation.data.dsg=19;assert.equal((await f.call("/api/i/"+id)).status,402,"A lower tier payment must not unlock a more expensive design");
  }finally{await f.close()}
});
test("Checkout uses hosted HTTPS payment page, real mode and verified response",async()=>{
  const config={merchant:"123",secret,origin:"https://shop.example"};
  const reply={pg_status:"ok",pg_payment_id:"789",pg_redirect_url:"https://api.freedompay.kz/pay.html?order=789",pg_salt:"salt"};
  reply.pg_sig=signature("init_payment.php",reply,secret);
  const xml='<response>'+Object.entries(reply).map(([k,v])=>`<${k}>${v}</${k}>`).join("")+"</response>";
  const checkout=await createCheckout(config,{id:orderId,amount:2490},async(url,options)=>{
    assert.equal(url,"https://api.freedompay.kz/init_payment.php");assert.equal(options.body.get("pg_testing_mode"),"0");
    assert.equal(options.body.get("pg_amount"),"2490");assert.equal(options.body.get("pg_result_url"),"https://shop.example/api/payments/result");
    assert.equal(options.body.get("pg_auto_clearing"),"1");return new Response(xml);
  });assert.equal(checkout.paymentId,"789");
  await assert.rejects(createCheckout(config,{id:orderId,amount:2490},async()=>new Response(xml.replace(reply.pg_sig,"0".repeat(32)))));
  assert.match(resultXml("ok","Order paid",secret),/<pg_sig>[a-f0-9]{32}<\/pg_sig>/);
  assert.equal(verifySignature("result",{pg_sig:"bad"},secret),false);
});
test("Malformed input and injected media attributes cannot execute HTML",()=>{
  assert.doesNotThrow(()=>clean(null));
  for(const url of ['https://example.com/x" onerror="alert(1)','javascript:alert(1)','data:image/svg+xml;base64,PHN2Zz4=','/covers/../../x.jpg']){
    const value=clean({photo:url,cover:url,mus:url});assert.equal(value.photo,"");assert.equal(value.cover,"");assert.equal(value.mus,"");
  }
});

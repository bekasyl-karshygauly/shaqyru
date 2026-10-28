import crypto from 'node:crypto';
import {createApp} from '../server.js';
export function workflowFixture({env={}}={}){
  const tables={shq_invitations:[],shq_guests:[],shq_payments:[],shq_order_notifications:[],shq_reviews:[],shq_services:[['urgent','Срочное изготовление','Жедел дайындау',1500],['text','Помощь с текстом','Мәтінмен көмек',1000],['photo','Обработка фотографий','Фотосуреттерді өңдеу',2000]].map(([id,name_ru,name_kz,price])=>({id,name_ru,name_kz,price,enabled:true,version:crypto.randomUUID()}))};
  const value=(row,key)=>key.split(/->>?/).reduce((v,k)=>v?.[k],row);
  tables.shq_invitation_slugs=[];
  tables.shq_client_notifications=[];
  const fetchImpl=async(url,options={})=>{
    const u=new URL(url),name=u.pathname.split('/').at(-1),body=options.body?JSON.parse(options.body):null;
    if(name==='shq_claim_order_notifications')return Response.json([]);
    if(name==='shq_claim_client_notifications')return Response.json([]);
    if(name==='shq_allocate_invitation_slug'){
      if(!tables.shq_invitations.some(i=>i.id===body.p_inv))return Response.json({error:'missing'},{status:404});
      let row=tables.shq_invitation_slugs.find(i=>i.inv===body.p_inv);
      if(!row){let slug=body.p_base,n=2;while(tables.shq_invitation_slugs.some(i=>i.slug===slug))slug=body.p_base+'-'+n++;row={inv:body.p_inv,slug};tables.shq_invitation_slugs.push(row)}
      return Response.json(row.slug);
    }
    if(name==='shq_order_statistics'){const orders=tables.shq_invitations.filter(i=>i.data._order).map(i=>i.data._order);return Response.json([{total:orders.length,published:orders.filter(o=>o.publishedAt).length,archived:orders.filter(o=>o.archivedAt).length,agreed_amount:orders.reduce((n,o)=>n+(o.approval?.price||0),0),by_status:Object.fromEntries([...new Set(orders.map(o=>o.status))].map(s=>[s,orders.filter(o=>o.status===s).length])),designs:[]}])}
    const rows=tables[name];if(!rows)throw Error('Unexpected database request '+name);
    const found=rows.filter(row=>[...u.searchParams].every(([key,filter])=>{if(['select','order','limit','offset','on_conflict'].includes(key))return true;const v=value(row,key);if(filter==='is.null')return v==null;if(filter==='not.is.null')return v!=null;if(filter.startsWith('eq.'))return String(v)===filter.slice(3);return true}));
    if(options.method==='POST'){
      const inserted=(Array.isArray(body)?body:[body]).map(row=>({created:new Date().toISOString(),...structuredClone(row)}));
      for(const row of inserted){const pk=name==='shq_reviews'?'inv':name==='shq_guests'?'code':'id',old=rows.find(x=>x[pk]===row[pk]);if(old&&options.prefer?.includes('merge'))Object.assign(old,row);else if(old&&name==='shq_reviews')return Response.json({error:'duplicate'},{status:409});else rows.push(row)}return Response.json(inserted);
    }
    if(options.method==='PATCH'){found.forEach(row=>Object.assign(row,structuredClone(body)));return Response.json(structuredClone(found))}
    let result=[...found];const order=u.searchParams.get('order');if(order)result.sort((a,b)=>{for(const pair of order.split(',')){const [key,direction]=pair.split('.'),x=String(value(a,key)??''),y=String(value(b,key)??'');if(x!==y)return x.localeCompare(y)*(direction==='desc'?-1:1)}return 0});
    const offset=Number(u.searchParams.get('offset')||0),limit=u.searchParams.has('limit')?Number(u.searchParams.get('limit')):result.length;result=result.slice(offset,offset+limit);
    const select=u.searchParams.get('select');if(select&&select!=='*')result=result.map(row=>Object.fromEntries(select.split(',').map(part=>{const split=part.indexOf(':'),alias=split<0?part:part.slice(0,split),path=split<0?part:part.slice(split+1);return [alias,value(row,path)]})));
    return Response.json(structuredClone(result));
  };
  const app=createApp({env:{SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_KEY:'sb_secret_test',ADMIN_KEY:'test-admin',PUBLIC_URL:'https://invite.example',...env},fetchImpl});
  return {app,tables};
}

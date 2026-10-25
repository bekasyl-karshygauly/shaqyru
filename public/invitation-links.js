const reserved=new Set(['admin','api','create','preview','share','health','robots','sitemap','index','view','library','account','login','logout','assets','images','covers','uploads','vendor','support','telegram']);
export const validInvitationSlug=value=>typeof value==='string'&&value.length>=3&&value.length<=70&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)&&!reserved.has(value)&&!/^[a-f0-9]{8}$|^[a-f0-9]{32}$/.test(value);
const letters={а:'a',ә:'a',б:'b',в:'v',г:'g',ғ:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'i',к:'k',қ:'q',л:'l',м:'m',н:'n',ң:'n',о:'o',ө:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ұ:'u',ү:'u',ф:'f',х:'h',һ:'h',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ъ:'',ы:'y',і:'i',ь:'',э:'e',ю:'yu',я:'ya'};
export function invitationSlug(names){
  let slug=[...String(names||'').toLowerCase()].map(c=>letters[c]??c).join('').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,54).replace(/-+$/,'');
  if(!validInvitationSlug(slug))slug='toi-'+(slug||'shaqyru');return slug;
}
export function invitationPath(id,slug){return validInvitationSlug(slug)?'/'+slug:'/i/'+id}

const eventCovers = ["wedding","kyz_uzatu","besik","sundet","syrga","merey","qudalyq","qonys","tusaukeser","tilashar","tugan_kun"];
export function defaultCover(event, design=0) {
  if(event===2&&design%3===1)return "/covers/besik_cradle.jpg";
  if(event===0&&design%4===1)return "/covers/palace.jpg";
  if(event===0&&design%4===2)return "/covers/sunset.jpg";
  return `/covers/${eventCovers[event]||"wedding"}.jpg`;
}
export function coverAsset(url,thumbnail=false) {
  return /^\/covers\/[a-z0-9_-]+\.jpg$/.test(url||"") ? url.replace("/covers/",thumbnail?"/covers/thumbs/":"/covers/optimized/").replace(/\.jpg$/,".webp") : url;
}

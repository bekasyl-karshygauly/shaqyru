import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createCanvas,loadImage} from "@napi-rs/canvas";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../public/covers");
for(const folder of ["optimized","thumbs"])await fs.mkdir(path.join(root,folder),{recursive:true});
let original=0,optimized=0,thumbs=0;
for(const name of await fs.readdir(root)){
  if(!/^[a-z0-9_-]+\.jpg$/.test(name))continue;
  const input=await fs.readFile(path.join(root,name)),image=await loadImage(input);original+=input.length;
  for(const [folder,maximum,quality]of [["optimized",1200,75],["thumbs",240,75]]){
    const scale=Math.min(1,maximum/image.width),canvas=createCanvas(Math.round(image.width*scale),Math.round(image.height*scale));
    canvas.getContext("2d").drawImage(image,0,0,canvas.width,canvas.height);
    const output=await canvas.encode("webp",quality);await fs.writeFile(path.join(root,folder,name.replace(/\.jpg$/,".webp")),output);
    if(folder==="optimized")optimized+=output.length;else thumbs+=output.length;
  }
}
console.log(JSON.stringify({originalBytes:original,optimizedBytes:optimized,thumbnailBytes:thumbs}));

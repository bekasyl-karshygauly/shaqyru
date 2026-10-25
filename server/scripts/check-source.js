import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";
const files=[];
for(const dir of [".","public","scripts","tests","tests/browser"]){for(const name of fs.readdirSync(dir)){if(name.endsWith(".js"))files.push(path.join(dir,name))}}
let count=0,failed=false;
for(const file of files){const r=spawnSync(process.execPath,["--check",file],{encoding:"utf8"});count++;if(r.status!==0){failed=true;console.error(file,r.stderr)}}
for(const file of ["public/index.html","public/create.html","public/view.html","public/admin.html"]){const source=fs.readFileSync(file,"utf8");for(const [,attributes,script]of source.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){if(!script.trim())continue;const r=spawnSync(process.execPath,["--check",...(attributes.includes("module")?["--input-type=module"]:[])],{input:script,encoding:"utf8"});count++;if(r.status!==0){failed=true;console.error(file,r.stderr)}}}
console.log(`Syntax checks: ${count}; failures: ${failed?"yes":"none"}`);process.exitCode=failed?1:0;

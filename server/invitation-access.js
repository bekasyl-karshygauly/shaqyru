import crypto from "node:crypto";
import { promisify } from "node:util";
import { eventInstant } from "./public/event-tools.js";
const scrypt=promisify(crypto.scrypt);
export async function passwordHash(password){const salt=crypto.randomBytes(16).toString("hex"),hash=await scrypt(password,salt,32);return salt+":"+hash.toString("hex")}
export async function passwordMatches(password,value){if(!/^[a-f0-9]{32}:[a-f0-9]{64}$/.test(value||""))return false;const [salt,hash]=value.split(":"),actual=await scrypt(password,salt,32);return crypto.timingSafeEqual(actual,Buffer.from(hash,"hex"))}
const sign=(i,value)=>crypto.createHmac("sha256",i.edit_token+":"+(i.data._access?.passwordHash||"")).update(value).digest("hex");
export function guestToken(i){const value=String(Date.now()+12*3600000);return value+"."+sign(i,value)}
export function guestAllowed(i,token){if(!i.data._access?.passwordHash)return true;const value=String(token||"");if(!/^\d{13}\.[a-f0-9]{64}$/.test(value))return false;const [expiry,sig]=value.split(".");return Number(expiry)>Date.now()&&Number(expiry)<=Date.now()+12*3600000&&crypto.timingSafeEqual(Buffer.from(sig,"hex"),Buffer.from(sign(i,expiry),"hex"))}
export function isClosed(i){const data=i.data;if(data.closed)return true;if(!data.closeAt)return false;const close=eventInstant(data.closeAt.slice(0,10),data.closeAt.slice(11,16),data.zone||"Asia/Almaty");return !!close&&close.getTime()<=Date.now()}

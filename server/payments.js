import crypto from "node:crypto";
import { XMLParser } from "fast-xml-parser";

export function signature(script, params, secret) {
  const values = Object.keys(params).filter(k => k !== "pg_sig").sort().map(k => {
    if (typeof params[k] !== "string") throw new Error("Invalid payment parameter");
    return params[k];
  });
  return crypto.createHash("md5").update([script, ...values, secret].join(";")).digest("hex");
}
export function verifySignature(script, params, secret) {
  if (!secret || !params || !/^[a-f0-9]{32}$/i.test(params.pg_sig || "")) return false;
  try {
    const expected = Buffer.from(signature(script, params, secret), "hex");
    return crypto.timingSafeEqual(expected, Buffer.from(params.pg_sig, "hex"));
  } catch { return false; }
}
export function paymentConfig(env) {
  let origin;
  try { origin = new URL(env.PUBLIC_URL); } catch { return null; }
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) return null;
  if (!/^\d+$/.test(env.FREEDOMPAY_MERCHANT_ID || "") || !env.FREEDOMPAY_SECRET_KEY?.trim()) return null;
  return { origin: origin.origin, merchant: env.FREEDOMPAY_MERCHANT_ID, secret: env.FREEDOMPAY_SECRET_KEY.trim() };
}
export async function createCheckout(config, order, fetchImpl = fetch) {
  const params = {
    pg_merchant_id: config.merchant, pg_order_id: order.id,
    pg_amount: String(order.amount), pg_currency: "KZT",
    pg_description: "Шақыру — онлайн-приглашение",
    pg_salt: crypto.randomBytes(16).toString("hex"),
    pg_testing_mode: "0", pg_auto_clearing: "1", pg_payment_method: "bankcard",
    pg_request_method: "POST", pg_result_url: config.origin + "/api/payments/result",
    pg_success_url: config.origin + "/?payment=return",
    pg_failure_url: config.origin + "/?payment=failed",
    pg_success_url_method: "GET", pg_failure_url_method: "GET",
    pg_language: "ru", pg_lifetime: "3600"
  };
  params.pg_sig = signature("init_payment.php", params, config.secret);
  const body = new FormData();
  for (const [key, value] of Object.entries(params)) body.append(key, value);
  const response = await fetchImpl("https://api.freedompay.kz/init_payment.php", { method: "POST", body, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("Платёжный сервис временно недоступен");
  const xml = await response.text();
  if (xml.length > 100000 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("Некорректный ответ платёжного сервиса");
  const parsed = new XMLParser({ ignoreAttributes: true, parseTagValue: false, trimValues: false }).parse(xml);
  const data = parsed.response || parsed.root;
  if (!verifySignature("init_payment.php", data, config.secret) || data.pg_status !== "ok" || !/^\d+$/.test(data.pg_payment_id || "")) throw new Error("Платёжный сервис не подтвердил создание платежа");
  const url = new URL(data.pg_redirect_url);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Некорректный адрес оплаты");
  return { paymentId: data.pg_payment_id, url: url.href };
}
export function validResult(params, config, order) {
  return verifySignature("result", params, config.secret)
    && params.pg_order_id === order.id
    && params.pg_payment_id === order.provider_id
    && (!params.pg_merchant_id || params.pg_merchant_id === config.merchant)
    && /^\d+(\.\d{1,2})?$/.test(params.pg_amount || "")
    && Number(params.pg_amount) === order.amount
    && params.pg_currency === "KZT"
    && params.pg_testing_mode === "0";
}
export function resultXml(status, description, secret) {
  const params = { pg_status: status, pg_description: description, pg_salt: crypto.randomBytes(16).toString("hex") };
  params.pg_sig = signature("result", params, secret);
  const escape = s => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
  return '<?xml version="1.0" encoding="UTF-8"?><response>' + Object.entries(params).map(([k,v]) => `<${k}>${escape(v)}</${k}>`).join("") + "</response>";
}

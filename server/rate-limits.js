export function createRateLimiter({now = Date.now} = {}) {
  const hits = new Map();
  return (group, max, duration) => (req, res, next) => {
    const time = now(), key = `${group}:${req.ip}`;
    if (hits.size >= 10000) for (const [k, value] of hits) if (value.reset <= time) hits.delete(k);
    const current = hits.get(key);
    if (!current && hits.size >= 10000) {
      res.set("Retry-After", "60");
      return res.status(429).json({error:"Слишком много запросов. Попробуйте позже."});
    }
    const record = current && current.reset > time ? current : {n:0, reset:time + duration};
    record.n++;
    hits.set(key, record);
    if (record.n > max) {
      res.set("Retry-After", String(Math.max(1, Math.ceil((record.reset-time)/1000))));
      return res.status(429).json({error:"Слишком много запросов. Попробуйте позже."});
    }
    next();
  };
}

const hits = new Map();

function hit(name, maxHits = 5, windowMs = 60000) {
  const now = Date.now();
  const key = name;
  if (!hits.has(key)) hits.set(key, []);
  const timestamps = hits.get(key).filter(t => now - t < windowMs);
  timestamps.push(now);
  hits.set(key, timestamps);
  return { blocked: timestamps.length > maxHits, count: timestamps.length };
}

module.exports = { hit };

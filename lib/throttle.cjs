const calls = new Map();

function throttle(fn, delayMs = 1000) {
  const key = fn.toString().slice(0, 50);
  const last = calls.get(key) || 0;
  const now = Date.now();
  if (now - last < delayMs) return false;
  calls.set(key, now);
  return true;
}

module.exports = { throttle };

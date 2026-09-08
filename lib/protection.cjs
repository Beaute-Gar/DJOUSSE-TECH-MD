const settings = require('./settings.cjs');

const DEFAULTS = { autoapprove: false, autoreject: false };

function get(key) {
  const v = settings.get(key);
  return v === undefined || v === null ? DEFAULTS[key] : v;
}

function set(key, value) {
  settings.set(key, value);
  return value;
}

module.exports = { get, set, DEFAULTS };
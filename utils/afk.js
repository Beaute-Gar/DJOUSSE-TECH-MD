const afkState = { enabled: false, message: '', startTime: 0 };

const enable = (message) => {
  afkState.enabled = true;
  afkState.message = message || 'Je suis pas là pour l instant. Je reviens vite.';
  afkState.startTime = Date.now();
};

const disable = () => {
  afkState.enabled = false;
  afkState.message = '';
  afkState.startTime = 0;
};

const isEnabled = () => afkState.enabled;
const getMessage = () => afkState.message;

const shouldNotify = (chatId, sender) => {
  const key = `${chatId}:${sender}`;
  if (!afkState._notified) afkState._notified = new Set();
  if (afkState._notified.has(key)) return false;
  return true;
};

const markNotified = (chatId, sender) => {
  const key = `${chatId}:${sender}`;
  if (!afkState._notified) afkState._notified = new Set();
  afkState._notified.add(key);
};

module.exports = { enable, disable, isEnabled, getMessage, shouldNotify, markNotified };
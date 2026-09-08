let interval = null;

export function enableHeartbeat(sock) {
  if (interval) clearInterval(interval);
  interval = setInterval(async () => {
    try {
      await sock.sendPresenceUpdate('available', 'status@broadcast');
    } catch {}
  }, 10 * 60 * 1000);
}

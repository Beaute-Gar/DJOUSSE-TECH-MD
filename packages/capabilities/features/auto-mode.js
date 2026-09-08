const schedule = { public: '08:00', private: '22:00' };

export function enableAutoMode(sock) {
  setInterval(async () => {
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (hhmm === schedule.public) {
      console.log('[AutoMode] Mode public activé');
    } else if (hhmm === schedule.private) {
      console.log('[AutoMode] Mode privé activé');
    }
  }, 60000);
}

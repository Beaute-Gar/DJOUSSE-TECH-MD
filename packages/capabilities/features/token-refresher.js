export function enableTokenRefresher(sock) {
  const check = async () => {
    try {
      if (sock?.authState?.creds?.registered) {
        const now = Date.now();
        const exp = sock.authState.creds.lastAccountSyncTimestamp;
        if (exp && now - exp > 6 * 60 * 60 * 1000) {
          await sock.logout();
        }
      }
    } catch {}
  };
  setInterval(check, 5 * 60 * 1000);
}

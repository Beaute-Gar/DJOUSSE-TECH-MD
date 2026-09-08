export default function healthRoutes(sock) {
  return (req, res) => {
    const isConnected = sock?.user ? true : false;
    res.json({
      status: isConnected ? 'ok' : 'degraded',
      platform: 'baileys',
      version: '6.7.9',
      bot: {
        jid: sock?.user?.id || null,
        name: sock?.user?.name || null,
        pushName: sock?.pushName || null,
      },
      uptime: process.uptime(),
      timestamp: Date.now(),
    });
  };
}

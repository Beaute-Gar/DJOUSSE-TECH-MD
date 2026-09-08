const bios = [
  '? DJOUSSE TECH — Intelligence Artificielle',
  '?? AINORIA Cognitive OS v2.0',
  '?? Propulsé par DJOUSSE TECH MD',
  '?? Disponible 24/7 pour toi',
  '?? IA + WhatsApp = Futur',
  '?? Connexion intelligente',
  '? Plus rapide, plus intelligent',
  '?? djoussetech.com',
];

let interval = null;

export function enableBioUpdater(sock) {
  if (interval) clearInterval(interval);
  interval = setInterval(async () => {
    const bio = bios[Math.floor(Math.random() * bios.length)];
    try {
      await sock.updateProfileStatus(bio);
    } catch {}
  }, 3 * 60 * 60 * 1000);
}

/* plugins/twostep.cjs — Vérification en 2 étapes WhatsApp (2FA)
   Baileys 6.7.9 n'expose plus updateTwoStepVerification() → on envoie directement
   le nœud IQ `urn:xmpp:whatsapp:account` / `two_step_verification` (même mécanisme
   officiel : définit un PIN alphanumérique lié au compte, exigé sur tout nouvel appareil). */
const { cmd } = require('../command.cjs');
const { box } = require('../lib/djousse-ui.cjs');

function parsePin(raw) {
  const pin = String(raw || '').replace(/[^0-9a-zA-Z]/g, '').trim();
  if (!pin) return null;
  if (pin.length < 6 || pin.length > 20) return null;
  return pin;
}

async function setTwoStepVerification(conn, pin) {
  /* Nœud officiel WA — correspond exactement à l'ancienne méthode Baileys
     updateTwoStepVerification(pin) :
     <iq type="set" xmlns="urn:xmpp:whatsapp:account">
       <two_step_verification code="PIN"/>
     </iq> */
  return conn.query({
    tag: 'iq',
    attrs: {
      to: '@s.whatsapp.net',
      type: 'set',
      xmlns: 'urn:xmpp:whatsapp:account',
    },
    content: [
      { tag: 'two_step_verification', attrs: { code: pin } },
    ],
  });
}

cmd({ pattern: 'twostep', desc: 'Vérification en 2 étapes WhatsApp (2FA)', category: 'settings', filename: __filename, fromMe: true }, async (conn, m) => {
  const args = m.body.split(' ').slice(1);
  const sub = (args[0] || '').toLowerCase();

  if (sub === 'set') {
    const pin = parsePin(args[1]);
    if (!pin) return m.reply(box('🔐 *2FA — PIN*', [
      { label: 'Erreur', value: 'PIN invalide (6 à 20 caractères alphanumériques)' },
      { label: 'Utilisation', value: '.twostep set <pin>' },
      { label: 'Exemple', value: '.twostep set Djousse2026' },
      { label: '⚠️', value: 'Ne choisis pas ton numéro de téléphone' },
    ]));
    try {
      await setTwoStepVerification(conn, pin);
      m.reply(box('🔐 *VÉRIFICATION EN 2 ÉTAPES*', [
        { label: 'Statut', value: '✅ Activée' },
        { label: 'PIN', value: `*${pin}*` },
        { label: 'Important', value: 'Conserve ce PIN en lieu sûr. Il sera exigé sur tout nouvel appareil / réinstallation.' },
      ]));
    } catch (e) {
      m.reply('❌ Échec de l\'activation 2FA: ' + e.message);
    }
    return;
  }

  if (sub === 'reset' || sub === 'off' || sub === 'remove') {
    try {
      /* Code vide = désactivation de la 2FA (doit être exactement "" dans le nœud) */
      await setTwoStepVerification(conn, '');
      m.reply(box('🔐 *VÉRIFICATION EN 2 ÉTAPES*', [
        { label: 'Statut', value: '⚫ Désactivée' },
        { label: 'Astuce', value: 'Réactive-la avec .twostep set <pin>' },
      ]));
    } catch (e) {
      m.reply('❌ Échec de la désactivation 2FA: ' + e.message);
    }
    return;
  }

  /* État + aide */
  m.reply(box('🔐 *VÉRIFICATION EN 2 ÉTAPES (2FA)*', [
    { label: 'Pourquoi', value: 'Protège le compte contre le vol de SIM / connexions non autorisées' },
    { label: 'Activer', value: '.twostep set <pin>' },
    { label: 'Désactiver', value: '.twostep reset' },
    { label: 'Exemple', value: '.twostep set Djousse2026' },
    { label: 'Règle', value: 'PIN : 6 à 20 caractères alphanumériques' },
    { label: 'Note', value: 'WhatsApp exige ce code sur tout nouvel appareil (ADV + device-bound auth)' },
  ]));
});

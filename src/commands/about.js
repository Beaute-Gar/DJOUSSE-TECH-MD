export const name = 'about';
export const aliases = ['company', 'dte', 'info'];
export const description = 'Présente Djousse Tech Evolution';
export const category = 'info';
export const level = 'user';

export async function handler(sock, m, { config }) {
  await m.reply(
`╔══『 *DJOUSSE TECH EVOLUTION* 』══╗

🏢 *Entreprise* : ${config.COMPANY_NAME}
🤖 *Bot* : ${config.BOT_NAME} v2.0
👤 *Fondateur* : ${config.OWNER_NAME}
🌍 *Localisation* : Cameroun 🇨🇲

━━━━━━━━━━━━━━━━━━━━━━
🚀 *NOS PRODUITS*
━━━━━━━━━━━━━━━━━━━━━━
🤖 DJOUSSE-TECH-MD — Bot WhatsApp intelligent
📊 Nexus Analytics Pro — Analytics réseaux sociaux
🎌 BNC-Otaku — Plateforme quiz anime
🔒 FaceLocker — Déverrouillage facial Windows
🖥️ Ultra Data Control Center — Utilitaire Windows

━━━━━━━━━━━━━━━━━━━━━━
💡 *MISSION*
━━━━━━━━━━━━━━━━━━━━━━
_Développer des solutions technologiques innovantes
adaptées aux réalités africaines et francophones._

╚══『 *Tech For Africa* 』══╝`
  );
}

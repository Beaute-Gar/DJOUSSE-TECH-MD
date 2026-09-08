import os from 'os';
import process from 'process';
import config from '../config.cjs';

const hostCommand = async (m, Matrix) => {
  const prefix = config.PREFIX || '.';
  const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';
  if (cmd !== 'host') return;

  try {
    // System info
    const hostname = os.hostname();
    const platform = os.platform();
    const arch = os.arch();
    const release = os.release();
    const cpus = os.cpus();
    const cpuModel = cpus[0]?.model || 'Unknown CPU';
    const cpuCores = cpus.length;
    const totalMem = (os.totalmem() / (1024 ** 3)).toFixed(2);
    const freeMem = (os.freemem() / (1024 ** 3)).toFixed(2);
    const nodeVersion = process.version;
    const uptimeSeconds = process.uptime();
    const uptime = `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m ${Math.floor(uptimeSeconds % 60)}s`;
    const now = new Date().toLocaleString();

    // Detect deployment platform
    let deployedOn = 'Unknown';
    if (process.env.RENDER === 'true' || process.env.RENDER_INSTANCE_ID) deployedOn = 'Render';
    else if (process.env.HEROKU === 'true' || process.env.DYNO) deployedOn = 'Heroku';
    else if (process.env.REPL_ID || process.env.REPLIT_DB_URL) deployedOn = 'Replit';
    else if (process.env.RAILWAY_STATIC_URL || process.env.RAILWAY_ENVIRONMENT) deployedOn = 'Railway';
    else if (process.env.GLITCH_PROJECT_ID) deployedOn = 'Glitch';
    else if (process.env.VERCEL === '1' || process.env.NEXT_PUBLIC_VERCEL_URL) deployedOn = 'Vercel';
    else if (hostname.includes('fly')) deployedOn = 'Fly.io';

    // Compose message
    const messageText = `
 *DJOUSSE-TECH-MD DEPLOYMENT INFO*

ðŸ“ Deployed On   : ${deployedOn}
ðŸŒ Hostname      : ${hostname}
ðŸ–¥ï¸ Platform       : ${platform} (${arch})
ðŸ“¦ OS Release    : ${release}
âš™ï¸ CPU           : ${cpuModel} (${cpuCores} cores)
ðŸ’¾ Memory        : ${freeMem} GB free / ${totalMem} GB total
ðŸ”§ Node.js       : ${nodeVersion}
â³ Uptime        : ${uptime}
ðŸ•’ Server Time   : ${now}
    `.trim();

    // Send the info with context and external ad reply
    await Matrix.sendMessage(m.from, {
      text: messageText,
      contextInfo: {
        forwardingScore: 5,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterName: "INCONKU XD V2",
          newsletterJid: "120363397722863547@newsletter",
        },
        externalAdReply: {
          title: "DJOUSSE-TECH-MD",
          body: "Host Environment Details",
          mediaType: 1,
          renderLargerThumbnail: true,
          showAdAttribution: true,
          sourceUrl: "https://github.com/INCONNU-BOY"
        }
      }
    }, { quoted: m });

  } catch (error) {
    console.error('â— Host command error:', error);
    await Matrix.sendMessage(m.from, {
      text: 'âŒ Failed to retrieve host info.',
      contextInfo: {
        forwardingScore: 5,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterName: "DJOUSSE-TECH-MD",
          newsletterJid: "120363397722863547@newsletter",
        }
      }
    }, { quoted: m });
  }
};

export default hostCommand;


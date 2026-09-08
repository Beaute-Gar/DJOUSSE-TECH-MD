import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config.cjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const antibugsFile = path.join(__dirname, '../lib/antibugs.json');

// CrÃ©er antibugs.json si inexistant
if (!fs.existsSync(antibugsFile)) {
  fs.writeFileSync(antibugsFile, JSON.stringify({ enabled: true }, null, 2));
}

const readStatus = () => {
  const data = fs.readFileSync(antibugsFile);
  return JSON.parse(data).enabled;
};

const writeStatus = (status) => {
  fs.writeFileSync(antibugsFile, JSON.stringify({ enabled: status }, null, 2));
};

const antibugs = async (m, sock) => {
  const prefix = config.PREFIX;
  const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';
  const args = m.body.slice(prefix.length + cmd.length).trim().split(' ');
  const senderName = m.pushName || 'User';

  const bugUnicode = ['\u202e', '\u200e', '\u200f', '\u2060', '\u2066', '\u2067', '\u2068', '\u202a', '\u202b', '\u202c'];
  const bugDetected = bugUnicode.some(char => m.body?.includes(char));
  const isEnabled = readStatus();

  if (cmd === 'antibugs') {
    if (!args[0]) {
      return sock.sendMessage(m.from, {
        text: `ðŸ›¡ï¸ *AntiBugs System*\n\nðŸ“¡ Status: ${isEnabled ? 'ðŸŸ¢ ON' : 'ðŸ”´ OFF'}\n\nUse:\nâ€¢ *.antibugs on*\nâ€¢ *.antibugs off*`,
      }, { quoted: m });
    }

    const arg = args[0].toLowerCase();

    if (arg === 'on') {
      writeStatus(true);
      return sock.sendMessage(m.from, {
        text: `âœ… *AntiBugs Activated!*\nSuspicious Unicode will now be auto-deleted.`,
      }, { quoted: m });
    }

    if (arg === 'off') {
      writeStatus(false);
      return sock.sendMessage(m.from, {
        text: `âš ï¸ *AntiBugs Disabled!*`,
      }, { quoted: m });
    }
  }

  if (bugDetected && isEnabled && m.key.remoteJid.endsWith('@g.us')) {
    try {
      await sock.sendMessage(m.from, {
        text: `ðŸš« *Bug Detected!*\nMessage from *${senderName}* contained dangerous characters and was removed.`,
      }, { quoted: m });

      await sock.sendMessage(m.from, {
        delete: {
          remoteJid: m.key.remoteJid,
          fromMe: false,
          id: m.key.id,
          participant: m.key.participant || m.key.remoteJid,
        }
      });
    } catch (err) {
      console.error('â— Error deleting message:', err);
    }
  }
};

export default antibugs;


import fs from 'fs';
import config from '../config.cjs';

const addPremiumCmd = async (m, gss) => {
  const prefix = config.PREFIX;
  const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(" ")[0].toLowerCase() : "";
  const args = m.body.slice(prefix.length + cmd.length).trim();

  if (cmd !== 'addpremium') return;

  const allowedAdmins = ['237693978044'];
  const senderNumber = m.sender.replace(/\D/g, '');

  if (!allowedAdmins.includes(senderNumber)) {
    return m.reply("âŒ You are not authorized to use this command.");
  }

  if (!args || !args.match(/^\d+$/)) {
    return m.reply("âŒ Invalid usage.\nExample:\n.addpremium 237693978044");
  }

  const numberToAdd = args.trim();
  const filePath = './mydata/users/premium.json';

  try {
    let premiumUsers = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    if (premiumUsers.includes(numberToAdd)) {
      return m.reply("âœ… This number is already a premium user.");
    }

    premiumUsers.push(numberToAdd);
    fs.writeFileSync(filePath, JSON.stringify(premiumUsers, null, 2));

    m.reply(`âœ… ${numberToAdd} has been added to *Premium Users*.`);

  } catch (err) {
    console.error("addpremium error:", err.message);
    m.reply("âŒ Failed to update premium list.\n" + err.message);
  }
};

export default addPremiumCmd;


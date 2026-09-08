import axios from 'axios';
import config from '../config.cjs';

const githubStalk = async (m, gss) => {
  try {
    const prefix = config.PREFIX;
    const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';
    const text = m.body.slice(prefix.length + cmd.length).trim();
    const args = text.split(' ');

    const validCommands = ['githubstalk', 'ghstalk'];

    if (validCommands.includes(cmd)) {
      if (!args[0]) return m.reply('âš ï¸ Mention a GitHub username to stalk.');

      const username = args[0];

      try {
        const githubResponse = await axios.get(`https://api.github.com/users/${username}`);
        const userData = githubResponse.data;

        const reposResponse = await axios.get(`https://api.github.com/users/${username}/repos?per_page=5&sort=stargazers_count&direction=desc`);
        const reposData = reposResponse.data;

        let responseMessage = `â•­â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€à¼ºâ˜†à¼»â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â•®
*ã€Ž inconnu É¢Éªá´›Êœá´œÊ™ êœ±á´›á´€ÊŸá´‹á´‡Ê€ ã€*
â•°â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€à¼ºâ˜†à¼»â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â•¯

ðŸ‘¤ *á´œêœ±á´‡Ê€É´á´€á´á´‡*: @${userData.login}
ðŸ“› *É´á´€á´á´‡*: ${userData.name || 'âŸ¨N/AâŸ©'}
ðŸ§¬ *Ê™Éªá´*: ${userData.bio || 'âŸ¨No bio foundâŸ©'}
ðŸ†” *á´œêœ±á´‡Ê€ ID*: ${userData.id}
ðŸ§© *É´á´á´…á´‡ ID*: ${userData.node_id}

ðŸ–¼ï¸ *á´€á´ á´€á´›á´€Ê€*: ${userData.avatar_url}
ðŸ”— *É¢Éªá´›Êœá´œÊ™*: [á´ Éªá´‡á´¡ á´˜Ê€á´êœ°ÉªÊŸá´‡](${userData.html_url})
ðŸ› ï¸ *á´€á´„á´„á´á´œÉ´á´› á´›Êá´˜á´‡*: ${userData.type}
ðŸ‘‘ *á´€á´…á´ÉªÉ´*: ${userData.site_admin ? 'Êá´‡êœ±' : 'É´á´'}

ðŸ¢ *á´„á´á´á´˜á´€É´Ê*: ${userData.company || 'None'}
ðŸ•¸ï¸ *Ê™ÊŸá´É¢*: ${userData.blog || 'None'}
ðŸ“ *ÊŸá´á´„á´€á´›Éªá´É´*: ${userData.location || 'Unknown'}
âœ‰ï¸ *á´‡á´á´€ÉªÊŸ*: ${userData.email || 'Hidden'}

ðŸ“¦ *á´˜á´œÊ™ÊŸÉªá´„ Ê€á´‡á´˜á´êœ±*: ${userData.public_repos}
ðŸ“œ *É¢Éªêœ±á´›êœ±*: ${userData.public_gists}
ðŸ§‘â€ðŸ¤â€ðŸ§‘ *êœ°á´ÊŸÊŸá´á´¡á´‡Ê€êœ±*: ${userData.followers}
ðŸ” *êœ°á´ÊŸÊŸá´á´¡ÉªÉ´É¢*: ${userData.following}

â³ *á´„Ê€á´‡á´€á´›á´‡á´…*: ${userData.created_at}
â™»ï¸ *á´œá´˜á´…á´€á´›á´‡á´…*: ${userData.updated_at}
`;

        if (reposData.length > 0) {
          const topRepos = reposData.slice(0, 5);
          const reposList = topRepos.map(repo => {
            return `â•­â”€â”€â”€â”€ã€Ž *${repo.name}* ã€â”€â”€â”€â”€â•®
ðŸ”— [Ê€á´‡á´˜á´ ÊŸÉªÉ´á´‹](${repo.html_url})
ðŸ“ *á´…á´‡êœ±á´„*: ${repo.description || 'N/A'}
â­ *êœ±á´›á´€Ê€êœ±*: ${repo.stargazers_count}   ðŸ´ *êœ°á´Ê€á´‹êœ±*: ${repo.forks}
â•°â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â•¯`;
          });

          responseMessage += `\n\nâœ¨ *á´›á´á´˜ Ê€á´‡á´˜á´êœ±Éªá´›á´Ê€Éªá´‡êœ±*\n${reposList.join('\n\n')}`;
        } else {
          responseMessage += `\nâš ï¸ É´á´ á´˜á´œÊ™ÊŸÉªá´„ Ê€á´‡á´˜á´êœ± êœ°á´á´œÉ´á´….`;
        }

        responseMessage += `\n\nâ•­â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€à¼ºâš¡à¼»â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â•®
á´˜á´á´¡á´‡Ê€á´‡á´… Ê™Ê DJOUSSSE 
â•°â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€à¼ºâš¡à¼»â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â•¯`;

        await gss.sendMessage(m.from, {
          image: { url: userData.avatar_url },
          caption: responseMessage
        }, { quoted: m });

      } catch (err) {
        console.error('GitHub fetch error:', err);
        await m.reply('âŒ An error occurred while fetching GitHub data.');
      }
    }
  } catch (err) {
    console.error('Command error:', err);
    m.reply('âš ï¸ Something went wrong while processing your request.');
  }
};

export default githubStalk;


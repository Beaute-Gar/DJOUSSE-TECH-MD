import axios from "axios";

import config from "../config.cjs";

const shortenUrl = async (m, sock) => {

  const prefix = config.PREFIX;

  const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(" ")[0].toLowerCase() : "";

  const validCommands = ["shortenurl", "urlshortener", "shorten"];

  if (validCommands.includes(cmd)) {

    const url = m.body.split(" ")[1];

    if (!url) {

      return await sock.sendMessage(

        m.from,

        { text: "Ïâ„“Ñ”Î±Ñ•Ñ” ÏÑÏƒÎ½Î¹âˆ‚Ñ” Î± Ï…Ñâ„“ Ñ‚Ïƒ Ñ•Ð½ÏƒÑÑ‚Ñ”Î·. Ñ”Ï‡Î±Ð¼Ïâ„“Ñ”:!shortenurl https://github.com/INCONNU-BOY/DJOUSSE-TECH-MD*" },

        { quoted: m }

      );

    }

    const apiUrl = `https://bk9.fun/tools/shorten?url=${encodeURIComponent(url)}`;

    try {

      await m.React("â³"); // React with a loading icon

      const response = await axios.get(apiUrl);

      const data = response.data;

      if (data.status === true && data.BK9) {

        const originalUrl = data.BK9.origin;

        const shortenedUrl = data.BK9.url;

        const responseText = `*inconnu xá´… v2 sÊœá´Ê€á´›á´‡É´ á´œÊ€ÊŸ*\n\n*á´Ê€ÉªÉ¢ÉªÉ´á´€ÊŸ á´œÊ€ÊŸ*: *${originalUrl}*\n*sÊœá´Ê€á´›á´‡É´á´‡á´… á´œÊ€ÊŸ:* *${shortenedUrl}\n\n _á´›á´€á´˜ á´€É´á´… Êœá´ÊŸá´… á´É´ á´›Êœá´‡ sÊœá´Ê€á´›á´‡É´á´‡á´… á´œÊ€ÊŸ á´›á´ á´„á´á´˜Ê Éªá´›_\n\n*á´˜á´á´¡á´‡Ê€á´‡á´… Ê™Ê DJOUSSSE*`;

        await sock.sendMessage(

          m.from,

          {

            text: responseText,

            contextInfo: {

              isForwarded: false,

              forwardedNewsletterMessageInfo: {

                newsletterJid: "120363397722863547@newsletter",

                newsletterName: "DJOUSSE-TECH-MD",

                serverMessageId: -1,

              },

              forwardingScore: 999, // Score to indicate it has been forwarded

              externalAdReply: {

                title: "DJOUSSE-TECH-MD",

                body: "Ï…Ñâ„“ Ñ•Ð½ÏƒÑÑ‚Ñ”Î·Ñ”Ñ Ñ•Ñ”ÑÎ½Î¹Â¢e",

                thumbnailUrl: "https://pps.whatsapp.net/v/t61.24694-24/491838851_1691815294762837_175487952056747300_n.jpg?ccb=11-4&oh=01_Q5Aa1QE1LGt54jO2ZJ-BIvc1hrsSH--faJrfv2RA070q9z381Q&oe=681127B9&_nc_sid=5e03e0&_nc_cat=107", // Add thumbnail URL if required

                sourceUrl: "https://whatsapp.com/channel/0029Vb6T8td5K3zQZbsKEU1R", // Source URL

                mediaType: 1,

                renderLargerThumbnail: false,

              },

            },

          },

          { quoted: m }

        );

      } else {

        throw new Error("Invalid response from the API");

      }

    } catch (error) {

      console.error("Error:", error); // Log the full error for debugging

      await sock.sendMessage(

        m.from,

        {

          text: `*á´‡Ê€Ê€á´Ê€ sÊœá´Ê€á´›á´‡É´ÉªÉ´É¢ á´œÊ€ÊŸ: ${error.message}*`,

          contextInfo: {

            externalAdReply: {

              title: "DJOUSSE-TECH-MD",

              body: "Ñ•Ð½ÏƒÑÑ‚ Ï…Ñâ„“ Ñ•Ñ”ÑÎ½Î¹Â¢Ñ”Ñ•",

              sourceUrl: "https://whatsapp.com/channel/0029Vb6T8td5K3zQZbsKEU1R",

              mediaType: 1,

            },

          },

        },

        { quoted: m }

      );

    }

  }

};

export default shortenUrl;


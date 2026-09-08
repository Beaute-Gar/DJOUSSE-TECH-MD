import config from '../config.cjs';
import axios from 'axios';

const newsletterName = "DJOUSSE-TECH-MD";
const newsletterJid = "120363397722863547@newsletter";

const weather = async (m, sock) => {
  const prefix = config.PREFIX;
  const cmd = m.body.startsWith(prefix)
    ? m.body.slice(prefix.length).split(" ")[0].toLowerCase()
    : '';
  const args = m.body.trim().split(" ").slice(1);
  const location = args.join(" ");

  if (cmd !== "weather") return;

  if (!location) {
    await sock.sendMessage(m.from, {
      text: `âŒ *Please provide a location!*\nðŸ’¡ Try: *${prefix}weather Nairobi*`
    }, { quoted: m });
    return;
  }

  await m.React("ðŸŒ¦ï¸");

  try {
    const apiKey = config.WEATHER_API_KEY;
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric`;

    const { data } = await axios.get(url);

    const name = data.name;
    const country = data.sys.country;
    const temp = data.main.temp.toFixed(1);
    const feels = data.main.feels_like.toFixed(1);
    const humidity = data.main.humidity;
    const weatherDesc = capitalize(data.weather[0].description);
    const wind = data.wind.speed;
    const condition = data.weather[0].main;
    const weatherIcon = data.weather[0].icon;
    const iconURL = `http://openweathermap.org/img/wn/${weatherIcon}@2x.png`;

    const emoji = getEmoji(condition);

    const userText = `â•­â”â”â”âŸª *ðŸŒ WEATHER REPORT* âŸ«â”â”â”
â”ƒ ðŸ™ï¸ *Location:* ${name}, ${country}
â”ƒ ${emoji} *Condition:* ${weatherDesc}
â”ƒ ðŸŒ¡ï¸ *Temperature:* ${temp}Â°C
â”ƒ ðŸ¤’ *Feels Like:* ${feels}Â°C
â”ƒ ðŸ’§ *Humidity:* ${humidity}%
â”ƒ ðŸ’¨ *Wind Speed:* ${wind} m/s
â•°â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”`;

    const forwardedText = `â•­â”â”â”âŸª *ðŸ“° WEATHER BULLETIN* âŸ«â”â”â”
â”ƒ ðŸ“ *${name}, ${country}*
â”ƒ ${emoji} *${weatherDesc}*
â”ƒ ðŸŒ¡ï¸ *${temp}Â°C* | ðŸ¤’ Feels Like *${feels}Â°C*
â”ƒ ðŸ’§ Humidity: *${humidity}%*
â”ƒ ðŸ’¨ Wind: *${wind} m/s*
â”ƒ
â”ƒ ðŸ“… ${new Date().toLocaleDateString('en-GB')}
â”ƒ ðŸ•“ ${new Date().toLocaleTimeString('en-GB')}
â”ƒ
â•°ðŸ”” _MADE IN BY DJOUSSSE_`;

    await sock.sendMessage(m.from, {
      image: { url: iconURL },
      caption: userText
    }, { quoted: m });

    await sock.sendMessage(m.from, {
      image: { url: iconURL },
      caption: forwardedText,
      contextInfo: {
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterName: newsletterName,
          newsletterJid: newsletterJid
        }
      }
    });

  } catch (error) {
    await sock.sendMessage(m.from, {
      text: `âŒ *Couldn't find weather for:* _${location}_\nðŸ“ Make sure the city name is correct.`
    }, { quoted: m });
  }
};

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getEmoji(condition) {
  const map = {
    Thunderstorm: "â›ˆï¸",
    Drizzle: "ðŸŒ¦ï¸",
    Rain: "ðŸŒ§ï¸",
    Snow: "â„ï¸",
    Clear: "â˜€ï¸",
    Clouds: "â˜ï¸",
    Mist: "ðŸŒ«ï¸",
    Smoke: "ðŸš¬",
    Haze: "ðŸŒ",
    Dust: "ðŸŒªï¸",
    Fog: "ðŸŒ«ï¸",
    Sand: "ðŸœï¸",
    Ash: "ðŸŒ‹",
    Squall: "ðŸ’¨",
    Tornado: "ðŸŒªï¸",
  };
  return map[condition] || "ðŸŒ";
}

export default weather;


import config from '../config.cjs';
import axios from 'axios';

const weather = async (m, sock) => {
  const prefix = config.PREFIX;
  const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';
  const text = m.body.slice(prefix.length + cmd.length).trim();

  if (!['weather', 'meteo', 'wt'].includes(cmd)) return;

  if (!text) {
    return m.reply(`Usage: ${prefix}weather <city>\nExample: ${prefix}weather Douala`);
  }

  try {
    await sock.sendMessage(m.from, { react: { text: '🌤️', key: m.key } });

    const response = await axios.get(`https://wttr.in/${encodeURIComponent(text)}?format=j1`);
    const data = response.current_condition[0];

    const weatherText = `🌤️ *Weather in ${text}*

🌡️ *Temperature:* ${data.temp_C}°C / ${data.temp_F}°F
🤔 *Feels Like:* ${data.FeelsLikeC}°C
💧 *Humidity:* ${data.humidity}%
💨 *Wind:* ${data.windspeedKmph} km/h ${data.winddir16Point}
👁️ *Visibility:* ${data.visibility} km
🌧️ *Precipitation:* ${data.precipMM} mm
☁️ *Cloud Cover:* ${data.cloudcover}%
📝 *Condition:* ${data.weatherDesc[0].value}

> Made by DJOUSSE-TECH-MD`;

    await sock.sendMessage(m.from, { text: weatherText }, { quoted: m });
    await sock.sendMessage(m.from, { react: { text: '✅', key: m.key } });

  } catch (error) {
    console.error('Weather error:', error);
    m.reply('❌ Failed to fetch weather data');
  }
};

export default weather;

require('dotenv').config();

module.exports = {
  OWNER_NUMBER: process.env.OWNER_NUMBER || '237693978044',
  BOT_NAME: process.env.BOT_NAME || 'DJOUSSE TECH',
  PREFIX: process.env.PREFIX || '.',
  MODE: process.env.MODE || 'public',
  AUTO_TYPING: false,
  SESSION_ID: process.env.SESSION_ID || '',
  MONGODB_URI: process.env.MONGODB_URI || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
};

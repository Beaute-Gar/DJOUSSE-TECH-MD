'use strict';
require('dotenv').config();
const config = {
  BOT_NAME:     process.env.BOT_NAME      || 'DJOUSSE-TECH-MD',
  COMPANY_NAME: process.env.COMPANY_NAME  || 'Djousse Tech Evolution',
  OWNER_NAME:   process.env.OWNER_NAME    || 'Beaute Gar',
  OWNER_NUMBER: process.env.OWNER_NUMBER  || '',
  SUDO_NUMBERS: (process.env.SUDO_NUMBER || '').split(',').map(n => n.trim()).filter(Boolean),
  SESSION_ID:    process.env.SESSION_ID   || '',
  PREFIX:        process.env.PREFIX       || '.',
  MODE:          process.env.MODE         || 'public',
  ANTI_LINK:     process.env.ANTI_LINK    === 'true',
  ANTI_BOT:      process.env.ANTI_BOT     === 'true',
  ANTI_DELETE:   process.env.ANTI_DELETE  === 'true',
  AUTO_REACT:    process.env.AUTO_REACT   === 'true',
  REJECT_CALLS:  process.env.REJECT_CALLS === 'true',
  DB_TYPE: process.env.DB_TYPE   || 'sqlite',
  DB_PATH: process.env.DB_PATH   || './data/djousse.db',
  DATABASE_URL: process.env.DATABASE_URL || null,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || null,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || null,
  PORT: parseInt(process.env.PORT || '3000', 10),
  RATE_LIMIT_MAX:       parseInt(process.env.RATE_LIMIT_MAX        || '10', 10),
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS  || '5000', 10),
  WHITELIST_GROUPS:  (process.env.WHITELIST_GROUPS || '').split(',').map(s => s.trim()).filter(Boolean),
  BLACKLIST_NUMBERS: (process.env.BLACKLIST_NUMBERS || '').split(',').map(s => s.trim()).filter(Boolean),
  LOG_LEVEL:  process.env.LOG_LEVEL   || 'info',
  LOG_TO_FILE: process.env.LOG_TO_FILE === 'true',
  LOG_FILE:   process.env.LOG_FILE    || './data/bot.log',
  PATHS: {
    SESSION:  './session',
    COMMANDS: './src/commands',
    DATA:     './data',
    MYDATA:   './mydata',
  },
  BROWSER: ['DJOUSSE-TECH-MD', 'Chrome', '120.0.0'],
};
const REQUIRED = ['OWNER_NUMBER'];
for (const key of REQUIRED) {
  if (!config[key]) {
    console.error(`[CONFIG] Variable obligatoire manquante : ${key}`);
    process.exit(1);
  }
}
module.exports = config;

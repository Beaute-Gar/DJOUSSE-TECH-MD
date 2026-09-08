import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const config = require('../../config.cjs');

function getLogDestination() {
  if (!config.LOG_TO_FILE) return undefined;
  const logDir = path.dirname(config.LOG_FILE || './logs/app.log');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  return path.join(logDir, `app-${date}.log`);
}

const transport = pino.transport({
  targets: [
    {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
    },
    ...(config.LOG_TO_FILE && getLogDestination()
      ? [{ target: 'pino/file', options: { destination: getLogDestination(), mkdir: true } }]
      : []),
  ],
});

const baseLogger = pino({ level: config.LOG_LEVEL }, transport);

export function createLogger(module) {
  return baseLogger.child({ module });
}

export default createLogger('DEFAULT');

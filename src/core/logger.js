import pino from 'pino';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const config = require('../../config.cjs');

const transport = pino.transport({
  targets: [
    {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
    },
    ...(config.LOG_TO_FILE
      ? [{ target: 'pino/file', options: { destination: config.LOG_FILE, mkdir: true } }]
      : []),
  ],
});

const baseLogger = pino({ level: config.LOG_LEVEL }, transport);

export function createLogger(module) {
  return baseLogger.child({ module });
}

export default createLogger('DEFAULT');

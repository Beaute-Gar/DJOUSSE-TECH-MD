import fs from 'fs';
import path from 'path';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';

let interval = null;

export function enableLogRotator(sock) {
  if (interval) clearInterval(interval);
  interval = setInterval(async () => {
    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) return;
    const files = fs.readdirSync(logDir).filter(f => f.endsWith('.log'));
    for (const file of files) {
      const fpath = path.join(logDir, file);
      const stat = fs.statSync(fpath);
      if (stat.size > 10 * 1024 * 1024) {
        const gzPath = fpath + '.gz';
        const gzip = createGzip();
        const source = fs.createReadStream(fpath);
        const dest = fs.createWriteStream(gzPath);
        await pipeline(source, gzip, dest);
        fs.truncateSync(fpath, 0);
      }
    }
  }, 24 * 60 * 60 * 1000);
}

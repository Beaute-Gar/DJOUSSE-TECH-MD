const https = require('https');
const http = require('http');
const FormData = require('form-data');
const { Readable } = require('stream');

async function upload(buffer, filename = 'file.txt') {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('fileToUpload', buffer, { filename });

    const req = https.request({
      hostname: 'catbox.moe',
      path: '/user/api.php',
      method: 'POST',
      headers: form.getHeaders(),
      timeout: 30000,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode === 200 && data.startsWith('http')) {
          resolve(data.trim());
        } else {
          reject(new Error(`Upload failed: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    form.pipe(req);
  });
}

module.exports = { upload };

import { v4 as uuidv4 } from 'uuid';

const mediaStore = new Map();

const MIME_TYPES = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', mp4: 'video/mp4', mov: 'video/quicktime',
  mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav',
  pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain', zip: 'application/zip',
};

function detectMimeType(filename, data) {
  if (filename) {
    const ext = filename.split('.').pop().toLowerCase();
    if (MIME_TYPES[ext]) return MIME_TYPES[ext];
  }
  if (data && typeof data === 'string') {
    const header = data.substring(0, 30);
    if (header.startsWith('/9j/')) return 'image/jpeg';
    if (header.startsWith('iVBOR')) return 'image/png';
    if (header.startsWith('R0lGOD')) return 'image/gif';
    if (header.startsWith('UklGR')) return 'image/webp';
  }
  return 'application/octet-stream';
}

export async function uploadMedia(sock, req, res) {
  try {
    const { data, filename, mime_type } = req.body;
    if (!data) return res.status(400).json({ error: true, message: 'Missing required field: data (base64)', code: 'INVALID_PARAMS' });

    const mediaId = uuidv4();
    const mimeType = mime_type || detectMimeType(filename, data);
    const size = Math.round((data.length * 3) / 4);

    mediaStore.set(mediaId, { data, mimeType, filename: filename || 'file.bin', size, created: Date.now() });

    res.json({
      messages: [{
        id: mediaId,
        url: `/api/media/${mediaId}`,
        mimeType,
        fileName: filename || 'file.bin',
        size,
      }],
      meta: { count: 1 },
    });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message, code: 'MEDIA_UPLOAD_FAILED' });
  }
}

export async function getMedia(sock, req, res) {
  try {
    const mediaId = req.params.id;
    if (!mediaStore.has(mediaId)) {
      return res.status(404).json({ error: true, message: 'Media not found', code: 'NOT_FOUND' });
    }

    const entry = mediaStore.get(mediaId);
    const buffer = Buffer.from(entry.data, 'base64');
    res.set('Content-Type', entry.mimeType);
    res.set('Content-Disposition', `inline; filename="${entry.filename}"`);
    res.send(buffer);
  } catch (e) {
    res.status(500).json({ error: true, message: e.message, code: 'MEDIA_FETCH_FAILED' });
  }
}

export async function deleteMedia(sock, req, res) {
  try {
    const mediaId = req.params.id;
    if (!mediaStore.has(mediaId)) {
      return res.status(404).json({ error: true, message: 'Media not found', code: 'NOT_FOUND' });
    }
    mediaStore.delete(mediaId);
    res.json({ sent: true, message: 'Media deleted' });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message, code: 'MEDIA_DELETE_FAILED' });
  }
}

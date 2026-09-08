import { createLogger } from '../../infrastructure/logger.js';

const log = createLogger('VISION:INTEGRATION');

let _visionEngine = null;
let _multimodal = null;

async function getVisionEngine() {
  if (_visionEngine) return _visionEngine;
  try {
    const { VisionEngine } = await import('../conscious/vision-engine.js');
    _visionEngine = new VisionEngine();
    return _visionEngine;
  } catch { return null; }
}

async function getMultimodal() {
  if (_multimodal) return _multimodal;
  try {
    const { MultimodalEngine } = await import('../conscious/multimodal-engine.js');
    _multimodal = new MultimodalEngine();
    return _multimodal;
  } catch { return null; }
}

export async function processMediaMessage(sock, msg, jid, isGroup) {
  const isImage = !!msg.message?.imageMessage;
  const isVideo = !!msg.message?.videoMessage;
  const isDoc = !!msg.message?.documentMessage;
  const isAudio = !!msg.message?.audioMessage;

  if (!isImage && !isDoc && !isAudio && !isVideo) return null;

  if (isGroup) return null;

  if (isAudio) return null;

  const vision = await getVisionEngine();
  if (!vision) return null;

  try {
    const buffer = await sock.downloadMediaMessage(msg);

    let result;
    if (isImage) {
      const mime = msg.message.imageMessage.mimetype || 'image/jpeg';
      const caption = msg.message.imageMessage.caption || '';
      const prompt = caption
        ? `Tu reçois une image avec ce message : "${caption}". Décris l'image et réponds à la question ou au commentaire. Sois naturel et concis (max 3 phrases).`
        : 'Analyse cette image. Décris-la en 2-3 phrases en français.';
      result = await vision.analyze(buffer, { prompt, mimeType: mime, source: 'whatsapp_image' });
    } else if (isDoc) {
      const mime = msg.message.documentMessage.mimetype || 'application/octet-stream';
      const fileName = msg.message.documentMessage.fileName || 'document';
      if (mime.includes('pdf')) {
        result = await vision.analyzePDF(buffer, { source: `whatsapp_${fileName}` });
      } else {
        return null;
      }
    }

    if (result?.text) {
      return result.text;
    }
    return null;
  } catch (err) {
    log.warn(`Vision processing failed: ${err.message}`);
    return null;
  }
}

export async function processImageBuffer(buffer, options = {}) {
  const vision = await getVisionEngine();
  if (!vision) return 'Vision engine unavailable';

  const prompt = options.prompt || 'Analyse cette image. Décris-la en 2-3 phrases en français.';
  const result = await vision.analyze(buffer, {
    prompt, mimeType: options.mimeType || 'image/jpeg',
    source: options.source || 'manual',
  });
  return result?.text || 'Could not analyze image';
}

export async function ocrImage(buffer) {
  const vision = await getVisionEngine();
  if (!vision) return 'Vision engine unavailable';
  const result = await vision.analyze(buffer, {
    prompt: 'Extrais tout le texte visible dans cette image. Retourne UNIQUEMENT le texte, sans commentaire.',
    ocr: true, mimeType: 'image/jpeg', source: 'ocr',
  });
  return result?.text || 'No text found';
}

export default { processMediaMessage, processImageBuffer, ocrImage };

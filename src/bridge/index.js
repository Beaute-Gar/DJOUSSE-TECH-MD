import crypto from 'crypto';
import { createLogger } from '../../packages/infrastructure/logger.js';

const log = createLogger('BRIDGE');

let cachedToken = null;

export function getWacrmToken() {
  return cachedToken;
}

function aes256GcmDecrypt(encryptedText) {
  const parts = encryptedText.split(':');
  if (parts.length === 3) {
    const [ivHex, ctHex, tagHex] = parts;
    const key = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(ctHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
  if (parts.length === 2) {
    const [ivHex, ctHex] = parts;
    const key = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(ctHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
  throw new Error('Unrecognised encrypted token format');
}

async function loadTokenFromSupabase(supabase) {
  try {
    const { data } = await supabase
      .from('whatsapp_config')
      .select('access_token')
      .limit(1)
      .single();

    if (data?.access_token) {
      const token = aes256GcmDecrypt(data.access_token);
      cachedToken = token;
      log.info('Token WhatsApp charge depuis Supabase');
      return token;
    }
  } catch (e) {
    log.warn(`Impossible de charger le token Supabase: ${e.message}`);
  }

  if (process.env.WHATSAPP_ACCESS_TOKEN) {
    cachedToken = process.env.WHATSAPP_ACCESS_TOKEN;
    log.info('Token WhatsApp charge depuis .env');
    return cachedToken;
  }

  return null;
}

export async function initBridge(sock) {
  let supabase = null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey && supabaseUrl !== 'https://xxxxxxxxxxxx.supabase.co') {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false }
      });
      log.info('Supabase connecte');
    } catch (e) {
      log.warn(`Supabase non disponible: ${e.message}`);
    }
  } else {
    log.info('Supabase non configure (bridge WACRM desactive)');
  }

  if (supabase) {
    await loadTokenFromSupabase(supabase);
    const { initWacrmSync } = await import('./wacrm-sync.js');
    initWacrmSync(sock, supabase);
  } else if (process.env.WHATSAPP_ACCESS_TOKEN) {
    cachedToken = process.env.WHATSAPP_ACCESS_TOKEN;
    log.info('Token WhatsApp charge depuis .env');
  }

  return supabase;
}

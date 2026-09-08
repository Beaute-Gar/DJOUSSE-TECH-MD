import { createLogger } from '../../packages/infrastructure/logger.js';

const log = createLogger('WACRM-SYNC');

let supabase = null;
let syncInterval = null;

export function initWacrmSync(sock, supabaseClient) {
  supabase = supabaseClient;
  if (!supabase) {
    log.warn('⚠️ Pas de Supabase — synchronisation WACRM désactivée');
    return;
  }

  syncInterval = setInterval(() => processSyncQueue(sock), 10_000);
  sock.ev.on('connection.update', ({ connection }) => {
    if (connection === 'close') stopWacrmSync();
  });

  log.info('✅ Pont WACRM actif (sync toutes les 10s)');
}

export function stopWacrmSync() {
  if (syncInterval) clearInterval(syncInterval);
}

export async function queueContactSync(userId, jid, data) {
  if (!supabase) return;
  try {
    await supabase.from('djousse_sync_queue').insert({
      user_id: userId,
      action: 'contact_update',
      payload: { jid, ...data }
    });
  } catch (e) {
    log.error(`Queue error: ${e.message}`);
  }
}

export async function queueActivity(userId, module, action, targetJid, details = {}) {
  if (!supabase) return;
  try {
    await supabase.from('djousse_activity_log').insert({
      user_id: userId,
      module,
      action,
      target_jid: targetJid,
      target_phone: targetJid?.split('@')[0],
      details
    });
  } catch (e) {
    log.error(`Activity log error: ${e.message}`);
  }
}

async function processSyncQueue(sock) {
  if (!supabase) return;
  try {
    const { data: items, error } = await supabase
      .from('djousse_sync_queue')
      .select('*')
      .eq('processed', false)
      .order('created_at', { ascending: true })
      .limit(10);

    if (error || !items?.length) return;

    for (const item of items) {
      try {
        if (item.action === 'contact_update') {
          const p = item.payload;
          const { error: upsertError } = await supabase.from('djousse_bot_contacts').upsert({
            user_id: item.user_id,
            jid: p.jid,
            phone_number: p.jid?.split('@')[0],
            name: p.name || null,
            push_name: p.pushName || null,
            profile_pic_url: p.profilePicUrl || null,
            labels: p.labels || [],
            trust_score: p.trustScore ?? 100,
            warn_count: p.warnCount ?? 0,
            is_blocked: p.isBlocked ?? false,
            is_blacklisted: p.isBlacklisted ?? false,
            metadata: p.metadata || {},
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,jid' });

          if (upsertError) throw upsertError;
        }

        await supabase.from('djousse_sync_queue').update({ processed: true, processed_at: new Date().toISOString() }).eq('id', item.id);
      } catch (e) {
        await supabase.from('djousse_sync_queue').update({ processed: true, error: e.message, processed_at: new Date().toISOString() }).eq('id', item.id);
        log.error(`Sync item ${item.id} failed: ${e.message}`);
      }
    }
  } catch (e) {
    log.error(`Sync queue error: ${e.message}`);
  }
}

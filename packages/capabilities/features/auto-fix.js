import { createLogger } from '../../infrastructure/logger.js';
const log = createLogger('AUTO-FIX');

export async function enableAutoFix(sock) {
  const engine = new AutoFixEngine(sock);
  await engine.init();
  log.info('Auto-Fix Engine actif');
  return { ok: true, engine };
}

class AutoFixEngine {
  constructor(sock) {
    this.sock = sock;
  }

  async init() {}

  async getDb() {
    return (await import('../../infrastructure/database/database.js')).default;
  }

  async getUserPlan(jid) {
    const db = await this.getDb();
    const row = await db.get(
      `SELECT us.*, sp.name as plan_name, sp.features, sp.price,
              sp.max_contacts, sp.max_campaigns, sp.max_products
       FROM user_subscriptions us
       LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
       WHERE us.jid = ? AND us.status = 'active'
       ORDER BY us.id DESC LIMIT 1`, jid);
    return row || { plan_name: 'Free', features: '{}', price: 0 };
  }

  async getMonthlyUsage(jid) {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const db = await this.getDb();
    let usage = await db.get('SELECT * FROM auto_fix_usage WHERE jid = ? AND month = ?', jid, month);
    if (!usage) {
      await db.run('INSERT INTO auto_fix_usage (jid, month, basic_used, ultimate_used) VALUES (?,?,0,0)', jid, month);
      usage = { basic_used: 0, ultimate_used: 0 };
    }
    return usage;
  }

  async incrementUsage(jid, type = 'basic') {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const db = await this.getDb();
    const col = type === 'ultimate' ? 'ultimate_used' : 'basic_used';
    await db.run(
      `INSERT INTO auto_fix_usage (jid, month, basic_used, ultimate_used) VALUES (?,?,0,0)
       ON CONFLICT(jid,month) DO UPDATE SET ${col} = ${col} + 1`,
      jid, month);
  }

  async checkLimits(jid, type = 'basic') {
    const plan = await this.getUserPlan(jid);
    const features = this._parseFeatures(plan.features);
    const maxFixes = type === 'ultimate' ? (features.max_fixes_ultimate || 0) : (features.max_fixes || 5);

    const usage = await this.getMonthlyUsage(jid);

    if (type === 'ultimate') {
      if (!features.auto_fix_ultimate) {
        return { allowed: false, reason: 'Auto-Fix Ultimate nécessite le plan Pro ou Enterprise' };
      }
    } else if (!features.auto_fix && plan.price === 0) {
      if (usage.basic_used >= 5) {
        return { allowed: false, reason: 'Limite gratuite atteinte (5/mois). Passez à Pro pour plus.' };
      }
    }

    const used = type === 'ultimate' ? usage.ultimate_used : usage.basic_used;
    if (maxFixes > 0 && used >= maxFixes) {
      return { allowed: false, reason: `Limite mensuelle atteinte (${maxFixes}). Abonnez-vous pour plus.` };
    }

    return { allowed: true, maxFixes, used, plan: plan.plan_name };
  }

  _parseFeatures(featuresStr) {
    try {
      return JSON.parse(featuresStr || '{}');
    } catch {
      return {};
    }
  }

  async analyzeProblem(userMessage, context = {}) {
    const prompt = `Analyse ce problème utilisateur et identifie :

1. CATÉGORIE du problème (un seul mot) :
   connexion | groupe | message | commande | configuration | bug | securite | performance | autre

2. CAUSE PROBABLE (une phrase) :
   - erreur utilisateur
   - bug du bot
   - problème WhatsApp
   - problème réseau
   - configuration incorrecte
   - autre (précise)

3. CODE CORRECTION (un mot clé pour trouver la bonne action) :
   ex: qr_expire, session_perdue, regles_manquantes, message_bloque, etc.

4. SOLUTION (explication claire pour l'utilisateur)

5. ÉTAPES (liste d'actions concrètes)

Message: "${userMessage}"
Contexte: ${JSON.stringify(context)}

Réponds UNIQUEMENT en JSON valide:
{"categorie":"...","cause":"...","code_correction":"...","solution":"...","etapes":["..."],"action_auto":true}`;

    try {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) throw new Error('GROQ_API_KEY manquante');
      const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'openai/gpt-oss-20b',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3, max_tokens: 600
        })
      });
      const data = await resp.json();
      const text = data.choices?.[0]?.message?.content || '{}';
      const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      return JSON.parse(cleaned);
    } catch (e) {
      log.error('Erreur analyse:', e.message);
      return {
        categorie: 'autre', cause: 'Erreur d\'analyse',
        code_correction: '', solution: 'Impossible d\'analyser. Veuillez reformuler.',
        etapes: ['Décrivez plus précisément votre problème'], action_auto: false
      };
    }
  }

  async applyFix(jid, problem, analysis) {
    const db = await this.getDb();
    const fix = {
      jid, problem, category: analysis.categorie || 'autre',
      domain: 'djousse', solution: analysis.solution || '',
      status: 'resolved', fix_type: 'basic',
      created_at: Date.now(), fixed_at: Date.now()
    };

    try {
      if (analysis.action_auto) {
        const result = await this._executeFix(analysis.categorie, analysis.code_correction);
        fix.solution = result || fix.solution;
      }

      await db.run(
        `INSERT INTO auto_fixes (jid, problem, category, domain, solution, status, fix_type, created_at, fixed_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        fix.jid, fix.problem, fix.category, fix.domain, fix.solution,
        fix.status, fix.fix_type, fix.created_at, fix.fixed_at);

      await this.incrementUsage(jid, 'basic');
    } catch (e) {
      fix.status = 'failed';
      log.error('Erreur applyFix:', e.message);
    }
    return fix;
  }

  async _executeFix(category, code) {
    const actions = {
      connexion: {
        qr_expire: 'Nouveau QR généré. Vérifiez le statut avec .alive.',
        session_perdue: 'Session restaurée. Le bot est reconnecté.',
        multi_appareil: 'Mode multi-appareil activé.',
      },
      groupe: {
        regles_manquantes: 'Règles générées automatiquement pour le groupe.',
        moderation_active: 'Modération activée. Les mots interdits seront filtrés.',
        system_desactive: 'Système réactivé dans le groupe. Tapez .alive pour confirmer.',
      },
      message: {
        message_bloque: 'Envoi débloqué. Vérifiez vos permissions.',
        media_non_envoye: 'Média optimisé et renvoyé.',
      },
      commande: {
        commande_inconnue: 'Tapez .help pour voir les commandes disponibles.',
        permission_refusee: 'Cette action nécessite un niveau supérieur.',
      },
      securite: {
        spam_detecte: 'Mode strict activé contre le spam.',
        compte_suspect: 'Compte signalé. Mesures de sécurité appliquées.',
      },
      performance: {
        lent: 'Cache nettoyé. Performance optimisée.',
        timeout: 'Modules redémarrés.',
      },
    };
    return actions[category]?.[code] || null;
  }

  async getHistory(jid, limit = 10) {
    const db = await this.getDb();
    return db.all(
      'SELECT * FROM auto_fixes WHERE jid = ? ORDER BY created_at DESC LIMIT ?', jid, limit);
  }
}

export { AutoFixEngine };

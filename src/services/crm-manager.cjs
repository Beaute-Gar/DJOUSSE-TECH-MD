/**
 * CRM Manager — DJOUSSE-TECH-MD v3.0
 * 
 * Gestionnaire de contacts et CRM :
 * - Profils utilisateurs enrichis
 * - Notes et tags
 * - Historique d'interaction
 * - Segmentation
 * - Rappels
 * - Campagnes
 * - Statistiques par contact
 * 
 * Compatible CJS, stockage JSON (SQLite si dispo).
 */

const fs = require('fs');
const path = require('path');

/* ═══════════════════════════════════════════════════════════════════
   CONFIGURATION
   ═══════════════════════════════════════════════════════════════════ */
const CRM_CONFIG = {
    DATA_DIR: path.join(__dirname, '../../data/crm'),
    BACKUP_DIR: path.join(__dirname, '../../data/crm-backup'),
    AUTO_BACKUP_INTERVAL: 3600000,  // 1h
};

/* ═══════════════════════════════════════════════════════════════════
   CLASSE CRM MANAGER
   ═══════════════════════════════════════════════════════════════════ */
class CRMManager {
    constructor() {
        this.contacts = new Map();
        this.segments = new Map();
        this.campaigns = [];
        this.reminders = [];
        this.ensureDirs();
        this.loadAll();
    }

    ensureDirs() {
        [CRM_CONFIG.DATA_DIR, CRM_CONFIG.BACKUP_DIR].forEach(dir => {
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        });
    }

    /* ═══════════════════════════════════════════════════════════════════
       CONTACTS
       ═══════════════════════════════════════════════════════════════════ */

    /**
     * Obtenir ou créer un contact
     */
    getOrCreate(userId, data = {}) {
        if (!this.contacts.has(userId)) {
            this.contacts.set(userId, {
                id: userId,
                name: data.name || null,
                phone: data.phone || userId.split('@')[0],
                tags: [],
                notes: [],
                interactions: [],
                stats: { messages: 0, commands: 0, lastSeen: Date.now() },
                created: Date.now(),
                updated: Date.now(),
            });
        }

        const contact = this.contacts.get(userId);
        
        // Mettre à jour les données
        if (data.name && !contact.name) contact.name = data.name;
        if (data.phone) contact.phone = data.phone;
        contact.stats.lastSeen = Date.now();
        contact.updated = Date.now();

        return contact;
    }

    /**
     * Mettre à jour un contact
     */
    update(userId, updates) {
        const contact = this.getOrCreate(userId);
        Object.assign(contact, updates, { updated: Date.now() });
        this.saveContact(userId);
        return contact;
    }

    /**
     * Ajouter une interaction
     */
    addInteraction(userId, type, data = {}) {
        const contact = this.getOrCreate(userId);
        
        contact.interactions.push({
            type,  // 'message', 'command', 'call', 'group_join', etc.
            time: Date.now(),
            ...data,
        });

        // Garder les 100 dernières interactions
        if (contact.interactions.length > 100) {
            contact.interactions = contact.interactions.slice(-100);
        }

        // Stats
        if (type === 'message') contact.stats.messages++;
        if (type === 'command') contact.stats.commands++;

        this.saveContact(userId);
    }

    /**
     * Ajouter un tag
     */
    addTag(userId, tag) {
        const contact = this.getOrCreate(userId);
        if (!contact.tags.includes(tag)) {
            contact.tags.push(tag);
            this.saveContact(userId);
        }
    }

    /**
     * Supprimer un tag
     */
    removeTag(userId, tag) {
        const contact = this.getOrCreate(userId);
        contact.tags = contact.tags.filter(t => t !== tag);
        this.saveContact(userId);
    }

    /**
     * Ajouter une note
     */
    addNote(userId, note) {
        const contact = this.getOrCreate(userId);
        contact.notes.push({
            text: note,
            time: Date.now(),
        });
        this.saveContact(userId);
    }

    /**
     * Rechercher des contacts
     */
    search(query) {
        const q = query.toLowerCase();
        const results = [];
        
        for (const [id, contact] of this.contacts) {
            if (
                contact.name?.toLowerCase().includes(q) ||
                contact.phone?.includes(q) ||
                contact.tags.some(t => t.toLowerCase().includes(q)) ||
                contact.notes.some(n => n.text.toLowerCase().includes(q))
            ) {
                results.push(contact);
            }
        }
        
        return results;
    }

    /**
     * Filtrer par tag
     */
    filterByTag(tag) {
        const results = [];
        for (const [id, contact] of this.contacts) {
            if (contact.tags.includes(tag)) results.push(contact);
        }
        return results;
    }

    /* ═══════════════════════════════════════════════════════════════════
       SEGMENTS
       ═══════════════════════════════════════════════════════════════════ */

    /**
     * Créer un segment
     */
    createSegment(name, criteria) {
        this.segments.set(name, {
            name,
            criteria,  // { tags: ['vip'], minMessages: 10, etc. }
            created: Date.now(),
        });
    }

    /**
     * Obtenir les membres d'un segment
     */
    getSegmentMembers(segmentName) {
        const segment = this.segments.get(segmentName);
        if (!segment) return [];

        const results = [];
        for (const [id, contact] of this.contacts) {
            if (this.matchCriteria(contact, segment.criteria)) {
                results.push(contact);
            }
        }
        return results;
    }

    matchCriteria(contact, criteria) {
        if (criteria.tags && !criteria.tags.some(t => contact.tags.includes(t))) return false;
        if (criteria.minMessages && contact.stats.messages < criteria.minMessages) return false;
        if (criteria.maxMessages && contact.stats.messages > criteria.maxMessages) return false;
        if (criteria.activeDays) {
            const daysSinceActive = (Date.now() - contact.stats.lastSeen) / 86400000;
            if (daysSinceActive > criteria.activeDays) return false;
        }
        return true;
    }

    /* ═══════════════════════════════════════════════════════════════════
       CAMPAGNES
       ═══════════════════════════════════════════════════════════════════ */

    /**
     * Créer une campagne
     */
    createCampaign(name, message, targetSegment) {
        const campaign = {
            id: Date.now().toString(36),
            name,
            message,
            targetSegment,
            status: 'draft',  // draft, running, completed, paused
            sent: 0,
            failed: 0,
            created: Date.now(),
            started: null,
            completed: null,
        };
        this.campaigns.push(campaign);
        return campaign;
    }

    /**
     * Lancer une campagne
     */
    async executeCampaign(campaignId, sendFn) {
        const campaign = this.campaigns.find(c => c.id === campaignId);
        if (!campaign) return null;

        const targets = this.getSegmentMembers(campaign.targetSegment);
        campaign.status = 'running';
        campaign.started = Date.now();

        for (const contact of targets) {
            try {
                await sendFn(contact.id, campaign.message);
                campaign.sent++;
            } catch (e) {
                campaign.failed++;
            }
        }

        campaign.status = 'completed';
        campaign.completed = Date.now();
        return campaign;
    }

    /* ═══════════════════════════════════════════════════════════════════
       RAPPELS
       ═══════════════════════════════════════════════════════════════════ */

    /**
     * Créer un rappel
     */
    createReminder(userId, message, time) {
        this.reminders.push({
            id: Date.now().toString(36),
            userId,
            message,
            time,
            created: Date.now(),
            sent: false,
        });
    }

    /**
     * Vérifier les rappels à envoyer
     */
    getDueReminders() {
        const now = Date.now();
        return this.reminders.filter(r => !r.sent && r.time <= now);
    }

    /**
     * Marquer un rappel comme envoyé
     */
    markReminderSent(reminderId) {
        const reminder = this.reminders.find(r => r.id === reminderId);
        if (reminder) reminder.sent = true;
    }

    /* ═══════════════════════════════════════════════════════════════════
       STATISTIQUES
       ═══════════════════════════════════════════════════════════════════ */

    /**
     * Stats globales
     */
    getStats() {
        const contacts = Array.from(this.contacts.values());
        
        return {
            totalContacts: contacts.length,
            activeToday: contacts.filter(c => 
                Date.now() - c.stats.lastSeen < 86400000
            ).length,
            totalMessages: contacts.reduce((a, c) => a + c.stats.messages, 0),
            totalCommands: contacts.reduce((a, c) => a + c.stats.commands, 0),
            topContacts: contacts
                .sort((a, b) => b.stats.messages - a.stats.messages)
                .slice(0, 10)
                .map(c => ({ name: c.name || c.phone, messages: c.stats.messages })),
            campaigns: this.campaigns.length,
            pendingReminders: this.reminders.filter(r => !r.sent).length,
        };
    }

    /* ═══════════════════════════════════════════════════════════════════
       PERSISTANCE
       ═══════════════════════════════════════════════════════════════════ */

    saveContact(userId) {
        const contact = this.contacts.get(userId);
        if (!contact) return;
        
        try {
            const filePath = path.join(CRM_CONFIG.DATA_DIR, `${this.sanitize(userId)}.json`);
            fs.writeFileSync(filePath, JSON.stringify(contact, null, 2));
        } catch {}
    }

    loadAll() {
        try {
            const files = fs.readdirSync(CRM_CONFIG.DATA_DIR).filter(f => f.endsWith('.json'));
            for (const file of files) {
                try {
                    const data = JSON.parse(fs.readFileSync(path.join(CRM_CONFIG.DATA_DIR, file), 'utf8'));
                    this.contacts.set(data.id, data);
                } catch {}
            }
            console.log(`[CRM] ${this.contacts.size} contacts chargés`);
        } catch {}
    }

    saveAll() {
        for (const [id] of this.contacts) {
            this.saveContact(id);
        }
    }

    sanitize(userId) {
        return String(userId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
    }
}

/* ═══════════════════════════════════════════════════════════════════
   INSTANCE SINGLETON
   ═══════════════════════════════════════════════════════════════════ */
let instance = null;

function getCRM() {
    if (!instance) instance = new CRMManager();
    return instance;
}

module.exports = {
    getCRM,
    CRMManager,
    CRM_CONFIG,
};

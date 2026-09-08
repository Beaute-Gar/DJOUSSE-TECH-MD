import { createLogger } from '../../infrastructure/logger.js';
const log = createLogger('AUTO-FIX-ULTIMATE');

export async function enableAutoFixUltimate(sock) {
  const engine = new AutoFixUltimateEngine(sock);
  await engine.init();
  log.info('Auto-Fix Ultimate Engine actif');
  return { ok: true, engine };
}

const DOMAIN_PROMPTS = {
  tech: {
    role: 'Architecte Logiciel Senior — 30 ans chez Google/Microsoft/Apple',
    system: `Tu es un EXPERT MONDIAL en technologie et développement.
Tu connais TOUS les langages, frameworks, et patterns.
Réponse EXIGÉE : code fonctionnel, 3 solutions alternatives, documentation officielle.
Ne dis JAMAIS "je ne sais pas". Trouve TOUJOURS une solution.`
  },
  business: {
    role: 'Consultant McKinsey — A conseillé 50+ entreprises du Fortune 500',
    system: `Tu es un CONSULTANT EN STRATÉGIE de classe mondiale.
Analyse: marché, concurrence, chiffres, plan 30/60/90 jours, KPIs, budget.
Donne des conseils de niveau CEO avec données concrètes.`
  },
  health: {
    role: 'Professeur de Médecine — 200+ publications dans des revues scientifiques',
    system: `Tu es un MÉDECIN-CHERCHEUR de renom.
Base tes réponses sur des ÉTUDES SCIENTIFIQUES (cite PubMed).
Propose solutions naturelles d'abord. Mentionne quand consulter un professionnel.`
  },
  legal: {
    role: 'Avocat à la Cour — 40 ans d\'expérience, 500+ procès gagnés',
    system: `Tu es un AVOCAT INTERNATIONAL.
Précise la juridiction, cite les textes de loi et la jurisprudence.
Propose une stratégie juridique. Rappelle que ce n'est pas un avis officiel.`
  },
  education: {
    role: 'Pédagogue de génie — A formé 10 000+ étudiants',
    system: `Tu es un PÉDAGOGUE EXPERT.
Explique comme à un débutant. Utilise des analogies et exemples concrets.
Propose des exercices pratiques. Vérifie la compréhension.`
  },
  relationships: {
    role: 'Psychologue Clinicien — 35 ans de pratique, auteur de 5 best-sellers',
    system: `Tu es un PSYCHOLOGUE CLINICIEN.
Écoute avec empathie. Analyse sous plusieurs angles.
Propose des outils de communication concrets. Ne prends jamais parti sans comprendre.`
  },
  creative: {
    role: 'Directeur Artistique — A travaillé chez Pixar, Apple, Nike',
    system: `Tu es un DIRECTEUR ARTISTIQUE de génie.
Pense out of the box. Propose 3 concepts originaux avec descriptions visuelles.
Donne des références inspirantes et des outils pour réaliser.`
  },
  survival: {
    role: 'Expert Survivaliste — A survécu dans 50+ environnements extrêmes',
    system: `Tu es un EXPERT EN SURVIE.
Propose des solutions avec les moyens du bord. Donne alternatives si matériel manquant.
Explique étape par étape. Mentionne les dangers potentiels.`
  }
};

class AutoFixUltimateEngine {
  constructor(sock) {
    this.sock = sock;
  }

  async init() {}

  async detectDomain(problem) {
    try {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) return 'tech';
      const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'openai/gpt-oss-20b',
          messages: [{
            role: 'user',
            content: `Analyse ce problème et réponds UNIQUEMENT par le domaine (un mot) :\n${problem}\n\nDomaines: tech, business, health, legal, education, relationships, creative, survival`
          }],
          temperature: 0.1, max_tokens: 20
        })
      });
      const data = await resp.json();
      const domain = (data.choices?.[0]?.message?.content || '').trim().toLowerCase();
      return DOMAIN_PROMPTS[domain] ? domain : 'tech';
    } catch { return 'tech'; }
  }

  async solveProblem(problem, context = '', domain = null) {
    if (!domain) domain = await this.detectDomain(problem);
    const dp = DOMAIN_PROMPTS[domain] || DOMAIN_PROMPTS.tech;

    const userPrompt = `Problème à résoudre : ${problem}\n\nContexte : ${context || 'Aucun'}\n\nINSTRUCTIONS :\n1. Analyse la cause racine\n2. Donne la solution principale (détaillée)\n3. Propose 2-3 alternatives\n4. Donne les ressources utiles\n5. Explique comment éviter à l'avenir`;

    const solution = await this.callAI(dp.system, userPrompt, domain);
    const enriched = this.enrichSolution(solution, domain);

    return {
      domain, domainLabel: dp.role, problem,
      solution: enriched.solution,
      steps: enriched.steps,
      resources: enriched.resources,
      alternatives: enriched.alternatives,
      warnings: enriched.warnings
    };
  }

  async callAI(systemPrompt, userPrompt, domain) {
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.GROQ_API_KEY;
    const isGroq = !process.env.OPENROUTER_API_KEY;

    try {
      const url = isGroq
        ? 'https://api.groq.com/openai/v1/chat/completions'
        : 'https://openrouter.ai/api/v1/chat/completions';

      const model = isGroq ? 'openai/gpt-oss-20b' : 'anthropic/claude-3.5-sonnet';

      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...(isGroq ? {} : { 'HTTP-Referer': 'https://djousse-tech-md.onrender.com' })
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt + '\n\n⚠️ Mode gratuit = QUALITÉ MAXIMALE. Donne TOUT ce que tu peux, sans limitation.' },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7, max_tokens: 2000
        })
      });
      const data = await resp.json();
      return data.choices?.[0]?.message?.content || 'Solution non disponible.';
    } catch (e) {
      log.error('Erreur IA:', e.message);
      return `Analyse en cours... Problème identifié: ${domain}. Veuillez décrire plus en détail.`;
    }
  }

  enrichSolution(text, domain) {
    const resources = {
      tech: ['📚 MDN Web Docs', '💻 Stack Overflow', '🎓 freeCodeCamp', '📖 GitHub Docs'],
      business: ['📊 Harvard Business Review', '💼 LinkedIn Learning', '📈 Investopedia', '📚 "Zero to One" - Peter Thiel'],
      health: ['🏥 PubMed', '📚 MSD Manuals', '💊 Vidal', '🥗 NutritionData'],
      legal: ['⚖️ Légifrance', '📜 Dalloz', '🏛️ Doctrine.fr', '📚 "Le droit pour les nuls"'],
      education: ['📚 Khan Academy', '🎓 Coursera', '📝 edX', '💡 Brilliant.org'],
      relationships: ['💕 Psychology Today', '📚 Esther Perel', '🎧 Therapists in Transit podcast', '📖 "Les langages de l\'amour"'],
      creative: ['🎨 Behance', '📐 Dribbble', '🎬 YouTube Creators', '🖌️ Figma Community'],
      survival: ['🔧 WikiHow', '📺 YouTube DIY', '🛠️ Instructables', '📚 "SAS Survie"']
    };

    const steps = text.split(/\d+\.\s+/).filter(s => s.trim().length > 20).slice(0, 6).map(s => s.trim());
    const main = steps.length > 1 ? steps.shift() : text;
    const alternatives = text.match(/ALTERNATIVE[^\n]*[^.]*\./gi) || [];
    const warnings = text.match(/(ATTENTION|AVERTISSEMENT|PRÉCAUTION|⚠️)[^.]*\./gi) || [];

    return {
      solution: main || text,
      steps: steps.length ? steps : ['Solution décrite ci-dessus'],
      resources: resources[domain] || ['🔍 Google', '📚 Wikipedia', '💡 Reddit'],
      alternatives: alternatives.length ? alternatives : ['Consultez un spécialiste pour plus d\'options'],
      warnings: warnings.length ? warnings : ['Vérifiez toujours les sources officielles']
    };
  }
}

export { AutoFixUltimateEngine };

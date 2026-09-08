/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  IA PROVIDER — Appel multi-fournisseurs avec fallback      ║
 * ║  Groq → OpenRouter → Puter → banc de secours local         ║
 * ╚══════════════════════════════════════════════════════════╝
 */

async function appelerGroq(prompt, { apiKey, modele = 'llama-3.3-70b-versatile' } = {}) {
  if (!apiKey) return '';
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modele,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9,
        max_tokens: 400,
      }),
    });
    if (!res.ok) return '';
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || '';
  } catch {
    return '';
  }
}

async function appelerOpenRouter(prompt, { apiKey, modele = 'meta-llama/llama-3.1-8b-instruct' } = {}) {
  if (!apiKey) return '';
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://djousse-tech-md.onrender.com',
        'X-Title': 'DJOUSSE-TECH-MD',
      },
      body: JSON.stringify({
        model: modele,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9,
        max_tokens: 400,
      }),
    });
    if (!res.ok) { const t = await res.text().catch(() => ''); return ''; }
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || '';
  } catch {
    return '';
  }
}

async function appelerPuter(prompt, { modele = 'gpt-4o-mini' } = {}) {
  try {
    if (!globalThis.puter?.ai?.chat) return '';
    const reponse = await globalThis.puter.ai.chat(prompt, { model: modele });
    return typeof reponse === 'string' ? reponse : reponse?.message?.content || '';
  } catch {
    return '';
  }
}

export function creerAppelIA(config = {}) {
  const cfg = {
    groq: { apiKey: config.groqApiKey || process.env.GROQ_API_KEY || '', modele: config.groqModele },
    openrouter: { apiKey: config.openrouterApiKey || process.env.OPENROUTER_API_KEY || '', modele: config.openrouterModele },
    puter: { modele: config.puterModele },
  };

  return async function appelerIA(prompt) {
    const chaine = [
      () => appelerGroq(prompt, cfg.groq),
      () => appelerOpenRouter(prompt, cfg.openrouter),
      () => appelerPuter(prompt, cfg.puter),
    ];

    for (const tenter of chaine) {
      try {
        const texte = await tenter();
        if (texte && texte.trim()) return texte;
      } catch {}
    }
    return '';
  };
}

'use strict';
/**
 * ══════════════════════════════════════════════════════════════════
 * COMMANDES PORTÉES DE TEDDY-XMD — famille « football live »
 * ──────────────────────────────────────────────────────────────────
 * 9 compétitions × 4 tableaux = 36 commandes, générées par boucle :
 *   <ligue>_table · <ligue>_matchday · <ligue>_top_scorer · <ligue>_top_assist
 *   ligues : bundesliga eredivisie laliga ligue1 seriea epl
 *            liga_portugal cl wc
 *
 * ⚠️ SÉCURITÉ : TEDDY codait sa clé API EN DUR dans les plugins.
 * Ici la clé vient de la variable d'environnement FOOTBALL_API_KEY
 * (fichier .env, jamais commité). Sans clé, la commande répond un
 * message clair au lieu de planter.
 *
 * ⚠️ NON PORTÉES : les 18 commandes « _news » et « _highlights » de TEDDY
 * étaient des coquilles (apiKey=YOUR_NEWSAPI_KEY jamais remplacé).
 * ══════════════════════════════════════════════════════════════════
 */

const COMPS = {
  bundesliga: { code: 'BL1', nom: 'Bundesliga' },
  eredivisie: { code: 'DED', nom: 'Eredivisie' },
  laliga: { code: 'PD', nom: 'La Liga' },
  ligue1: { code: 'FL1', nom: 'Ligue 1' },
  seriea: { code: 'SA', nom: 'Serie A' },
  epl: { code: 'PL', nom: 'Premier League' },
  liga_portugal: { code: 'PPL', nom: 'Liga Portugal' },
  cl: { code: 'CL', nom: 'Champions League' },
  wc: { code: 'WC', nom: 'Coupe du monde' },
};

const DONNEES = {
  table: { path: 'standings', titre: 'CLASSEMENT', icone: '📊' },
  matchday: { path: 'matches', titre: 'RENCONTRES', icone: '⚽' },
  top_scorer: { path: 'scorers', titre: 'MEILLEURS BUTEURS', icone: '🥇' },
  top_assist: { path: 'assists', titre: 'MEILLEURS PASSEURS', icone: '🅰️' },
};

function getKey() {
  return String(process.env.FOOTBALL_API_KEY || '').trim();
}

async function appelApi(pathExtra) {
  const key = getKey();
  if (!key) {
    const e = new Error('Clé API absente');
    e.codePasDeCle = true;
    throw e;
  }
  const url = `https://api.football-data.org/v4/competitions${pathExtra}`;
  const r = await fetch(url, { headers: { 'X-Auth-Token': key }, signal: AbortSignal.timeout(20000) });
  if (r.status === 429) throw new Error('Quota API atteint (10 requêtes/min sur le plan gratuit)');
  if (!r.ok) {
    let detail = '';
    try { const j = await r.json(); detail = j?.message || ''; } catch {}
    throw new Error(`API ${r.status}${detail ? ` — ${String(detail).slice(0, 80)}` : ''} (clé FOOTBALL_API_KEY valide ?)`);
  }
  return r.json();
}

function renderStandings(d) {
  const tab = d?.standings?.find((s) => s.type === 'TOTAL') || d?.standings?.[0];
  const lignes = (tab?.table || []).slice(0, 25).map((r) =>
    `${String(r.position).padStart(2)}. ${r.team?.shortName || r.team?.name || r.team?.crest || '?'} — ${r.points} pts (${r.won}V ${r.draw}N ${r.lost}D)`);
  return lignes.length ? lignes : ['Classement indisponible.'];
}

function renderMatches(d) {
  const ms = (d?.matches || []).slice(0, 10);
  if (!ms.length) return ['Aucune rencontre planifiée.'];
  return ms.map((m) =>
    `${m.homeTeam?.shortName || '?'} ${m.score?.fullTime?.home ?? '-'} - ${m.score?.fullTime?.away ?? '-'} ${m.awayTeam?.shortName || '?'} (${m.status || '?'})`);
}

function renderScorers(d) {
  const list = (d?.scorers || []).slice(0, 15);
  if (!list.length) return ['Aucun buteur.'];
  return list.map((s) =>
    `${s.player?.name || '?'} (${s.team?.shortName || s.team?.name || '?'}) — ${s.goals ?? s.assists ?? 0}`);
}

function registerPortedFoot(cmd, deps) {
  const { config, send, buildFrame, bullet } = deps;

  const render = { table: renderStandings, matchday: renderMatches, top_scorer: renderScorers, top_assist: renderScorers };

  for (const [ligue, { code, nom }] of Object.entries(COMPS)) {
    for (const [suffixe, { path, titre, icone }] of Object.entries(DONNEES)) {
      const nomCom = `${ligue}_${suffixe}`;
      cmd(nomCom, {
        cat: 7, desc: `${nom} — ${titre.toLowerCase()}`, usage: nomCom, icon: icone,
      }, async (c) => {
        try {
          const d = await appelApi(`/${code}/${path}`);
          await c.reply(buildFrame(`${nom.toUpperCase()} — ${titre}`, render[suffixe](d)));
        } catch (e) {
          if (e.codePasDeCle) {
            return c.error([
              'CLÉ API REQUISE',
              `Ajoute FOOTBALL_API_KEY dans ton .env`,
              'Clé gratuite : https://www.football-data.org/client/register',
            ]);
          }
          return c.error([`${nomCom.toUpperCase()} ÉCHEC`, e.message]);
        }
      });
    }
  }

  /* vue d'ensemble */
  cmd('football', { cat: 7, desc: 'Voir les 36 commandes football', usage: 'football', icon: '⚽' }, async (c) => {
    const lignes = [bullet('CLÉ API', getKey() ? 'configurée ✅' : 'absente (FOOTBALL_API_KEY)')];
    for (const [ligue, { nom }] of Object.entries(COMPS)) {
      lignes.push(bullet(ligue, Object.keys(DONNEES).map((s) => `${ligue}_${s}`).join(', ')));
    }
    return c.reply(buildFrame('FOOTBALL LIVE', lignes));
  });
}

module.exports = { registerPortedFoot, COMPS, DONNEES, appelApi, getKey };

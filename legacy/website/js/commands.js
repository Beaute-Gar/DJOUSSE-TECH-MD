const commandState = document.getElementById('commandState');
const commandList = document.getElementById('commandList');
const search = document.getElementById('commandSearch');
const category = document.getElementById('commandCategory');
let commands = [];

function escapeHtml(value = '') { const node = document.createElement('div'); node.textContent = value; return node.innerHTML; }
function renderCommands() {
  const query = search.value.trim().toLowerCase();
  const filter = category.value;
  const visible = commands.filter((command) => {
    const haystack = `${command.name} ${command.description} ${command.category}`.toLowerCase();
    return (!query || haystack.includes(query)) && (filter === 'all' || command.category === filter);
  });
  commandList.innerHTML = visible.length ? visible.map((command) => `<article class="command-card"><div><span class="command-category">${escapeHtml(command.category || 'Sans catégorie')}</span><h2><code>.${escapeHtml(command.name)}</code></h2><p>${escapeHtml(command.description || 'Description indisponible')}</p></div><div class="command-meta"><span>Syntaxe : <code>${escapeHtml(command.syntax || `.${command.name}`)}</code></span><span>Statut : ${escapeHtml(command.status || 'inconnu')}</span></div></article>`).join('') : '<div class="data-state"><h2>Aucun résultat</h2><p>Aucune commande ne correspond à votre recherche.</p></div>';
}
async function loadCommands() {
  try {
    const response = await fetch('/api/commands', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('API indisponible');
    const payload = await response.json();
    if (!Array.isArray(payload.commands)) throw new Error('Contrat invalide');
    commands = payload.commands;
    commandState.hidden = true;
    commandList.hidden = false;
    renderCommands();
  } catch (_) {
    // L’absence d’API est un état produit explicite, pas une raison d’afficher des données fictives.
  }
}
search?.addEventListener('input', renderCommands);
category?.addEventListener('change', renderCommands);
loadCommands();

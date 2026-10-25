const list = document.querySelector('[data-command-list]');
const searchInput = document.querySelector('[data-command-search]');
const categoryFilter = document.querySelector('[data-category-filter]');
const accessFilter = document.querySelector('[data-access-filter]');
const countLabel = document.querySelector('[data-command-count]');
const loadMore = document.querySelector('[data-load-more]');
const partialBanner = document.querySelector('[data-partial-banner]');
const emptyState = document.querySelector('[data-command-empty]');
const PAGE_SIZE = 48;
let commands = [];
let visibleCommands = [];
let rendered = 0;

const fold = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
const accessLabels = { public: 'Public', admin: 'Administrateur', owner: 'Propriétaire' };

function makeBadge(text, className = '') {
  const badge = document.createElement('span');
  badge.className = `badge ${className}`.trim();
  badge.textContent = text;
  return badge;
}

function makeCommandCard(command, categories) {
  const card = document.createElement('article');
  card.className = 'command-card';
  card.id = command.name.toLocaleLowerCase('fr').replace(/[^a-z0-9-]/g, '-');
  card.dataset.category = String(command.category);
  card.dataset.access = command.access;

  const head = document.createElement('div');
  head.className = 'command-head';
  const title = document.createElement('h2');
  title.className = 'command-name';
  const anchor = document.createElement('a');
  anchor.href = `#${encodeURIComponent(card.id)}`;
  anchor.textContent = `.${command.name}`;
  anchor.setAttribute('aria-label', `Lien vers la commande ${command.name}`);
  title.append(anchor);
  head.append(title);
  if (command.aliases?.length) {
    const aliases = document.createElement('span');
    aliases.className = 'aliases';
    aliases.textContent = `Alias : ${command.aliases.map((alias) => `.${alias}`).join(', ')}`;
    head.append(aliases);
  }
  card.append(head);

  const description = document.createElement('p');
  description.textContent = command.description || 'Description à confirmer dans le registre du bot.';
  card.append(description);

  const meta = document.createElement('div');
  meta.className = 'command-meta';
  const category = categories.find((item) => item.n === Number(command.category));
  meta.append(makeBadge(category ? `${category.icon} ${category.name}` : `Catégorie ${command.category}`));
  const confirmed = command.accessConfirmed !== false;
  meta.append(makeBadge(confirmed ? (accessLabels[command.access] || 'Accès à confirmer') : 'Accès à confirmer', confirmed ? 'badge--accent' : 'badge--warning'));
  if (command.aliases?.length) meta.append(makeBadge(`${command.aliases.length} alias`));
  const copy = document.createElement('button');
  copy.className = 'copy-button';
  copy.type = 'button';
  copy.dataset.copyText = `.${command.name}`;
  copy.textContent = 'Copier';
  copy.setAttribute('aria-label', `Copier la commande ${command.name}`);
  meta.append(copy);
  card.append(meta);

  if (command.usage) {
    const usage = document.createElement('div');
    usage.className = 'command-usage';
    usage.textContent = `Usage : ${command.usage}`;
    card.append(usage);
  }
  return card;
}

function renderNext() {
  if (!list) return;
  const categoryData = window.djousseSiteData?.categories || [];
  const fragment = document.createDocumentFragment();
  const end = Math.min(rendered + PAGE_SIZE, visibleCommands.length);
  for (const command of visibleCommands.slice(rendered, end)) fragment.append(makeCommandCard(command, categoryData));
  list.append(fragment);
  rendered = end;
  if (countLabel) countLabel.textContent = `${rendered} / ${visibleCommands.length} résultat${visibleCommands.length === 1 ? '' : 's'}`;
  if (loadMore) loadMore.hidden = rendered >= visibleCommands.length;
}

function applyFilters() {
  if (!list) return;
  rendered = 0;
  list.replaceChildren();
  const query = fold(searchInput?.value);
  const category = categoryFilter?.value || '';
  const access = accessFilter?.value || '';
  visibleCommands = commands.filter((command) => {
    const matchesText = !query || fold([command.name, ...(command.aliases || []), command.description].join(' ')).includes(query);
    return matchesText && (!category || String(command.category) === category) && (!access || command.access === access);
  });
  renderNext();
  if (emptyState) emptyState.hidden = visibleCommands.length !== 0;
}

async function init() {
  try {
    const [commandsResponse, siteResponse] = await Promise.all([
      fetch('./data/commands.json', { cache: 'no-cache' }),
      fetch('./data/site-data.json', { cache: 'no-cache' }),
    ]);
    if (!commandsResponse.ok || !siteResponse.ok) throw new Error('Catalogue non disponible');
    const catalog = await commandsResponse.json();
    const siteData = await siteResponse.json();
    window.djousseSiteData = siteData;
    commands = Array.isArray(catalog) ? catalog : (catalog.commands || []);
    if (partialBanner) {
      partialBanner.hidden = !catalog.partial;
      if (catalog.notice) partialBanner.textContent = catalog.notice;
    }
    for (const category of siteData.categories || []) {
      const option = document.createElement('option');
      option.value = String(category.n);
      option.textContent = `${category.icon} ${category.name}`;
      categoryFilter?.append(option);
    }
    const requestedCategory = new URLSearchParams(location.search).get('cat');
    if (requestedCategory && siteData.categories.some((item) => String(item.n) === requestedCategory)) categoryFilter.value = requestedCategory;
    applyFilters();
    if (location.hash) {
      window.setTimeout(() => document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({ block: 'start' }), 120);
    }
  } catch {
    if (partialBanner) {
      partialBanner.hidden = false;
      partialBanner.textContent = 'Le catalogue ne peut pas être chargé pour le moment.';
    }
    if (emptyState) {
      emptyState.hidden = false;
      emptyState.textContent = 'Catalogue temporairement indisponible.';
    }
  }
}

searchInput?.addEventListener('input', applyFilters);
categoryFilter?.addEventListener('change', () => {
  const params = new URLSearchParams(location.search);
  if (categoryFilter.value) params.set('cat', categoryFilter.value); else params.delete('cat');
  const query = params.toString();
  history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}`);
  applyFilters();
});
accessFilter?.addEventListener('change', applyFilters);
loadMore?.addEventListener('click', renderNext);
init();

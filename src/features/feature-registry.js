import { createLogger } from '../../packages/infrastructure/logger.js';

const log = createLogger('FEATURE-REGISTRY');

const REGISTRY = {
  /* 🔴 P1 — SÉCURITÉ */
  block:        { priority: 1, auto: true,  file: './block.js',       fn: 'enableBlock' },
  unblock:      { priority: 1, auto: true,  file: './unblock.js',     fn: 'enableUnblock' },
  blacklist:    { priority: 1, auto: true,  file: './blacklist.js',   fn: 'enableBlacklist' },
  warn:         { priority: 1, auto: true,  file: './warn.js',        fn: 'enableWarn' },
  unwarn:       { priority: 1, auto: true,  file: './unwarn.js',      fn: 'enableUnwarn' },
  warnings:     { priority: 1, auto: true,  file: './warnings.js',    fn: 'enableWarnings' },

  /* 🟠 P2 — GROUPE */
  close:        { priority: 2, auto: false, file: './close.js',       fn: 'enableClose' },
  config:       { priority: 2, auto: true,  file: './config.js',      fn: 'enableConfig' },
  creategroup:  { priority: 2, auto: false, file: './creategroup.js', fn: 'enableCreateGroup' },
  delete:       { priority: 2, auto: true,  file: './delete.js',      fn: 'enableDelete' },
  mode:         { priority: 2, auto: true,  file: './mode.js',        fn: 'enableMode' },
  setgoodbye:   { priority: 2, auto: true,  file: './setgoodbye.js',  fn: 'enableSetGoodbye' },
  setname:      { priority: 2, auto: false, file: './setname.js',     fn: 'enableSetName' },
  setpp:        { priority: 2, auto: false, file: './setpp.js',       fn: 'enableSetPP' },
  setwelcome:   { priority: 2, auto: true,  file: './setwelcome.js',  fn: 'enableSetWelcome' },

  /* 🟡 P3 — MÉDIAS */
  broadcast:    { priority: 3, auto: false, file: './broadcast.js',   fn: 'enableBroadcast' },
  call:         { priority: 3, auto: true,  file: './call.js',        fn: 'enableCall' },
  disappear:    { priority: 3, auto: true,  file: './disappear.js',   fn: 'enableDisappear' },
  enhance:      { priority: 3, auto: false, file: './enhance.js',     fn: 'enableEnhance' },
  imagine:      { priority: 3, auto: false, file: './imagine.js',     fn: 'enableImagine' },
  pp:           { priority: 3, auto: true,  file: './pp.js',          fn: 'enablePP' },
  save:         { priority: 3, auto: true,  file: './save.js',        fn: 'enableSave' },
  style:        { priority: 3, auto: false, file: './style.js',       fn: 'enableStyle' },

  /* 🟢 P4 — BUSINESS */
  biz:          { priority: 4, auto: true,  file: './biz.js',         fn: 'enableBiz' },
  catalogue:    { priority: 4, auto: true,  file: './catalogue.js',   fn: 'enableCatalogue' },
  contact:      { priority: 4, auto: true,  file: './contact.js',     fn: 'enableContact' },
  deal:         { priority: 4, auto: true,  file: './deal.js',        fn: 'enableDeal' },
  directory:    { priority: 4, auto: true,  file: './directory.js',   fn: 'enableDirectory' },
  label:        { priority: 4, auto: true,  file: './label.js',       fn: 'enableLabel' },
  product:      { priority: 4, auto: true,  file: './product.js',     fn: 'enableProduct' },
  vcf:          { priority: 4, auto: false, file: './vcf.js',         fn: 'enableVcf' },

  /* 🔵 P5 — AVANCÉ */
  autoreply:    { priority: 5, auto: true,  file: './autoreply.js',   fn: 'enableAutoReply' },
  campaign:     { priority: 5, auto: false, file: './campaign.js',    fn: 'enableCampaign' },
  channel:      { priority: 5, auto: true,  file: './channel.js',     fn: 'enableChannel' },
  chatbot:      { priority: 5, auto: true,  file: './chatbot.js',     fn: 'enableChatbot' },
  fix:          { priority: 5, auto: true,  file: './fix.js',         fn: 'enableFix' },
  myaccount:    { priority: 5, auto: true,  file: './myaccount.js',   fn: 'enableMyAccount' },
  pay:          { priority: 5, auto: true,  file: './pay.js',         fn: 'enablePay' },
  security:     { priority: 5, auto: true,  file: './security.js',    fn: 'enableSecurity' },
  select:       { priority: 5, auto: true,  file: './select.js',      fn: 'enableSelect' },

  /* 🟣 P6 — DIVERS */
  personality:  { priority: 6, auto: true,  file: './personality.js', fn: 'enablePersonality' },
  prefix:       { priority: 6, auto: true,  file: './prefix.js',      fn: 'enablePrefix' },
  stats:        { priority: 6, auto: true,  file: './stats.js',       fn: 'enableStats' },
  videocall:    { priority: 6, auto: true,  file: './videocall.js',   fn: 'enableVideoCall' },
welcome:      { priority: 6, auto: false, file: './welcome.js',       fn: 'enableWelcome' },
  whois:        { priority: 6, auto: false, file: './whois.js',       fn: 'enableWhois' },
};

const moduleStatus = new Map();
let initStartTime = 0;
let attachedSock = null;

export async function loadQueenAkumaFeatures(sock) {
  /* Idempotence : ne JAMAIS ré-attacher les listeners sur le même socket
     (l'événement 'open' peut se reproduire → 40+ listeners messages.upsert → doublons). */
  if (attachedSock === sock) return;
  attachedSock = sock;
  initStartTime = Date.now();
  const entries = Object.entries(REGISTRY).sort((a, b) => a[1].priority - b[1].priority);
  let ok = 0, fail = 0;

  console.log('\n' + '═'.repeat(55));
  console.log('📦 CHARGEMENT DES 46 MODULES QUEEN AKUMA');
  console.log('═'.repeat(55));

  for (const [name, cfg] of entries) {
    try {
      const mod = await import(cfg.file);
      const func = mod[cfg.fn];
      if (typeof func !== 'function') {
        throw new Error(`Fonction "${cfg.fn}" introuvable`);
      }
      await func(sock);
      moduleStatus.set(name, { ok: true, auto: cfg.auto });
      ok++;
      console.log(`  ✅ ${name.padEnd(12)} ${cfg.auto ? '🤖 Auto' : '💬 Suggestion'}`);
    } catch (e) {
      moduleStatus.set(name, { ok: false, error: e.message, auto: cfg.auto });
      fail++;
      console.log(`  ❌ ${name.padEnd(12)} ${e.message}`);
    }
  }

  const elapsed = ((Date.now() - initStartTime) / 1000).toFixed(1);
  console.log('═'.repeat(55));
  console.log(`✅ ${ok}/${entries.length} modules chargés (${elapsed}s)`);
  if (fail > 0) console.log(`⚠️ ${fail} échec(s)`);
  console.log('═'.repeat(55) + '\n');
}

export function getModuleStatus(name) {
  return moduleStatus.get(name);
}

export function getAllStatus() {
  return Object.fromEntries(moduleStatus);
}

export default REGISTRY;

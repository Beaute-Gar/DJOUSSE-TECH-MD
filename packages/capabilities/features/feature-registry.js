import { createLogger } from '../../infrastructure/logger.js';
const log = createLogger('FEATURES');

const features = new Map();
let initializedSock = null;

export async function initAllFeatures(sock) {
  /* Idempotence : ne JAMAIS ré-attacher les listeners sur le même socket.
     L'événement 'open' se re-déclenche à chaque reconnexion (408/503) →
     sans ce garde, chaque cycle ajoute ~50 listeners messages.upsert
     → MaxListenersExceededWarning + doublons + fuite mémoire. */
  if (initializedSock === sock) return;
  initializedSock = sock;
  const owner = sock.user?.id?.replace(/:.*@/, '@');
  const apiKey = process.env.GROQ_API_KEY;

  const registry = [
    { name: 'currency-converter', fn: () => import('./currency-converter.js').then(m => m.enableCurrencyConverter(sock)) },
    { name: 'weather', fn: () => import('./weather.js').then(m => m.enableWeather(sock)) },
    { name: 'image-gen', fn: () => import('./image-gen.js').then(m => m.enableImageGen(sock)) },
    { name: 'data-analyzer', fn: () => import('./data-analyzer.js').then(m => m.enableDataAnalyzer(sock)) },
    { name: 'music-recognition', fn: () => apiKey ? import('./music-recognition.js').then(m => m.enableMusicRecognition(sock, apiKey)) : Promise.resolve() },
    { name: 'system-cleaner', fn: () => import('./system-cleaner.js').then(m => m.enableSystemCleaner(sock)) },
    { name: 'auto-updater', fn: () => import('./auto-updater.js').then(m => m.enableAutoUpdater(sock, owner)) },
    { name: 'smart-notifications', fn: () => import('./smart-notifications.js').then(m => m.enableSmartNotifications(sock, owner)) },
    { name: 'personalization', fn: () => import('./personalization.js').then(m => m.enablePersonalization(sock)) },
    { name: 'event-planner', fn: () => import('./event-planner.js').then(m => m.enableEventPlanner(sock)) },
    { name: 'birthday-reminder', fn: () => import('./birthday-reminder.js').then(m => m.enableBirthdayReminder(sock, owner)) },
    { name: 'poll-charts', fn: () => import('./poll-charts.js').then(m => m.enablePollCharts(sock)) },
    { name: 'secure-vault', fn: () => import('./secure-vault.js').then(m => m.enableSecureVault(sock)) },
    { name: 'auto-notes', fn: () => import('./auto-notes.js').then(m => m.enableAutoNotes(sock)) },
    { name: 'guestbook', fn: () => import('./guestbook.js').then(m => m.enableGuestbook(sock)) },
    { name: 'games', fn: () => import('./games.js').then(m => m.enableGames(sock)) },
    { name: 'adviser-mode', fn: () => import('./adviser-mode.js').then(m => m.enableAdviserMode(sock)) },
    { name: 'news-monitor', fn: () => import('./news-monitor.js').then(m => m.enableNewsMonitor(sock)) },
    { name: 'first-aid', fn: () => import('./first-aid.js').then(m => m.enableFirstAid(sock)) },
    { name: 'trainer-mode', fn: () => import('./trainer-mode.js').then(m => m.enableTrainerMode(sock)) },
    { name: 'advanced-voting', fn: () => import('./advanced-voting.js').then(m => m.enableAdvancedVoting(sock)) },
    { name: 'auto-minutes', fn: () => import('./auto-minutes.js').then(m => m.enableAutoMinutes(sock)) },
    { name: 'trello-sync', fn: () => import('./trello-sync.js').then(m => m.enableTrelloSync(sock)) },
    { name: 'meme-generator', fn: () => import('./meme-generator.js').then(m => m.enableMemeGenerator(sock)) },
    { name: 'voice-translator', fn: () => apiKey ? import('./voice-translator.js').then(m => m.enableVoiceTranslator(sock, apiKey)) : Promise.resolve() },
    { name: 'document-processor', fn: () => import('./document-processor.js').then(m => m.enableDocumentProcessor(sock)) },
    { name: 'video-processor', fn: () => import('./video-processor.js').then(m => m.enableVideoProcessor(sock)) },
    { name: 'geolocation', fn: () => import('./geolocation.js').then(m => m.enableGeolocation(sock)) },
    { name: 'social-poster', fn: () => import('./social-poster.js').then(m => m.enableSocialPoster(sock)) },
    { name: 'advanced-search', fn: () => import('./advanced-search.js').then(m => m.enableAdvancedSearch(sock)) },
    { name: 'code-interpreter', fn: () => import('./code-interpreter.js').then(m => m.enableCodeInterpreter(sock)) },
    { name: 'persona-engine', fn: () => import('./persona-engine.js').then(m => m.enablePersonaEngine(sock)) },
    { name: 'hubspot', fn: () => import('./hubspot.js').then(m => m.enableHubspot(sock)) },
    { name: 'dynamic-persona', fn: () => import('./dynamic-persona.js').then(m => m.enableDynamicPersona(sock)) },
    { name: 'comedy-voice', fn: () => import('./comedy-voice.js').then(m => m.enableComedyVoice(sock)) },
    { name: 'auto-weather-publish', fn: () => import('./auto-weather-publish.js').then(m => m.enableAutoWeatherPublish(sock)) },
    { name: 'activation-flow', fn: () => import('./activation-flow.js').then(m => m.enableActivationFlow(sock)) },
    { name: 'video-notes', fn: () => import('./video-notes.js').then(m => m.enableVideoNotes(sock)) },
    { name: 'disappearing-messages', fn: () => import('./disappearing-messages.js').then(m => m) },
    { name: 'channel-system', fn: () => import('./channel-features.js').then(m => { m.initChannelSystem(sock); return Promise.resolve(); }) },
    { name: 'labels', fn: () => import('./labels.js').then(m => m.enableLabelDetection(sock)) },
    { name: 'business-profile', fn: () => import('./business-profile.js').then(m => m.initBusinessProfile()) },
    { name: 'business-directory', fn: () => import('./business-directory.js').then(m => m.initBizDir()) },
    { name: 'private-welcome', fn: () => import('./private-welcome.js').then(m => m.enablePrivateWelcome(sock)) },
    { name: 'call-links', fn: () => import('./call-links.js').then(m => m.initCallLinks()) },
    { name: 'security-guide', fn: () => import('./security-guide.js').then(m => m.initSecurityGuide()) },
    { name: 'payment-links', fn: () => import('./payment-links.js').then(m => m.initPaymentLinks()) },
    { name: 'auto-fix', fn: () => import('./auto-fix.js').then(m => m.enableAutoFix(sock)) },
    { name: 'auto-fix-ultimate', fn: () => import('./auto-fix-ultimate.js').then(m => m.enableAutoFixUltimate(sock)) },
    { name: 'anti-sticker', fn: () => import('./anti-sticker.js').then(m => m.enableAntiSticker(sock)) },
    { name: 'anti-link', fn: () => import('./anti-link.js').then(m => m.enableAntiLink(sock)) },
    { name: 'personality-modes', fn: () => import('./personality-modes.js').then(m => m.enablePersonalityModes(sock)) },
    { name: 'chat-backup', fn: () => import('./chat-backup.js').then(m => m && m.enableChatBackup ? m.enableChatBackup(sock) : Promise.resolve()) },
    { name: 'daily-report', fn: () => import('./daily-report.js').then(m => m && m.enableDailyReport ? m.enableDailyReport(sock) : Promise.resolve()) },
    { name: 'fake-account-detector', fn: () => import('./fake-account-detector.js').then(m => m && m.enableFakeAccountDetector ? m.enableFakeAccountDetector(sock) : Promise.resolve()) },
    { name: 'ghost-reader', fn: () => import('./ghost-reader.js').then(m => m && m.enableGhostReader ? m.enableGhostReader(sock) : Promise.resolve()) },
    { name: 'hidden-pp', fn: () => import('./hidden-pp.js').then(m => m && m.enableHiddenPp ? m.enableHiddenPp(sock) : Promise.resolve()) },
    { name: 'silent-message', fn: () => import('./silent-message.js').then(m => m && m.enableSilentMessage ? m.enableSilentMessage(sock) : Promise.resolve()) },
    { name: 'word-alert', fn: () => import('./word-alert.js').then(m => m && m.enableWordAlert ? m.enableWordAlert(sock) : Promise.resolve()) },
    { name: 'common-groups', fn: () => import('./common-groups.js').then(m => m && m.enableCommonGroups ? m.enableCommonGroups(sock) : Promise.resolve()) },
    { name: 'google-sheets-export', fn: () => import('./google-sheets-export.js').then(m => m && m.enableGoogleSheetsExport ? m.enableGoogleSheetsExport(sock) : Promise.resolve()) },
    { name: 'google-tasks-sync', fn: () => import('./google-tasks-sync.js').then(m => m && m.enableGoogleTasksSync ? m.enableGoogleTasksSync(sock) : Promise.resolve()) },
    { name: 'media-downloader', fn: () => import('./media-downloader.js').then(m => m && m.enableMediaDownloader ? m.enableMediaDownloader(sock) : Promise.resolve()) },
    { name: 'mode-ne-pas-deranger', fn: () => import('./mode-ne-pas-deranger.js').then(m => m && m.enableDND ? m.enableDND(sock) : Promise.resolve()) },
    { name: 'multi-broadcast', fn: () => import('./multi-broadcast.js').then(m => m && m.enableMultiBroadcast ? m.enableMultiBroadcast(sock) : Promise.resolve()) },
    { name: 'multi-session', fn: () => import('./multi-session.js').then(m => m && m.enableMultiSession ? m.enableMultiSession(sock) : Promise.resolve()) },
    { name: 'voice-cloning', fn: () => import('./voice-cloning.js').then(m => m && m.enableVoiceCloning ? m.enableVoiceCloning(sock) : Promise.resolve()) },

    /* ── Queen Akuma absorbed features ── */
    { name: 'anti-vv', fn: () => import('./anti-vv.js').then(m => m.enableAntiVV(sock)) },
    { name: 'anti-spam', fn: () => import('./anti-spam.js').then(m => m.enableAntiSpam(sock)) },
    { name: 'anti-call', fn: () => import('./anti-call.js').then(m => m.enableAntiCall(sock)) },
    { name: 'auto-welcome', fn: () => process.env.AUTO_WELCOME === 'true' ? import('./auto-welcome.js').then(m => m.enableAutoWelcome(sock)) : Promise.resolve() },
    { name: 'auto-goodbye', fn: () => process.env.AUTO_GOODBYE === 'true' ? import('./auto-goodbye.js').then(m => m.enableAutoGoodbye(sock)) : Promise.resolve() },
    { name: 'auto-status-save', fn: () => import('./auto-status-save.js').then(m => (process.env.AUTO_STATUS_SAVE === 'true' ? m.enableAutoStatusSave(sock, owner) : Promise.resolve())) },
    { name: 'log-rotator', fn: () => import('./log-rotator.js').then(m => m.enableLogRotator(sock)) },
    { name: 'bio-updater', fn: () => import('./bio-updater.js').then(m => m.enableBioUpdater(sock)) },
    { name: 'heartbeat', fn: () => import('./heartbeat.js').then(m => m.enableHeartbeat(sock)) },
    { name: 'token-refresher', fn: () => import('./token-refresher.js').then(m => m.enableTokenRefresher(sock)) },
    { name: 'auto-warn', fn: () => import('./auto-warn.js').then(m => m.enableAutoWarn(sock)) },
    { name: 'auto-kick', fn: () => import('./auto-kick.js').then(m => m.enableAutoKick(sock)) },
    { name: 'auto-delete-old', fn: () => import('./auto-delete-old.js').then(m => m.enableAutoDeleteOld(sock)) },
    { name: 'auto-mode', fn: () => import('./auto-mode.js').then(m => m.enableAutoMode(sock)) },
    { name: 'auto-reply-mention', fn: () => import('./auto-reply-mention.js').then(m => m.enableAutoReplyMention(sock)) },
    { name: 'auto-save-media', fn: () => import('./auto-save-media.js').then(m => (process.env.AUTO_SAVE_MEDIA === 'true' ? m.enableAutoSaveMedia(sock, owner) : Promise.resolve())) },
    { name: 'auto-sticker', fn: () => import('./auto-sticker.js').then(m => m.enableAutoSticker(sock)) },
  ];

  const results = await Promise.allSettled(registry.map(async (item) => {
    try {
      await item.fn();
      features.set(item.name, true);
      return { name: item.name, ok: true };
    } catch (e) {
      log.warn(`${item.name}: ${e.message}`);
      features.set(item.name, false);
      return { name: item.name, ok: false, error: e.message };
    }
  }));

  const ok = results.filter(r => r.value?.ok).length;
  const fail = results.filter(r => !r.value?.ok).length;
  log.info(`Features: ${ok} OK, ${fail} echecs`);
}

export function isFeatureOn(name) {
  return features.get(name) === true;
}

export function getFeatureStatus() {
  return Object.fromEntries(features);
}

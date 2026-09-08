export const ABSORBED_COMMANDS = {
  enabled: true,
  dailyLimits: {
    song: 5, tt: 5, fb: 3, video: 5, ig: 5,
    imagine: 10, enhance: 5, speak: 10, style: 10,
    sticker: 20, upload: 5, save: 10,
    broadcast: 5, invite: 5, whois: 5,
    vcf: 3, join: 3, creategroup: 1
  },
  autoFeatures: {
    anti_spam: true,
    anti_link: true,
    anti_sticker: true,
    anti_delete: true,
    anti_call: true,
    auto_welcome: true,
    auto_goodbye: true,
    auto_status_save: false,
    auto_warn: true,
    auto_kick: true,
    auto_delete_old: false,
    auto_mode: false,
    auto_save_media: false,
    auto_sticker: false
  },
  safety: {
    randomDelay: { min: 2000, max: 5000 },
    simulationHumaine: true,
    silentMode: true
  }
};

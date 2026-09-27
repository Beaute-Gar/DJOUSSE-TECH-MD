// ===== DJOUSSE TECH — Configuration =====
// Variables d'environnement Supabase
// NE JAMAIS exposer le SECRET_KEY côté client

const CONFIG = {
  supabase: {
    url: 'https://tifyhwyugquvqikupjxa.supabase.co',
    publishableKey: 'sb_publishable_SL6P6PSoNBcVDIZE0NyXew_Phj_MP6G',
  },
  app: {
    name: 'DJOUSSE TECH',
    owner: 'Djousse Uriel',
    ownerNumber: '237693978044',
    prefix: '.',
    currency: 'XAF',
    currencySymbol: 'F',
  },
  plans: {
    free: {
      name: 'Gratuit',
      price: 0,
      duration: null,
      features: {
        customName: false,
        customImage: false,
        customChannel: false,
        priority: false,
      }
    },
    premium: {
      name: 'Premium',
      price: 2500,
      duration: 7, // jours
      features: {
        customName: true,
        customImage: true,
        customChannel: true,
        priority: true,
      }
    },
    pro: {
      name: 'Pro',
      price: 5000,
      duration: 30, // jours
      features: {
        customName: true,
        customImage: true,
        customChannel: true,
        priority: true,
      }
    }
  }
};

// Export pour utilisation dans les autres scripts
if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
}

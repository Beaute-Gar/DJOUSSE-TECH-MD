// ===== DJOUSSE TECH — Configuration =====
const CONFIG = {
  supabase: {
    url: 'https://tifyhwyugquvqikupjxa.supabase.co',
    anonKey: 'sb_publishable_SL6P6PSoNBcVDIZE0NyXew_Phj_MP6G',
  },
  app: {
    name: 'DJOUSSE TECH',
    owner: 'Beaute Gar',
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

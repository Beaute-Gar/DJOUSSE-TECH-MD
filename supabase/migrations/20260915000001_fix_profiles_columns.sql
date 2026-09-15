-- =============================================
-- DJOUSSE TECH — Fix schema: ajouter colonnes manquantes
-- =============================================

-- Ajouter les colonnes manquantes à profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Vérifier si la contrainte CHECK existe déjà avant de l'ajouter
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_plan_check'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_plan_check CHECK (plan IN ('free', 'premium', 'pro'));
  END IF;
END $$;

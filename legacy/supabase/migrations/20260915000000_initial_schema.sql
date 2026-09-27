-- =============================================
-- DJOUSSE TECH — Schéma Supabase
-- Migration initiale
-- =============================================

-- 1. Table des profils utilisateurs
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  avatar_url TEXT DEFAULT NULL,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium', 'pro')),
  plan_expires_at TIMESTAMPTZ DEFAULT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Table des bots (instances WhatsApp)
CREATE TABLE IF NOT EXISTS bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bot_name TEXT NOT NULL DEFAULT 'DJOUSSE TECH',
  bot_image TEXT DEFAULT NULL,
  session_id TEXT DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'connecting', 'error')),
  phone_number TEXT DEFAULT NULL,
  group_name TEXT DEFAULT NULL,
  messages_today INTEGER NOT NULL DEFAULT 0,
  members_count INTEGER NOT NULL DEFAULT 0,
  commands_used INTEGER NOT NULL DEFAULT 0,
  is_public BOOLEAN NOT NULL DEFAULT true,
  prefix TEXT NOT NULL DEFAULT '.',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Table des sessions bot (QR codes / pairing)
CREATE TABLE IF NOT EXISTS bot_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  qr_code TEXT DEFAULT NULL,
  pairing_code TEXT DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'scanned', 'connected', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes')
);

-- 4. Table des logs d'activité
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bot_id UUID REFERENCES bots(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Table des paiements
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('premium', 'pro')),
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  method TEXT NOT NULL DEFAULT 'mobile_money',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  transaction_id TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Table des stats quotidiennes
CREATE TABLE IF NOT EXISTS daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  messages_count INTEGER NOT NULL DEFAULT 0,
  commands_count INTEGER NOT NULL DEFAULT 0,
  new_members INTEGER NOT NULL DEFAULT 0,
  UNIQUE(bot_id, date)
);

-- ===== INDEX =====
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_bots_user_id ON bots(user_id);
CREATE INDEX IF NOT EXISTS idx_bots_status ON bots(status);
CREATE INDEX IF NOT EXISTS idx_bot_sessions_bot_id ON bot_sessions(bot_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_stats_bot_id ON daily_stats(bot_id);

-- ===== RLS (Row Level Security) =====
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;

-- Profiles: les users voient leur propre profil
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Bots: les users voient/gèrent leurs propres bots
CREATE POLICY "Users can view own bots" ON bots
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bots" ON bots
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bots" ON bots
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bots" ON bots
  FOR DELETE USING (auth.uid() = user_id);

-- Bot sessions
CREATE POLICY "Users can view own bot sessions" ON bot_sessions
  FOR SELECT USING (
    bot_id IN (SELECT id FROM bots WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage own bot sessions" ON bot_sessions
  FOR ALL USING (
    bot_id IN (SELECT id FROM bots WHERE user_id = auth.uid())
  );

-- Activity logs
CREATE POLICY "Users can view own logs" ON activity_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own logs" ON activity_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Payments
CREATE POLICY "Users can view own payments" ON payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payments" ON payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Daily stats
CREATE POLICY "Users can view own bot stats" ON daily_stats
  FOR SELECT USING (
    bot_id IN (SELECT id FROM bots WHERE user_id = auth.uid())
  );

-- ===== ADMIN POLICIES =====
-- Admins can do everything

CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can delete all profiles" ON profiles
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can view all bots" ON bots
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can delete all bots" ON bots
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can view all logs" ON activity_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can view all payments" ON payments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can update all payments" ON payments
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ===== FONCTIONS =====

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER update_bots_updated_at
  BEFORE UPDATE ON bots
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

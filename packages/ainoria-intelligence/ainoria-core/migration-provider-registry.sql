-- migration-provider-registry.sql

CREATE TABLE IF NOT EXISTS ainoria_providers (
  nom TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  api_key_env TEXT,
  actif INTEGER DEFAULT 1,
  priorite INTEGER DEFAULT 5,
  cree_le INTEGER,
  maj_le INTEGER
);

CREATE TABLE IF NOT EXISTS ainoria_modeles (
  id TEXT PRIMARY KEY,
  provider_nom TEXT NOT NULL,
  nom_modele TEXT NOT NULL,
  capacites TEXT NOT NULL,
  cout_prompt_1k REAL DEFAULT 0,
  cout_completion_1k REAL DEFAULT 0,
  contexte_max INTEGER DEFAULT 4096,
  actif INTEGER DEFAULT 1,
  FOREIGN KEY (provider_nom) REFERENCES ainoria_providers(nom)
);

CREATE TABLE IF NOT EXISTS ainoria_metriques_modeles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  modele_id TEXT NOT NULL,
  latence_ms INTEGER,
  tokens_prompt INTEGER,
  tokens_completion INTEGER,
  succes INTEGER DEFAULT 1,
  erreur TEXT,
  cree_le INTEGER
);
CREATE INDEX IF NOT EXISTS idx_metriques_modele ON ainoria_metriques_modeles(modele_id, cree_le);

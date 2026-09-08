-- AINORIA Core — Migration v1.0
-- Tables pour le noyau AINORIA (mémoire, outils, plans, agents, permissions, automatisations)

CREATE TABLE IF NOT EXISTS ainoria_memories (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  jid           TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'general',
  content       TEXT NOT NULL,
  embedding     TEXT,
  created_at    INTEGER NOT NULL,
  last_accessed INTEGER NOT NULL DEFAULT 0,
  access_count  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_ainoria_memories_jid ON ainoria_memories(jid);
CREATE INDEX IF NOT EXISTS idx_ainoria_memories_type ON ainoria_memories(type);
CREATE INDEX IF NOT EXISTS idx_ainoria_memories_created ON ainoria_memories(created_at);

CREATE TABLE IF NOT EXISTS ainoria_user_preferences (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  jid         TEXT NOT NULL,
  key         TEXT NOT NULL,
  value       TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  UNIQUE(jid, key)
);

CREATE TABLE IF NOT EXISTS ainoria_project_memories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  jid         TEXT NOT NULL,
  project_id  TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'note',
  content     TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ainoria_project_memories ON ainoria_project_memories(jid, project_id);

CREATE TABLE IF NOT EXISTS ainoria_permissions (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  agent                 TEXT NOT NULL,
  permission            TEXT NOT NULL,
  granted               INTEGER NOT NULL DEFAULT 1,
  requires_confirmation INTEGER NOT NULL DEFAULT 0,
  created_at            INTEGER NOT NULL,
  UNIQUE(agent, permission)
);

CREATE TABLE IF NOT EXISTS ainoria_tool_executions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tool        TEXT NOT NULL,
  params      TEXT,
  result      TEXT,
  duration    INTEGER,
  error       TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ainoria_tool_executions ON ainoria_tool_executions(tool, created_at);

CREATE TABLE IF NOT EXISTS ainoria_plans (
  id          TEXT PRIMARY KEY,
  goal        TEXT NOT NULL,
  steps       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active',
  error       TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ainoria_plans_status ON ainoria_plans(status);

CREATE TABLE IF NOT EXISTS ainoria_automations (
  id            TEXT PRIMARY KEY,
  trigger_type  TEXT NOT NULL,
  trigger_config TEXT NOT NULL,
  action_type   TEXT NOT NULL,
  action_config TEXT NOT NULL,
  jid           TEXT,
  enabled       INTEGER NOT NULL DEFAULT 1,
  created_at    INTEGER NOT NULL
);

-- Vue stats mémoire
CREATE VIEW IF NOT EXISTS ainoria_memory_stats AS
SELECT jid, type, COUNT(*) as count, MAX(created_at) as last_entry
FROM ainoria_memories
GROUP BY jid, type;

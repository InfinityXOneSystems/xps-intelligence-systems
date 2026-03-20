-- XPS Intelligence Systems - Unified Database Schema
-- Version: 1.0.0

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =========================================
-- IDENTITY & AUTH
-- =========================================
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supabase_uid  TEXT UNIQUE,
  email         TEXT UNIQUE NOT NULL,
  full_name     TEXT,
  role          TEXT NOT NULL DEFAULT 'employee'
                  CHECK (role IN ('employee','sales_staff','manager','owner','admin')),
  is_active     BOOLEAN DEFAULT TRUE,
  avatar_url    TEXT,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS locations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  city          TEXT,
  state         TEXT,
  zip           TEXT,
  phone         TEXT,
  owner_id      UUID REFERENCES users(id),
  is_active     BOOLEAN DEFAULT TRUE,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Add location_id FK after locations table exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id);

-- =========================================
-- CRM - LEADS
-- =========================================
CREATE TABLE IF NOT EXISTS leads (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name    TEXT NOT NULL,
  contact_name    TEXT,
  email           TEXT,
  phone           TEXT,
  website         TEXT,
  vertical        TEXT,
  location        TEXT,
  city            TEXT,
  state           TEXT,
  stage           TEXT NOT NULL DEFAULT 'Prospecting'
                    CHECK (stage IN ('Prospecting','Qualified','Proposal','Negotiation','Closed Won','Closed Lost')),
  score           INTEGER CHECK (score >= 0 AND score <= 100),
  estimated_value NUMERIC(12,2),
  source          TEXT DEFAULT 'manual',
  assigned_to     UUID REFERENCES users(id),
  location_id     UUID REFERENCES locations(id),
  created_by      UUID REFERENCES users(id),
  notes           TEXT,
  metadata        JSONB DEFAULT '{}',
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS leads_stage_idx ON leads(stage) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS leads_score_idx ON leads(score DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS leads_assigned_idx ON leads(assigned_to) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS leads_location_idx ON leads(location_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS leads_email_idx ON leads(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS leads_search_idx ON leads USING gin(to_tsvector('english', company_name || ' ' || COALESCE(contact_name,'')));
-- Extended RAG search index: covers vertical and notes for intelligence queries
CREATE INDEX IF NOT EXISTS leads_rag_idx ON leads USING gin(
  to_tsvector('english',
    company_name || ' ' ||
    COALESCE(contact_name, '') || ' ' ||
    COALESCE(vertical, '') || ' ' ||
    COALESCE(notes, '')
  )
) WHERE deleted_at IS NULL;

-- =========================================
-- CRM - ACTIVITIES & OUTREACH
-- =========================================
CREATE TABLE IF NOT EXISTS activities (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id       UUID REFERENCES leads(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id),
  type          TEXT NOT NULL CHECK (type IN ('call','email','meeting','note','task','proposal','demo')),
  subject       TEXT,
  body          TEXT,
  scheduled_at  TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('email','sms','mixed')),
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','completed')),
  template_id   UUID,
  created_by    UUID REFERENCES users(id),
  location_id   UUID REFERENCES locations(id),
  settings      JSONB DEFAULT '{}',
  sent_count    INTEGER DEFAULT 0,
  open_count    INTEGER DEFAULT 0,
  click_count   INTEGER DEFAULT 0,
  reply_count   INTEGER DEFAULT 0,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_leads (
  campaign_id   UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id       UUID REFERENCES leads(id) ON DELETE CASCADE,
  status        TEXT DEFAULT 'pending',
  sent_at       TIMESTAMPTZ,
  opened_at     TIMESTAMPTZ,
  clicked_at    TIMESTAMPTZ,
  replied_at    TIMESTAMPTZ,
  PRIMARY KEY (campaign_id, lead_id)
);

CREATE TABLE IF NOT EXISTS outreach_templates (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('email','sms','call_script')),
  subject       TEXT,
  body          TEXT NOT NULL,
  variables     JSONB DEFAULT '[]',
  created_by    UUID REFERENCES users(id),
  location_id   UUID REFERENCES locations(id),
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================
-- PROPOSALS
-- =========================================
CREATE TABLE IF NOT EXISTS proposals (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id       UUID REFERENCES leads(id),
  created_by    UUID REFERENCES users(id),
  title         TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','sent','viewed','accepted','rejected','expired')),
  total_value   NUMERIC(12,2),
  line_items    JSONB DEFAULT '[]',
  notes         TEXT,
  sent_at       TIMESTAMPTZ,
  viewed_at     TIMESTAMPTZ,
  decided_at    TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================
-- INTELLIGENCE & SCRAPING
-- =========================================
CREATE TABLE IF NOT EXISTS agent_tasks (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued','running','completed','failed','cancelled')),
  created_by    UUID REFERENCES users(id),
  workflow_id   UUID,
  payload       JSONB DEFAULT '{}',
  result        JSONB,
  error         TEXT,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_tasks_status_idx ON agent_tasks(status);
CREATE INDEX IF NOT EXISTS agent_tasks_type_idx ON agent_tasks(type);

CREATE TABLE IF NOT EXISTS agent_workflows (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  description   TEXT,
  trigger       TEXT NOT NULL CHECK (trigger IN ('manual','schedule','webhook','lead_created','lead_updated')),
  steps         JSONB NOT NULL DEFAULT '[]',
  is_active     BOOLEAN DEFAULT TRUE,
  created_by    UUID REFERENCES users(id),
  run_count     INTEGER DEFAULT 0,
  last_run_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scrape_results (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id       UUID REFERENCES agent_tasks(id),
  url           TEXT,
  company_name  TEXT,
  raw_content   TEXT,
  extracted     JSONB DEFAULT '{}',
  leads_created INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================
-- VECTOR / KNOWLEDGE
-- =========================================
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         TEXT NOT NULL,
  content       TEXT NOT NULL,
  source        TEXT,
  category      TEXT,
  tags          TEXT[],
  embedding     JSONB,
  created_by    UUID REFERENCES users(id),
  is_public     BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS knowledge_search_idx ON knowledge_documents USING gin(to_tsvector('english', title || ' ' || content));

-- =========================================
-- AUDIT
-- =========================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES users(id),
  action        TEXT NOT NULL,
  resource_type TEXT,
  resource_id   TEXT,
  details       JSONB DEFAULT '{}',
  ip_address    TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_user_idx ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs(action);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs(created_at DESC);

-- =========================================
-- CONNECTORS / INTEGRATIONS
-- =========================================
CREATE TABLE IF NOT EXISTS connectors (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  type          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','configured','connected','degraded','disabled')),
  config        JSONB DEFAULT '{}',
  credentials   JSONB DEFAULT '{}',
  location_id   UUID REFERENCES locations(id),
  created_by    UUID REFERENCES users(id),
  last_sync_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================
-- TRIGGERS - auto update updated_at
-- =========================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['users','locations','leads','campaigns','outreach_templates','proposals','agent_workflows','knowledge_documents','connectors'])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t);
  END LOOP;
END $$;

-- =========================================
-- SCRAPER RESULTS - Extended
-- =========================================
CREATE TABLE IF NOT EXISTS scraped_leads (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id           UUID REFERENCES agent_tasks(id),
  business_name     TEXT NOT NULL,
  address           TEXT,
  city              TEXT,
  state             TEXT,
  zip               TEXT,
  phone             TEXT,
  website           TEXT,
  owner_name        TEXT,
  additional_phone  TEXT,
  email             TEXT,
  est_employees     TEXT,
  est_annual_revenue TEXT,
  years_in_business TEXT,
  google_rating     NUMERIC(3,1),
  facebook_url      TEXT,
  linkedin_url      TEXT,
  instagram_url     TEXT,
  industry          TEXT,
  specialty         TEXT,
  keywords          TEXT,
  score             INTEGER CHECK (score >= 0 AND score <= 100),
  ai_summary        TEXT,
  ai_recommendations TEXT,
  initial_contact_date DATE,
  follow_up_date    DATE,
  scraped_date      DATE DEFAULT CURRENT_DATE,
  notes             TEXT,
  added_to_crm      BOOLEAN DEFAULT FALSE,
  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================
-- INDUSTRY INTELLIGENCE - XPS Taxonomy
-- =========================================
CREATE TABLE IF NOT EXISTS xps_taxonomy (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category        TEXT NOT NULL,  -- 'product', 'technique', 'equipment', 'chemical', 'market_segment'
  name            TEXT NOT NULL,
  aliases         TEXT[],
  description     TEXT,
  parent_id       UUID REFERENCES xps_taxonomy(id),
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS xps_knowledge_base (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,
  category        TEXT,  -- 'product_info', 'technique', 'sales_playbook', 'competitor', 'industry_news'
  source          TEXT,
  tags            TEXT[],
  relevance_score NUMERIC(5,2) DEFAULT 0,
  view_count      INTEGER DEFAULT 0,
  created_by      UUID REFERENCES users(id),
  is_public       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS xps_distillation_queue (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_url      TEXT,
  source_type     TEXT,  -- 'website', 'pdf', 'manual', 'scraper'
  content         TEXT,
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  processed_at    TIMESTAMPTZ,
  knowledge_ids   UUID[],
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================
-- USER PROFILES - Extended
-- =========================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS territory TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS specialty TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS division TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS business_card JSONB DEFAULT '{}';

-- =========================================
-- AI CALLS & SMS LOG
-- =========================================
CREATE TABLE IF NOT EXISTS communication_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id         UUID REFERENCES leads(id),
  user_id         UUID REFERENCES users(id),
  type            TEXT NOT NULL CHECK (type IN ('email','sms','call','ai_call')),
  direction       TEXT CHECK (direction IN ('outbound','inbound')),
  status          TEXT DEFAULT 'pending',
  content         TEXT,
  ai_generated    BOOLEAN DEFAULT FALSE,
  provider        TEXT,
  external_id     TEXT,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================
-- TELEMETRY & OPTIMIZATION
-- =========================================
CREATE TABLE IF NOT EXISTS telemetry_events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id    TEXT,
  user_id       UUID REFERENCES users(id),
  event_type    TEXT NOT NULL,
  resource_type TEXT,
  resource_id   TEXT,
  details       JSONB DEFAULT '{}',
  duration_ms   INTEGER,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_event_type ON telemetry_events (event_type);
CREATE INDEX IF NOT EXISTS idx_telemetry_created    ON telemetry_events (created_at);

CREATE TABLE IF NOT EXISTS optimization_reports (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_at           TIMESTAMPTZ DEFAULT NOW(),
  efficiency_score NUMERIC(4,2),
  friction_score   NUMERIC(4,2),
  bottlenecks      JSONB DEFAULT '[]',
  recommendations  JSONB DEFAULT '[]',
  simulation       JSONB DEFAULT '{}',
  raw_report       JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

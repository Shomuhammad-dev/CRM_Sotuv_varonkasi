CREATE TABLE IF NOT EXISTS users (
  id               SERIAL PRIMARY KEY,
  role             VARCHAR(10) NOT NULL CHECK (role IN ('admin', 'operator')),
  operator_number  INT NOT NULL UNIQUE, -- 0 = admin, 1..7 = operator
  username         VARCHAR(50) NOT NULL,
  password_hash    VARCHAR(255) NOT NULL,
  display_name     VARCHAR(100) NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

CREATE TABLE IF NOT EXISTS leads (
  id                     SERIAL PRIMARY KEY,
  stage                  VARCHAR(20) NOT NULL DEFAULT 'new'
                           CHECK (stage IN ('new', 'contacted', 'invited', 'won', 'lost')),
  district               VARCHAR(100),
  full_name              VARCHAR(150) NOT NULL,
  school                 VARCHAR(150),
  grade                  VARCHAR(10),
  sector                 VARCHAR(20),
  future_profession      VARCHAR(150),
  subjects               TEXT[] NOT NULL DEFAULT '{}',
  prev_center            VARCHAR(200),
  notes                  TEXT,
  phone_personal         VARCHAR(30),
  phone_father           VARCHAR(30),
  phone_mother           VARCHAR(30),
  assigned_operator_id   INT REFERENCES users(id) ON DELETE SET NULL,
  created_by             INT REFERENCES users(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_operator_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);

-- izoh_2/3/4 (superseded by lead_comments below) — drop if a prior local
-- migration created them, since fresh installs never gained them.
ALTER TABLE leads DROP COLUMN IF EXISTS izoh_2;
ALTER TABLE leads DROP COLUMN IF EXISTS izoh_3;
ALTER TABLE leads DROP COLUMN IF EXISTS izoh_4;

-- Har safar lid bosqichi o'zgarganda bitta yozuv qo'shiladi — Reja
-- (Kunlik/Haftalik/Oylik) hisobotlari shu jadvaldan hisoblanadi.
CREATE TABLE IF NOT EXISTS lead_stage_history (
  id            SERIAL PRIMARY KEY,
  lead_id       INT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  operator_id   INT REFERENCES users(id) ON DELETE SET NULL, -- o'zgarish vaqtidagi biriktirilgan operator
  from_stage    VARCHAR(20),
  to_stage      VARCHAR(20) NOT NULL,
  changed_by    INT REFERENCES users(id) ON DELETE SET NULL,
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stage_history_operator_time ON lead_stage_history(operator_id, changed_at);
CREATE INDEX IF NOT EXISTS idx_stage_history_lead ON lead_stage_history(lead_id);

-- AMO CRM-uslubidagi izohlar tarixi — hech qachon o'chirilmaydi yoki
-- ustidan yozilmaydi, faqat qo'shiladi. `leads.notes` ustuniga tegilmaydi.
CREATE TABLE IF NOT EXISTS lead_comments (
  id          SERIAL PRIMARY KEY,
  lead_id     INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  operator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  text        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_comments_lead_id ON lead_comments(lead_id);

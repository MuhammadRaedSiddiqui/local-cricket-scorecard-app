CREATE TABLE users (
  id text PRIMARY KEY,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  email text NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash text NOT NULL CHECK (length(password_hash) > 0),
  avatar text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE matches (
  id text PRIMARY KEY,
  match_code text NOT NULL UNIQUE,
  created_by text NOT NULL REFERENCES users(id),
  status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'completed')),
  start_time timestamptz NOT NULL,
  venue text NOT NULL,
  overs integer NOT NULL CHECK (overs > 0),
  is_private boolean NOT NULL DEFAULT false,
  scorecard jsonb NOT NULL CHECK (jsonb_typeof(scorecard) = 'object'),
  version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE match_members (
  match_id text NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'scorer', 'viewer')),
  PRIMARY KEY (match_id, user_id, role)
);

CREATE INDEX matches_creator_created_idx ON matches(created_by, created_at DESC);
CREATE INDEX matches_status_idx ON matches(status);
CREATE INDEX match_members_user_idx ON match_members(user_id, match_id);

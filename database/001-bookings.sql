BEGIN;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY,
  apartment text NOT NULL CHECK (apartment IN ('relajate','downtown')),
  arrival date NOT NULL,
  departure date NOT NULL,
  guests integer NOT NULL CHECK (guests BETWEEN 1 AND 4),
  total_cents integer NOT NULL CHECK(total_cents > 0),
  deposit_cents integer NOT NULL CHECK(deposit_cents * 5 = total_cents),
  token_hash text NOT NULL,
  status text NOT NULL DEFAULT 'held' CHECK(status IN ('held','confirmed','expired')),
  session_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  CHECK(departure-arrival BETWEEN 3 AND 90),
  CHECK(apartment <> 'downtown' OR guests <= 2),
  EXCLUDE USING gist (apartment WITH =, daterange(arrival, departure, '[)') WITH &&) WHERE (status IN ('held','confirmed'))
);
COMMIT;
-- Holds are released ONLY after Stripe confirms session expiration, never by local time alone.

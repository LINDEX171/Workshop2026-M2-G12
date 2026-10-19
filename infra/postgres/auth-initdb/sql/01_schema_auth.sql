-- =====================================================================
-- Schéma d'authentification — base `authdb` (service auth-db)
-- Base dédiée, sur un réseau interne joignable uniquement par `auth`.
-- Variables psql : :dbname, :authuser_pw (fournies par 01_init_auth.sh)
-- =====================================================================

CREATE ROLE authuser LOGIN PASSWORD :'authuser_pw';

REVOKE ALL ON DATABASE :"dbname" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"dbname" TO authuser;

CREATE SCHEMA auth;
REVOKE ALL ON SCHEMA auth FROM PUBLIC;
GRANT USAGE ON SCHEMA auth TO authuser;

CREATE TABLE auth.users (
    id            SERIAL PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('operator', 'admin', 'viewer'))
);

-- SELECT pour le login, INSERT pour le seed de l'opérateur au démarrage
GRANT SELECT, INSERT ON auth.users TO authuser;
GRANT USAGE ON SEQUENCE auth.users_id_seq TO authuser;

ALTER ROLE authuser SET search_path = auth;

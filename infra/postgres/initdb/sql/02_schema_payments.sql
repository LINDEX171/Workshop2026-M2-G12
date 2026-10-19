-- =====================================================================
-- Schéma des paiements — base `payments` (service db, réseau data)
-- Variables psql : :dbname, :payuser_pw (fournies par 01_init_payments.sh)
-- Moindre privilège : payuser n'a de droits que sur le schéma payments,
-- ne peut modifier que le solde des comptes et ne peut jamais supprimer
-- ni modifier une transaction (journal append-only).
-- =====================================================================

CREATE ROLE payuser LOGIN PASSWORD :'payuser_pw';

REVOKE ALL ON DATABASE :"dbname" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"dbname" TO payuser;

CREATE SCHEMA payments;
REVOKE ALL ON SCHEMA payments FROM PUBLIC;
GRANT USAGE ON SCHEMA payments TO payuser;

CREATE TABLE payments.accounts (
    id      SERIAL PRIMARY KEY,
    owner   TEXT           NOT NULL,
    balance NUMERIC(12, 2) NOT NULL CHECK (balance >= 0)
);

CREATE TABLE payments.transactions (
    id         BIGSERIAL PRIMARY KEY,
    src        INTEGER        NOT NULL REFERENCES payments.accounts (id),
    dst        INTEGER        NOT NULL REFERENCES payments.accounts (id),
    amount     NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    status     TEXT           NOT NULL CHECK (status IN ('accepted', 'rejected')),
    created_at TIMESTAMPTZ    NOT NULL DEFAULT now(),
    CHECK (src <> dst)
);
CREATE INDEX transactions_created_at_idx ON payments.transactions (created_at DESC);

GRANT SELECT, UPDATE (balance) ON payments.accounts TO payuser;
GRANT SELECT, INSERT ON payments.transactions TO payuser;
GRANT USAGE ON SEQUENCE payments.transactions_id_seq TO payuser;

ALTER ROLE payuser SET search_path = payments;

-- Comptes de démonstration
INSERT INTO payments.accounts (owner, balance) VALUES
    ('Alice',   1000.00),
    ('Bob',      500.00),
    ('Charlie',  250.00);

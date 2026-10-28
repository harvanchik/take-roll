-- Preserve pre-provider account keys without embedding any account's identity in source.
CREATE TABLE native_account_aliases (
 email TEXT PRIMARY KEY NOT NULL,
 account_id TEXT NOT NULL UNIQUE,
 subject TEXT UNIQUE
);

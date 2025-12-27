CREATE TABLE wallets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    wallet_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    
    CONSTRAINT unique_wallet_id UNIQUE (wallet_id)
);

-- Create index on wallet_id for faster lookups
CREATE INDEX idx_wallets_wallet_id ON wallets(wallet_id);

-- Create index on created_at for sorting
CREATE INDEX idx_wallets_created_at ON wallets(created_at);
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

-- Wallet addresses table (many addresses per wallet)
CREATE TABLE wallet_addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_id TEXT NOT NULL,
    address TEXT NOT NULL,
    chain TEXT NOT NULL,
    derivation_path TEXT NOT NULL,
    created_at TEXT NOT NULL,

    -- Foreign key constraint
    CONSTRAINT fk_wallet_addresses_wallet_id
        FOREIGN KEY (wallet_id)
        REFERENCES wallets (wallet_id)
        ON DELETE CASCADE,

    -- Prevent duplicate addresses per wallet
    CONSTRAINT unique_wallet_address
        UNIQUE (wallet_id, address, chain)
);

-- Index for fast lookups by wallet
CREATE INDEX idx_wallet_addresses_wallet_id ON wallet_addresses(wallet_id);

-- Index for fast lookups by address (for balance queries)
CREATE INDEX idx_wallet_addresses_address ON wallet_addresses(address);
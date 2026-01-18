use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct AddressBalance {
    pub address: String,
    pub chain: String,
    pub balance: String,
    pub symbol: String,
    pub timestamp: String,
}
#[derive(Debug, Clone, Serialize)]
pub struct WalletBalanceResponse {
    pub wallet_id: String,
    pub balances: Vec<AddressBalance>,
}

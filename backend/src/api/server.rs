// server.rs structure
pub struct ServerConfig {
    pub host: String,             // "0.0.0.0" or "127.0.0.1"
    pub port: u16,                // 8080, 3000, etc.
    pub request_timeout: u64,     // seconds
    pub environment: Environment, // Dev vs Prod
}

#[derive(Debug, Clone)]
pub enum Environment {
    Development,
    Production,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            host: "127.0.0.1".to_string(),  // Localhost only by default (secure)
            port: 8080,
            request_timeout: 30,            // 30 seconds
            environment: Environment::Development,
        }
    }
}
pub fn create_app() -> Router { /* build routes */
}
pub async fn start_server(config) { /* run server */ }

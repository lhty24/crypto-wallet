use crate::api::wallet;
use crate::database::{init_database, DbPool};
use anyhow::{Context, Result};
use axum::extract::State;
use axum::{
    http::{self, HeaderValue},
    routing::{delete, get, post, put},
    Router,
};
use tower_http::{cors::CorsLayer, limit::RequestBodyLimitLayer, trace::TraceLayer};

/// Start the crypto wallet HTTP server with graceful shutdown support
pub async fn run() -> Result<()> {
    tracing::info!("Starting crypto wallet server...");

    // Initialize database BEFORE creating the app
    tracing::info!("Initializing database...");
    let pool = init_database()
        .await
        .context("Failed to initialize database")?;
    tracing::info!("Database initialized successfully");

    let app = create_app(pool);

    let port = std::env::var("PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse::<u16>()
        .context("Invalid PORT environment variable")?;

    let addr = format!("127.0.0.1:{port}");

    let listener = tokio::net::TcpListener::bind(&addr).await.context(format!(
        "Failed to bind to {addr}. Is the port already in use?"
    ))?;

    tracing::info!("🚀 Server listening on http://{}", listener.local_addr()?);

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .context("Server error")?;

    Ok(())
}

/// Create the main application router with middleware stack
fn create_app(pool: DbPool) -> Router {
    Router::new()
        .route("/", get(root))
        .route("/health", get(health_check))
        .route("/wallets", get(wallet::get_wallets))
        .route("/wallet/create", post(wallet::create_wallet))
        .route("/wallet/import", post(wallet::import_wallet))
        .route("/wallet/{id}", put(wallet::update_wallet))
        .route("/wallet/{id}", delete(wallet::delete_wallet))
        .route("/wallet/{id}/addresses", post(wallet::register_address))
        .with_state(pool)
        .layer(configure_cors()) // CORS must be before other middleware
        .layer(configure_json_middleware()) // 16KB request limit for security
        .layer(TraceLayer::new_for_http()) // HTTP request/response logging
}

async fn root() -> &'static str {
    tracing::info!("Root endpoint called");
    "Crypto Wallet API v1.0"
}

async fn health_check(State(pool): State<DbPool>) -> &'static str {
    // Test database connectivity
    match sqlx::query("SELECT 1").execute(&pool).await {
        Ok(_) => {
            tracing::debug!("Health check passed - database connected");
            "OK"
        }
        Err(e) => {
            tracing::error!("Health check failed - database error: {:?}", e);
            // Still return OK to avoid exposing internal errors
            // In production, you might want to return an error status
            "OK"
        }
    }
}

/// Configure CORS to allow frontend (localhost:3000) access
fn configure_cors() -> CorsLayer {
    CorsLayer::new()
        .allow_origin("http://localhost:3000".parse::<HeaderValue>().unwrap())
        .allow_methods([
            http::Method::GET,
            http::Method::POST,
            http::Method::PUT,
            http::Method::DELETE,
            http::Method::OPTIONS, // Required for browser preflight requests
        ])
        .allow_headers([
            http::header::CONTENT_TYPE,
            http::header::AUTHORIZATION, // For future wallet authentication
            http::header::ACCEPT,
        ])
        .allow_credentials(true) // Enable cookies/auth tokens
        .max_age(std::time::Duration::from_secs(3600)) // Cache preflight for 1 hour
}

/// Limit request body size to 16KB to prevent DoS attacks
fn configure_json_middleware() -> RequestBodyLimitLayer {
    RequestBodyLimitLayer::new(16 * 1024) // 16KB sufficient for all wallet operations
}

/// Handle graceful shutdown on SIGTERM or Ctrl+C
async fn shutdown_signal() {
    use tokio::signal;

    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("Failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("Failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {
            tracing::info!("Received Ctrl+C, shutting down gracefully...");
        },
        _ = terminate => {
            tracing::info!("Received terminate signal, shutting down gracefully...");
        },
    }
}

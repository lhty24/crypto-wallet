use anyhow::{Context, Result};
use axum::{routing::get, Router};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() {
    // Initialize logging
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Run server and handle errors gracefully
    if let Err(e) = run().await {
        tracing::error!("Application error: {:?}", e);
        std::process::exit(1);
    }
}

async fn run() -> Result<()> {
    tracing::info!("Starting crypto wallet server...");

    // Build application
    let app = Router::new()
        .route("/", get(root))
        .route("/health", get(health_check))
        .layer(TraceLayer::new_for_http());

    // Get port from environment or use default
    let port = std::env::var("PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse::<u16>()
        .context("Invalid PORT environment variable")?;

    let addr = format!("127.0.0.1:{port}");

    // Bind to address
    let listener = tokio::net::TcpListener::bind(&addr).await.context(format!(
        "Failed to bind to {addr}. Is the port already in use?"
    ))?;

    tracing::info!("🚀 Server listening on http://{}", listener.local_addr()?);

    // Serve with graceful shutdown
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .context("Server error")?;

    Ok(())
}

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

async fn root() -> &'static str {
    tracing::info!("Root endpoint called");
    "Crypto Wallet API v1.0"
}

async fn health_check() -> &'static str {
    "OK"
}

//! Security integration tests for the API server
//!
//! Tests CORS headers, security response headers, X-Requested-With validation,
//! and JSON error response format.

use axum::http::{self, Request, StatusCode};
use crypto_wallet_backend::api::server::create_app;
use crypto_wallet_backend::database::init_database;
use http_body_util::BodyExt;
use tower::ServiceExt;

/// Set up a test database and return the app router
async fn test_app() -> axum::Router {
    // Use in-memory SQLite for tests
    std::env::set_var("DATABASE_URL", "sqlite::memory:");
    let pool = init_database().await.expect("Failed to init test database");
    create_app(pool)
}

/// Helper to read response body as string
async fn body_string(response: axum::response::Response) -> String {
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    String::from_utf8(bytes.to_vec()).unwrap()
}

// ============================================================================
// Security Response Headers
// ============================================================================

#[tokio::test]
async fn security_headers_present_on_get() {
    let app = test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/")
                .body(axum::body::Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response.headers().get("X-Content-Type-Options").unwrap(),
        "nosniff"
    );
    assert_eq!(response.headers().get("X-Frame-Options").unwrap(), "DENY");
    assert_eq!(response.headers().get("Cache-Control").unwrap(), "no-store");
}

#[tokio::test]
async fn security_headers_present_on_post() {
    let app = test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method(http::Method::POST)
                .uri("/wallet/create")
                .header("Content-Type", "application/json")
                .header("X-Requested-With", "CryptoWallet")
                .body(axum::body::Body::from(r#"{"name":"Test"}"#))
                .unwrap(),
        )
        .await
        .unwrap();

    // Even on success/error, security headers should be present
    assert_eq!(
        response.headers().get("X-Content-Type-Options").unwrap(),
        "nosniff"
    );
    assert_eq!(response.headers().get("X-Frame-Options").unwrap(), "DENY");
    assert_eq!(response.headers().get("Cache-Control").unwrap(), "no-store");
}

// ============================================================================
// X-Requested-With Validation
// ============================================================================

#[tokio::test]
async fn post_without_custom_header_returns_403() {
    let app = test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method(http::Method::POST)
                .uri("/wallet/create")
                .header("Content-Type", "application/json")
                .body(axum::body::Body::from(r#"{"name":"Test"}"#))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::FORBIDDEN);

    let body = body_string(response).await;
    assert!(body.contains("X-Requested-With"));
}

#[tokio::test]
async fn post_with_wrong_custom_header_returns_403() {
    let app = test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method(http::Method::POST)
                .uri("/wallet/create")
                .header("Content-Type", "application/json")
                .header("X-Requested-With", "WrongValue")
                .body(axum::body::Body::from(r#"{"name":"Test"}"#))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn post_with_correct_custom_header_succeeds() {
    let app = test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method(http::Method::POST)
                .uri("/wallet/create")
                .header("Content-Type", "application/json")
                .header("X-Requested-With", "CryptoWallet")
                .body(axum::body::Body::from(r#"{"name":"Test Wallet"}"#))
                .unwrap(),
        )
        .await
        .unwrap();

    // Should succeed (200) not be blocked (403)
    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn get_does_not_require_custom_header() {
    let app = test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/")
                .body(axum::body::Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    // GET should work without X-Requested-With
    assert_eq!(response.status(), StatusCode::OK);
}

// ============================================================================
// JSON Error Responses
// ============================================================================

#[tokio::test]
async fn validation_error_returns_json_with_error_field() {
    let app = test_app().await;

    // Send empty name to trigger validation error
    let response = app
        .oneshot(
            Request::builder()
                .method(http::Method::POST)
                .uri("/wallet/create")
                .header("Content-Type", "application/json")
                .header("X-Requested-With", "CryptoWallet")
                .body(axum::body::Body::from(r#"{"name":""}"#))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let body = body_string(response).await;
    let json: serde_json::Value = serde_json::from_str(&body).expect("Response should be JSON");
    assert!(json.get("error").is_some(), "Error response should have 'error' field");
}

#[tokio::test]
async fn not_found_returns_json_with_error_field() {
    let app = test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method(http::Method::DELETE)
                .uri("/wallet/nonexistent-id")
                .header("X-Requested-With", "CryptoWallet")
                .body(axum::body::Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);

    let body = body_string(response).await;
    let json: serde_json::Value = serde_json::from_str(&body).expect("Response should be JSON");
    assert!(json.get("error").is_some(), "Error response should have 'error' field");
}

// ============================================================================
// CORS Headers
// ============================================================================

#[tokio::test]
async fn cors_allows_configured_origin() {
    let app = test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method(http::Method::OPTIONS)
                .uri("/wallet/create")
                .header("Origin", "http://localhost:3000")
                .header("Access-Control-Request-Method", "POST")
                .header("Access-Control-Request-Headers", "content-type,x-requested-with")
                .body(axum::body::Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(
        response
            .headers()
            .get("Access-Control-Allow-Origin")
            .map(|v| v.to_str().unwrap()),
        Some("http://localhost:3000")
    );
}

#[tokio::test]
async fn cors_rejects_unknown_origin() {
    let app = test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method(http::Method::OPTIONS)
                .uri("/wallet/create")
                .header("Origin", "http://evil.com")
                .header("Access-Control-Request-Method", "POST")
                .body(axum::body::Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    // tower-http CORS with a specific allow_origin will NOT echo back an
    // unauthorized origin — the header should either be absent or not match
    let allowed = response
        .headers()
        .get("Access-Control-Allow-Origin")
        .and_then(|v| v.to_str().ok());
    assert_ne!(
        allowed,
        Some("http://evil.com"),
        "Should not echo back unauthorized origin"
    );
}

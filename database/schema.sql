CREATE TABLE IF NOT EXISTS users (
 id VARCHAR(32) PRIMARY KEY, name VARCHAR(120) NOT NULL, email VARCHAR(254) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL, role VARCHAR(20) NOT NULL DEFAULT 'customer', auth_version INTEGER NOT NULL DEFAULT 1, created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS password_resets (
 token_hash VARCHAR(64) PRIMARY KEY, user_id VARCHAR(32) NOT NULL, expires_at BIGINT NOT NULL,
 FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS products (
 id VARCHAR(40) PRIMARY KEY, name VARCHAR(120) NOT NULL, category VARCHAR(30) NOT NULL,
 description VARCHAR(2000) NOT NULL, image VARCHAR(255) NOT NULL, active INTEGER NOT NULL DEFAULT 1,
 launch_status VARCHAR(20) NOT NULL DEFAULT 'coming_soon', origin VARCHAR(120) NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS variants (
 id VARCHAR(60) PRIMARY KEY, product_id VARCHAR(40) NOT NULL, weight_g INTEGER NOT NULL,
 price_paise INTEGER NOT NULL, stock INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1,
 price_confirmed INTEGER NOT NULL DEFAULT 0,
 UNIQUE(product_id,weight_g), FOREIGN KEY(product_id) REFERENCES products(id)
);
CREATE TABLE IF NOT EXISTS coupons (
 code VARCHAR(40) PRIMARY KEY, percent INTEGER NOT NULL, minimum_paise INTEGER NOT NULL DEFAULT 0,
 max_discount_paise INTEGER NOT NULL DEFAULT 0, usage_limit INTEGER NOT NULL DEFAULT 0,
 uses INTEGER NOT NULL DEFAULT 0, starts_at BIGINT NOT NULL, ends_at BIGINT NOT NULL, active INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS settings (name VARCHAR(60) PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS addresses (
 id VARCHAR(32) PRIMARY KEY, user_id VARCHAR(32) NOT NULL, payload TEXT NOT NULL,
 FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS orders (
 id VARCHAR(32) PRIMARY KEY, user_id VARCHAR(32) NOT NULL, idempotency_key VARCHAR(100) NOT NULL,
 fingerprint VARCHAR(64) NOT NULL, status VARCHAR(30) NOT NULL, currency VARCHAR(3) NOT NULL,
 subtotal_paise INTEGER NOT NULL, discount_paise INTEGER NOT NULL, shipping_paise INTEGER NOT NULL,
 total_paise INTEGER NOT NULL, coupon_code VARCHAR(40), address TEXT NOT NULL,
 created_at BIGINT NOT NULL, expires_at BIGINT NOT NULL, tracking_url VARCHAR(1000),
 UNIQUE(user_id,idempotency_key), FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS order_items (
 id VARCHAR(32) PRIMARY KEY, order_id VARCHAR(32) NOT NULL, variant_id VARCHAR(60) NOT NULL,
 name VARCHAR(120) NOT NULL, weight_g INTEGER NOT NULL, quantity INTEGER NOT NULL, unit_paise INTEGER NOT NULL,
 FOREIGN KEY(order_id) REFERENCES orders(id), FOREIGN KEY(variant_id) REFERENCES variants(id)
);
CREATE TABLE IF NOT EXISTS payment_events (
 event_id VARCHAR(150) PRIMARY KEY, order_id VARCHAR(32) NOT NULL, amount_paise INTEGER NOT NULL,
 created_at BIGINT NOT NULL, FOREIGN KEY(order_id) REFERENCES orders(id)
);
CREATE TABLE IF NOT EXISTS outbox (
 id VARCHAR(32) PRIMARY KEY, kind VARCHAR(60) NOT NULL, payload TEXT NOT NULL, created_at BIGINT NOT NULL,
 delivered_at BIGINT, attempts INTEGER NOT NULL DEFAULT 0, last_error VARCHAR(500)
);
CREATE TABLE IF NOT EXISTS audit_log (
 id VARCHAR(32) PRIMARY KEY, actor_id VARCHAR(32) NOT NULL, action VARCHAR(60) NOT NULL,
 subject_id VARCHAR(100) NOT NULL, created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS rate_limits (bucket VARCHAR(64) PRIMARY KEY, hits INTEGER NOT NULL, expires_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(100) PRIMARY KEY, applied_at BIGINT NOT NULL);

CREATE TABLE IF NOT EXISTS reviews (
 id VARCHAR(32) PRIMARY KEY, user_id VARCHAR(32) NOT NULL, product_id VARCHAR(40) NOT NULL,
 rating INTEGER NOT NULL, display_name VARCHAR(80) NOT NULL, title VARCHAR(100) NOT NULL,
 body TEXT NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'pending', verified_purchase INTEGER NOT NULL DEFAULT 0,
 created_at BIGINT NOT NULL, moderated_at BIGINT NULL, moderated_by VARCHAR(32) NULL,
 UNIQUE (user_id,product_id), FOREIGN KEY (user_id) REFERENCES users(id), FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS razorpay_orders (
 order_id VARCHAR(32) PRIMARY KEY, provider_order_id VARCHAR(80) UNIQUE,
 key_id VARCHAR(80) NOT NULL, state VARCHAR(20) NOT NULL, created_at BIGINT NOT NULL,
 FOREIGN KEY(order_id) REFERENCES orders(id)
);

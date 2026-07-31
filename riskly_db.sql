CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    telegram_id BIGINT UNIQUE,
    telegram_username VARCHAR(100),
    photo_url VARCHAR(1024),
    password_hash VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'user' CHECK (role IN ('superadmin', 'admin', 'user')),
    auth_method VARCHAR(20) DEFAULT 'local' CHECK (auth_method IN ('local', 'telegram')),
    entite VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_unique_superadmin
    ON users ((role))
    WHERE role = 'superadmin';

CREATE INDEX idx_users_telegram_id ON users(telegram_id);


CREATE TABLE domain (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_name VARCHAR(255) UNIQUE NOT NULL,
    tld VARCHAR(20),
    country VARCHAR(100),
    domain_length INT,
    hyphen_count INT,
    whois_creation_date DATE,
    whois_expiration_date DATE,
    first_analysis TIMESTAMP
);

CREATE TABLE domain_metric (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES domain(id) ON DELETE CASCADE,
    is_blacklisted BOOLEAN DEFAULT FALSE,
    rank_value DECIMAL(6,2),
    rank_source VARCHAR(50),
    backlink_count INT DEFAULT 0,
    referring_domains_count INT DEFAULT 0,
    toxic_backlink_ratio DECIMAL(5,2),
    ns_server_count INT,
    raw_data JSONB,
    calculated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE model (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version VARCHAR(50),
    algorithm VARCHAR(100),
    metrics JSONB,
    artifact_path VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    training_date TIMESTAMP
);

CREATE TABLE analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    domain_id UUID NOT NULL REFERENCES domain(id) ON DELETE CASCADE,
    domain_metric_id UUID REFERENCES domain_metric(id) ON DELETE SET NULL,
    model_id UUID REFERENCES model(id) ON DELETE SET NULL,
    status VARCHAR(20),
    profitability_score DECIMAL(5,2),
    risk_score DECIMAL(5,2),
    authority_score DECIMAL(5,2),
    verdict VARCHAR(20) CHECK (verdict IN ('Bon achat', 'Risque', 'A eviter')),
    shap_values JSONB,
    requested_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

CREATE TABLE api_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id UUID REFERENCES analysis(id) ON DELETE CASCADE,
    api_source VARCHAR(50),
    status VARCHAR(20),
    error_message TEXT,
    payload JSONB,
    call_date TIMESTAMP DEFAULT NOW()
);

CREATE TABLE traffic_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES domain(id) ON DELETE CASCADE,
    day_date DATE,
    warmup_volume INT,
    sent_volume INT,
    bounce_count INT,
    spam_complaint_count INT,
    open_rate DECIMAL(5,2),
    reply_rate DECIMAL(5,2)
);

CREATE TABLE reputation_event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES domain(id) ON DELETE CASCADE,
    source VARCHAR(50),
    event_type VARCHAR(50),
    reason TEXT,
    detection_date DATE,
    exit_date DATE
);

CREATE TABLE acquisition_result (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID UNIQUE NOT NULL REFERENCES domain(id) ON DELETE CASCADE,
    acquisition_date DATE,
    price_paid DECIMAL(10,2),
    go_live_date DATE,
    volume_sent_90d INT,
    bounce_rate_90d DECIMAL(5,2),
    was_blacklisted_90d BOOLEAN,
    success_label BOOLEAN,
    observed_roi DECIMAL(6,2)
);

CREATE INDEX idx_analysis_user_id ON analysis(user_id);
CREATE INDEX idx_analysis_domain_id ON analysis(domain_id);
CREATE INDEX idx_domain_metric_domain_id ON domain_metric(domain_id);
CREATE INDEX idx_api_log_analysis_id ON api_log(analysis_id);
CREATE INDEX idx_traffic_history_domain_id ON traffic_history(domain_id);
CREATE INDEX idx_reputation_event_domain_id ON reputation_event(domain_id);
CREATE INDEX idx_domain_domain_name ON domain(domain_name);
-- For MySQL, use CREATE TABLE IF NOT EXISTS syntax directly

-- Table: di_user
CREATE TABLE IF NOT EXISTS di_user (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CHECK (role IN ('admin', 'dealer', 'client', 'team'))
);

-- Table: di_user_meta
CREATE TABLE IF NOT EXISTS di_user_meta (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    company_name VARCHAR(255),
    phone VARCHAR(50),
    address VARCHAR(255),
    state VARCHAR(50),
    city VARCHAR(50),
    zip VARCHAR(20),
    country VARCHAR(50),
    dealer_id INT,
    client_id INT,
    business_category VARCHAR(100),
    FOREIGN KEY (user_id) REFERENCES di_user(id) ON DELETE CASCADE,
    FOREIGN KEY (dealer_id) REFERENCES di_user(id),
    FOREIGN KEY (client_id) REFERENCES di_user(id)
);

-- Table: di_user_settings
CREATE TABLE IF NOT EXISTS di_user_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES di_user(id) ON DELETE CASCADE
);

-- Table: di_user_vehicles
CREATE TABLE IF NOT EXISTS di_user_vehicles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    vehicle_no VARCHAR(50) NOT NULL,
    chasis_no VARCHAR(100),
    imei_no VARCHAR(100),
    FOREIGN KEY (user_id) REFERENCES di_user(id) ON DELETE CASCADE
);
);

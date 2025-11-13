-- For MySQL, use CREATE TABLE IF NOT EXISTS syntax directly

-- Table: di_user
CREATE TABLE IF NOT EXISTS di_user (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CHECK (role IN ('superuser', 'admin', 'dealer', 'client', 'team'))
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


CREATE TABLE IF NOT EXISTS di_user_vehicle (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_number VARCHAR(50),
    chasis_number VARCHAR(100),
    engine_number VARCHAR(100),
    client_id INT NOT NULL,
    dealer_id INT NOT NULL,
    admin_id INT NOT NULL,
    registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    status ENUM('active', 'inactive', 'deleted') NOT NULL DEFAULT 'active'
);


-- Table: di_user_vehicle__rto_data
CREATE TABLE user_vehicle_rto_data (
    id INT PRIMARY KEY AUTO_INCREMENT,
    rc_regn_no VARCHAR(20),
    rc_regn_dt DATE,
    rc_regn_upto DATE,
    rc_purchase_dt DATE,
    rc_owner_sr VARCHAR(10),
    rc_owner_name VARCHAR(100),
    state_cd VARCHAR(10),
    rto_cd VARCHAR(10),
    api_response_message VARCHAR(255),
    rc_present_address VARCHAR(255),
    rc_permanent_address VARCHAR(255),
    rc_vch_catg VARCHAR(20),
    rc_vh_class_desc VARCHAR(50),
    rc_chasi_no VARCHAR(50),
    rc_eng_no VARCHAR(50),
    rc_maker_desc VARCHAR(100),
    rc_maker_model VARCHAR(100),
    rc_body_type_desc VARCHAR(50),
    rc_fuel_desc VARCHAR(20),
    rc_color VARCHAR(20),
    rc_norms_desc VARCHAR(50),
    rc_fit_upto DATE,
    rc_np_upto DATE,
    rc_np_issued_by VARCHAR(50),
    rc_tax_upto DATE,
    rc_financer VARCHAR(100),
    rc_insurance_comp VARCHAR(100),
    rc_insurance_policy_no VARCHAR(50),
    rc_insurance_upto DATE,
    rc_manu_month_yr VARCHAR(20),
    rc_unld_wt VARCHAR(20),
    rc_gvw VARCHAR(20),
    rc_no_cyl VARCHAR(10),
    rc_cubic_cap VARCHAR(20),
    rc_seat_cap VARCHAR(10),
    rc_sleeper_cap VARCHAR(10),
    rc_stand_cap VARCHAR(10),
    rc_wheelbase VARCHAR(20),
    rc_registered_at VARCHAR(100),
    rc_status_as_on DATE,
    rc_pucc_upto DATE,
    rc_pucc_no VARCHAR(50),
    rc_status VARCHAR(20),
    rc_ncrb_status VARCHAR(20),
    rc_blacklist_status VARCHAR(20),
    rc_permit_no VARCHAR(50),
    rc_permit_issue_dt DATE,
    rc_permit_valid_from DATE,
    rc_permit_valid_upto DATE,
    rc_permit_type VARCHAR(100),
    rc_permit_code VARCHAR(20),
    rc_noc_details VARCHAR(255),
    rc_vh_type VARCHAR(10),
    rc_vh_class VARCHAR(10),
    rc_noc_dt VARCHAR(20),
    rc_fuel_cd VARCHAR(10),
    rc_maker_cd VARCHAR(20),
    rc_model_cd VARCHAR(50),
    rc_norms_cd VARCHAR(10),
    rc_sale_amt DECIMAL(15,2),
    rc_own_catg_desc VARCHAR(50),
    rc_vch_catg_desc VARCHAR(50),
    rc_owner_cd_desc VARCHAR(50),
    rc_vehicle_surrendered_to_dealer VARCHAR(5),
    rc_currentadd_districtcode VARCHAR(10),
    rc_non_use VARCHAR(10),
    rc_passenger_tax VARCHAR(20),
    rc_goods_tax VARCHAR(20),
    rc_no_of_axle VARCHAR(10),
    rc_qr_url VARCHAR(255),
    rc_auth_name VARCHAR(100),
    rc_auth_sign VARCHAR(100),
    rc_approval_date VARCHAR(20),
    rc_hp VARCHAR(20),
    rc_mandal_desc VARCHAR(50),
    rc_taluk_cd VARCHAR(20),
    rc_permit_catg VARCHAR(20),
    rc_tax_mode VARCHAR(10),
    rc_permit_issuing_authority VARCHAR(100),
    rc_width VARCHAR(20),
    rc_fitness_result VARCHAR(50),
    stautsMessage VARCHAR(20),
    -- Nested: rc_deemed_owner_details
    rc_deemed_auc_valid_upto VARCHAR(20),
    rc_deemed_authorization_certificate_number VARCHAR(50),
    rc_deemed_dealer_code VARCHAR(20),
    rc_deemed_dealer_mail VARCHAR(100),
    rc_deemed_dealer_mobile VARCHAR(20),
    rc_deemed_dealer_name VARCHAR(100),
    -- Nested: rc_dealer
    rc_dealer_contact_no VARCHAR(20),
    rc_dealer_district VARCHAR(50),
    rc_dealer_pincode VARCHAR(20),
    -- Nested: rc_owner_history
    rc_owner_history_offName VARCHAR(100),
    rc_owner_history_owner_name VARCHAR(100),
    rc_owner_history_owner_sr VARCHAR(10),
    rc_owner_history_stateCd VARCHAR(10),
    -- Nested: temp_permit
    temp_permit_catg VARCHAR(20),
    temp_permit_code VARCHAR(20),
    temp_permit_issue_dt VARCHAR(20),
    temp_permit_no VARCHAR(50),
    temp_permit_type VARCHAR(50),
    temp_permit_valid_from VARCHAR(20),
    temp_permit_valid_upto VARCHAR(20)
);

-- Table: di_user_options
CREATE TABLE IF NOT EXISTS di_user_options (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    user_role ENUM('admin', 'dealer', 'client') NOT NULL,
    option_key VARCHAR(100) NOT NULL,
    option_value TEXT,
    FOREIGN KEY (user_id) REFERENCES di_user(id) ON DELETE CASCADE
);

-- Table: di_failed_records
CREATE TABLE IF NOT EXISTS di_failed_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    user_role ENUM('admin', 'dealer', 'client') NOT NULL,
    failed_request_name ENUM('rto_fetch', 'challan_fetch', 'driver_fetch', 'fastag_fetch') NOT NULL,
    failed_request_data JSON NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'failed',
    retry_count INT NOT NULL DEFAULT 0,
    record_failed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    record_success_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES di_user(id) ON DELETE CASCADE
);

-- Table: di_scheduled_job_records
CREATE TABLE IF NOT EXISTS di_scheduled_job_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_name VARCHAR(100) NOT NULL,
    job_status VARCHAR(20),
    job_started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    job_completed_at DATETIME,
    job_duration INT
);
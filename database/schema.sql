-- ============================================================
--  VendorBridge — Procurement & Vendor Management SaaS
--  MySQL schema (DDL).  Tested on MySQL 8.x.
--  Run:  mysql -u root -p < database/schema.sql
--        (or use `npm run db:init`)
-- ============================================================

CREATE DATABASE IF NOT EXISTS vendorbridge
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE vendorbridge;

-- Idempotent: safe to run repeatedly (CREATE ... IF NOT EXISTS).
-- For a destructive reset in development, drop the database first:
--   mysql -e 'DROP DATABASE vendorbridge;' && npm run db:init

-- ------------------------------------------------------------
--  vendors
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vendors (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(160) NOT NULL,
  category    VARCHAR(80)  NOT NULL DEFAULT 'General',
  gst         VARCHAR(20),
  email       VARCHAR(160),
  phone       VARCHAR(40),
  status      ENUM('Active','Pending','Suspended') NOT NULL DEFAULT 'Pending',
  rating      DECIMAL(2,1) NOT NULL DEFAULT 0.0,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_vendor_status (status),
  INDEX idx_vendor_category (category)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
--  users  (officer / vendor / manager / admin)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('officer','vendor','manager','admin') NOT NULL DEFAULT 'officer',
  vendor_id     INT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL,
  INDEX idx_user_role (role)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
--  rfqs  (requests for quotation)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rfqs (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(32) NOT NULL UNIQUE,
  title       VARCHAR(200) NOT NULL,
  details     TEXT,
  quantity    INT NOT NULL DEFAULT 1,
  unit        VARCHAR(40) NOT NULL DEFAULT 'units',
  deadline    DATE,
  status      ENUM('Open','In Approval','Completed','Cancelled') NOT NULL DEFAULT 'Open',
  created_by  INT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rfq_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_rfq_status (status)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
--  rfq_vendors  (which vendors were invited to an RFQ)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rfq_vendors (
  rfq_id     INT NOT NULL,
  vendor_id  INT NOT NULL,
  PRIMARY KEY (rfq_id, vendor_id),
  CONSTRAINT fk_rv_rfq    FOREIGN KEY (rfq_id)    REFERENCES rfqs(id)    ON DELETE CASCADE,
  CONSTRAINT fk_rv_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
--  quotations  (a vendor's response to an RFQ)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quotations (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  rfq_id        INT NOT NULL,
  vendor_id     INT NOT NULL,
  unit_price    DECIMAL(12,2) NOT NULL,
  delivery_days INT NOT NULL,
  notes         TEXT,
  status        ENUM('Submitted','Shortlisted','Awarded','Rejected') NOT NULL DEFAULT 'Submitted',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_quote (rfq_id, vendor_id),
  CONSTRAINT fk_q_rfq    FOREIGN KEY (rfq_id)    REFERENCES rfqs(id)    ON DELETE CASCADE,
  CONSTRAINT fk_q_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
--  approvals  (manager decision on a recommended quotation)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS approvals (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  rfq_id        INT NOT NULL,
  quotation_id  INT NOT NULL,
  state         ENUM('Under Review','Approved','Rejected') NOT NULL DEFAULT 'Under Review',
  remark        TEXT,
  requested_by  INT NULL,
  decided_by    INT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decided_at    TIMESTAMP NULL,
  CONSTRAINT fk_ap_rfq   FOREIGN KEY (rfq_id)       REFERENCES rfqs(id)       ON DELETE CASCADE,
  CONSTRAINT fk_ap_quote FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
  INDEX idx_ap_state (state)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
--  purchase_orders  (auto-generated on approval)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_orders (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  code          VARCHAR(32) NOT NULL UNIQUE,
  rfq_id        INT NOT NULL,
  quotation_id  INT NOT NULL,
  vendor_id     INT NOT NULL,
  quantity      INT NOT NULL,
  unit_price    DECIMAL(12,2) NOT NULL,
  status        ENUM('Issued','Fulfilled','Cancelled') NOT NULL DEFAULT 'Issued',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_po_rfq    FOREIGN KEY (rfq_id)       REFERENCES rfqs(id),
  CONSTRAINT fk_po_quote  FOREIGN KEY (quotation_id) REFERENCES quotations(id),
  CONSTRAINT fk_po_vendor FOREIGN KEY (vendor_id)    REFERENCES vendors(id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
--  invoices  (auto-generated alongside the PO, GST computed)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(32) NOT NULL UNIQUE,
  po_id       INT NOT NULL,
  vendor_id   INT NOT NULL,
  subtotal    DECIMAL(14,2) NOT NULL,
  tax_rate    DECIMAL(5,2)  NOT NULL DEFAULT 18.00,
  tax_amount  DECIMAL(14,2) NOT NULL,
  total       DECIMAL(14,2) NOT NULL,
  status      ENUM('Issued','Emailed','Paid','Overdue') NOT NULL DEFAULT 'Issued',
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_inv_po     FOREIGN KEY (po_id)     REFERENCES purchase_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_inv_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id),
  INDEX idx_inv_status (status)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
--  activity_log  (audit trail + notifications source)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_log (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  type        VARCHAR(30) NOT NULL,
  message     VARCHAR(400) NOT NULL,
  actor       VARCHAR(120) NOT NULL DEFAULT 'System',
  ref_code    VARCHAR(40),
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_act_created (created_at)
) ENGINE=InnoDB;

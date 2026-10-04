USE fusball_id;

-- 1) Add orders.updated_at only when it does not already exist.
SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'orders'
    AND column_name = 'updated_at'
);

SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE orders ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) Order status history.
CREATE TABLE IF NOT EXISTS order_status_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  status ENUM('pending','paid','processing','shipped','completed','cancelled') NOT NULL,
  note VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_history_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE CASCADE
);

-- 3) Custom request status history.
CREATE TABLE IF NOT EXISTS custom_status_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  custom_request_id INT NOT NULL,
  status ENUM('consultation','designing','revision','approved','po','production','completed') NOT NULL,
  note VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_custom_history_request
    FOREIGN KEY (custom_request_id) REFERENCES custom_requests(id)
    ON DELETE CASCADE
);

-- 4) Backfill only records that do not yet have history.
INSERT INTO order_status_history(order_id,status,note,created_at)
SELECT o.id,o.status,'Initial status',o.created_at
FROM orders o
LEFT JOIN order_status_history h ON h.order_id=o.id
WHERE h.id IS NULL;

INSERT INTO custom_status_history(custom_request_id,status,note,created_at)
SELECT c.id,c.status,'Initial status',c.created_at
FROM custom_requests c
LEFT JOIN custom_status_history h ON h.custom_request_id=c.id
WHERE h.id IS NULL;

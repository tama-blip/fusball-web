CREATE DATABASE IF NOT EXISTS fusball_id
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE fusball_id;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('customer','admin') NOT NULL DEFAULT 'customer',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT NOT NULL,
  name VARCHAR(160) NOT NULL,
  slug VARCHAR(180) NOT NULL UNIQUE,
  description TEXT,
  price DECIMAL(12,2) NOT NULL,
  status ENUM('po_open','coming_soon','po_closed') NOT NULL DEFAULT 'coming_soon',
  po_deadline DATETIME NULL,
  production_estimate VARCHAR(120) NULL,
  featured TINYINT(1) NOT NULL DEFAULT 0,
  image_url VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_category
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS product_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_images_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_sizes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  size_code VARCHAR(10) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_product_size(product_id, size_code),
  CONSTRAINT fk_product_sizes_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS custom_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  team_name VARCHAR(160) NOT NULL,
  contact_name VARCHAR(120) NOT NULL,
  whatsapp VARCHAR(40) NOT NULL,
  team_size INT NOT NULL,
  brief TEXT NOT NULL,
  reference_url VARCHAR(500) NULL,
  status ENUM('consultation','designing','revision','approved','po','production','completed') NOT NULL DEFAULT 'consultation',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_custom_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  customer_name VARCHAR(120) NOT NULL,
  customer_phone VARCHAR(40) NOT NULL,
  customer_email VARCHAR(180) NOT NULL,
  shipping_address TEXT NOT NULL,
  payment_method ENUM('transfer','qris','manual') NOT NULL DEFAULT 'transfer',
  total DECIMAL(12,2) NOT NULL,
  status ENUM('pending','paid','processing','shipped','completed','cancelled') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL
);

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

CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  size_code VARCHAR(10) NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  CONSTRAINT fk_order_items_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product
    FOREIGN KEY (product_id) REFERENCES products(id)
);


CREATE TABLE IF NOT EXISTS site_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value TEXT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO site_settings(setting_key,setting_value) VALUES
('hero_kicker','KOLEKSI FANTASY FOOTBALL'),
('hero_title','Kenakan jersey yang punya cerita.'),
('hero_description','Jersey fantasy original Fusball.id untuk kamu yang melihat sepak bola sebagai budaya, identitas, dan cara berekspresi.'),
('about_title','Bukan sekadar jersey.'),
('about_description','Fusball.id lahir dari kecintaan pada football culture. Kami membuat jersey fantasy dan custom yang membawa cerita, karakter, dan identitas ke luar lapangan.'),
('whatsapp',''),
('email',''),
('instagram','https://www.instagram.com/fusball.id/');

-- Seed categories
INSERT IGNORE INTO categories (name) VALUES
('National Fantasy'),
('Club Fantasy'),
('Country Fantasy'),
('Special Collection');

-- Seed products
INSERT IGNORE INTO products
(category_id, name, slug, description, price, status, production_estimate, featured, image_url)
SELECT id, 'Indonesia Fantasy 01', 'indonesia-fantasy-01',
'Fantasy jersey bertema Indonesia dengan visual original Fusball.id.',
185000, 'po_open', '14–21 hari', 1, 'assets/images/jersey-indonesia.png'
FROM categories WHERE name='National Fantasy';

INSERT IGNORE INTO products
(category_id, name, slug, description, price, status, production_estimate, featured, image_url)
SELECT id, 'Argentina Fantasy 01', 'argentina-fantasy-01',
'Fantasy football jersey dengan nuansa Argentina.',
185000, 'po_open', '14–21 hari', 1, 'assets/images/jersey-argentina.png'
FROM categories WHERE name='National Fantasy';

INSERT IGNORE INTO products
(category_id, name, slug, description, price, status, production_estimate, featured, image_url)
SELECT id, 'European Club Fantasy', 'european-club-fantasy',
'Fantasy jersey terinspirasi atmosfer football club Eropa.',
195000, 'po_open', '14–21 hari', 1, 'assets/images/jersey-europe.png'
FROM categories WHERE name='Club Fantasy';

INSERT IGNORE INTO products
(category_id, name, slug, description, price, status, production_estimate, featured, image_url)
SELECT id, 'Japan Fantasy 01', 'japan-fantasy-01',
'Country fantasy collection dengan pendekatan visual modern.',
185000, 'po_open', '14–21 hari', 0, 'assets/images/jersey-japan.png'
FROM categories WHERE name='Country Fantasy';

INSERT IGNORE INTO products
(category_id, name, slug, description, price, status, production_estimate, featured, image_url)
SELECT id, 'Brazil Fantasy 01', 'brazil-fantasy-01',
'Country fantasy collection untuk Brazil-inspired release.',
185000, 'coming_soon', '14–21 hari', 0, 'assets/images/jersey-brazil.png'
FROM categories WHERE name='Country Fantasy';

INSERT IGNORE INTO products
(category_id, name, slug, description, price, status, production_estimate, featured, image_url)
SELECT id, 'Special Collection 01', 'special-collection-01',
'Special drop untuk kolektor dan football culture enthusiast.',
210000, 'po_open', '14–21 hari', 0, 'assets/images/jersey-special.png'
FROM categories WHERE name='Special Collection';

-- Seed sizes
INSERT IGNORE INTO product_sizes(product_id, size_code, sort_order)
SELECT p.id, s.size_code, s.sort_order
FROM products p
CROSS JOIN (
  SELECT 'S' size_code, 1 sort_order UNION ALL
  SELECT 'M', 2 UNION ALL
  SELECT 'L', 3 UNION ALL
  SELECT 'XL', 4 UNION ALL
  SELECT 'XXL', 5
) s;


-- Editorial CMS: external blog links and web design team
CREATE TABLE IF NOT EXISTS blog_posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  excerpt TEXT NULL,
  url VARCHAR(1000) NULL,
  image_url VARCHAR(1000) NULL,
  published TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  slug VARCHAR(220) NULL,
  content LONGTEXT NULL,
  category VARCHAR(100) NULL,
  tags VARCHAR(500) NULL,
  focus_keyword VARCHAR(160) NULL,
  secondary_keywords VARCHAR(500) NULL,
  seo_title VARCHAR(180) NULL,
  meta_description VARCHAR(320) NULL,
  cta_label VARCHAR(180) NULL,
  cta_url VARCHAR(1000) NULL,
  status ENUM('draft','scheduled','published') NOT NULL DEFAULT 'published',
  scheduled_at DATETIME NULL,
  published_at DATETIME NULL,
  author_name VARCHAR(120) NOT NULL DEFAULT 'Fusball.id Editorial',
  UNIQUE KEY uq_blog_posts_slug (slug),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS web_team (
  id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(120) NOT NULL, role VARCHAR(160) NOT NULL, bio TEXT NULL,
  photo_url VARCHAR(1000) NULL, instagram_url VARCHAR(1000) NULL, sort_order INT NOT NULL DEFAULT 0, active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);


-- Blog Marketing Analytics: visitor keys are hashed server-side; no IP address is stored.
CREATE TABLE IF NOT EXISTS site_analytics_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_type VARCHAR(30) NOT NULL DEFAULT 'page_view',
  path VARCHAR(500) NOT NULL,
  article_id INT NULL,
  visitor_hash CHAR(64) NOT NULL,
  traffic_source VARCHAR(100) NOT NULL DEFAULT 'direct',
  utm_source VARCHAR(160) NULL,
  utm_medium VARCHAR(160) NULL,
  utm_campaign VARCHAR(160) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_analytics_created (created_at),
  KEY idx_analytics_article_created (article_id, created_at),
  KEY idx_analytics_source_created (traffic_source, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  objective VARCHAR(500) NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('planned','active','completed') NOT NULL DEFAULT 'planned',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_campaign_dates (start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS campaign_promotions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  campaign_id INT NOT NULL,
  article_id INT NULL,
  platform VARCHAR(40) NOT NULL,
  content_format VARCHAR(60) NOT NULL,
  status ENUM('planned','published') NOT NULL DEFAULT 'planned',
  scheduled_at DATETIME NULL,
  published_at DATETIME NULL,
  post_url VARCHAR(1000) NULL,
  reach BIGINT UNSIGNED NOT NULL DEFAULT 0,
  impressions BIGINT UNSIGNED NOT NULL DEFAULT 0,
  likes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  comments BIGINT UNSIGNED NOT NULL DEFAULT 0,
  shares BIGINT UNSIGNED NOT NULL DEFAULT 0,
  saves BIGINT UNSIGNED NOT NULL DEFAULT 0,
  profile_visits BIGINT UNSIGNED NOT NULL DEFAULT 0,
  link_clicks BIGINT UNSIGNED NOT NULL DEFAULT 0,
  caption TEXT NULL,
  hashtags VARCHAR(500) NULL,
  cta VARCHAR(300) NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_promo_campaign (campaign_id),
  KEY idx_promo_article (article_id),
  CONSTRAINT fk_promo_campaign FOREIGN KEY (campaign_id) REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  CONSTRAINT fk_promo_article FOREIGN KEY (article_id) REFERENCES blog_posts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

# Fusball.id v4 Setup

## 1. Install Node.js
Use an LTS release of Node.js.

Verify:
```bash
node -v
npm -v
```

## 2. Install MySQL
Use MySQL 8.x or compatible MariaDB.

Verify the server is running before starting Fusball.

## 3. Install project packages

From the project root:

```bash
npm install
```

## 4. Create database

Import:
`database/schema.sql`

using MySQL Workbench or:

```bash
mysql -u root -p < database/schema.sql
```

## 5. Configure environment

Copy:
`.env.example`

to:
`.env`

Then fill in your MySQL password.

## 6. Start

```bash
npm start
```

Open:

`http://localhost:3000`

The API health endpoint is:

`http://localhost:3000/api/health`

## 7. Admin

Open:

`http://localhost:3000/admin/index.html`

In v4 this dashboard can read and update product data in MySQL.

## Important
This is still an MVP. Admin authentication, file-storage security, customer authentication, payment gateway, rate limiting, validation hardening, and production deployment are not yet implemented.

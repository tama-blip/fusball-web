# FUSBALL.ID V8 — START HERE

This package is intentionally flattened so that `package.json` is directly inside
the project root.

## Folder structure

FusballID_Professional_v7/
├── package.json
├── .env.example
├── backend/
├── database/
├── frontend/
└── docs/

## 1. Open THIS folder in VS Code

Open:
`FusballID_Professional_v7`

You should immediately see:
- `package.json`
- `backend`
- `frontend`
- `database`

Do NOT open a parent folder with another nested `FusballID_Professional_*` folder inside it.

## 2. Create .env

Copy `.env.example` to a new file named `.env`.

Use the same database/JWT values you already have:

```env
PORT=3000

DB_HOST=localhost
DB_PORT=3306
DB_NAME=fusball_id
DB_USER=root
DB_PASSWORD=

JWT_SECRET=fusball_id_secret_2026_bikin_ini_lebih_panjang
JWT_EXPIRES_IN=2h
```

## 3. Keep XAMPP MySQL running

Start:
- MySQL ✅
- Apache ✅ if you want phpMyAdmin

Do NOT import `database/schema.sql` again.

Your existing `fusball_id` database stays in place.

## 4. Install packages

In the VS Code terminal, make sure the prompt ends with:

`...\FusballID_Professional_v7>`

Then:

```powershell
npm.cmd install
```

## 5. Apply the V7 database migration

Open phpMyAdmin:
`http://localhost/phpmyadmin`

Then:
1. Select `fusball_id`
2. Open **Import**
3. Choose:
   `database/migrations/v7_operational_upgrade.sql`
4. Click **Import / Go**

Do NOT import `database/schema.sql` again.

## 6. Start V7

Back in the VS Code terminal:

```powershell
npm.cmd start
```

You should see:

`Fusball.id API running at http://localhost:3000`

## 7. Test

Health:
`http://localhost:3000/api/health`

Storefront:
`http://localhost:3000`

Login:
`http://localhost:3000/login.html`

Admin:
`http://localhost:3000/admin/index.html`

Account:
`http://localhost:3000/account.html`

## 8. Your existing data

The existing `fusball_id` database is reused.
Your existing customer, admin account, products, and orders are not recreated from scratch.

V7 adds:
- professional order number format
- order date/time
- updated date/time
- status history
- custom request status history
- admin search/filter
- richer order detail
- cleaner product detail presentation

## 6A. V8 media folders
The server will automatically use `uploads/products` and `uploads/custom`. No manual folder creation is required.

## 7A. After install
The admin Product Editor has a Media section for gallery upload. The Custom Request form accepts a real reference image upload.

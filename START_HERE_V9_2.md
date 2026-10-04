# START HERE — Fusball.id v9.2 Stability Repair

Use this build instead of repeatedly rotating through earlier versions.

## 1. Open the correct folder
Open the folder whose root immediately contains `package.json`, `backend`, `frontend`, and `database`.

## 2. Keep the existing database
Do not drop or recreate `fusball_id`. Existing v7 data can stay.

## 3. Install dependencies

```powershell
npm.cmd install
```

## 4. Copy `.env` from the previous working version
Keep the same local XAMPP settings:

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

## 5. Start

```powershell
npm.cmd start
```

The terminal should now explicitly print the local server and health-check URLs.

## 6. First smoke test

Open:

`http://localhost:3000/api/health`

Then test customer flow before changing any admin product data.

### Customer
Login → Shop → Product → Cart → Checkout → Account → Custom → Account → Logout.

### Admin
Login → Dashboard → Product Edit/Media → Orders → Custom Requests → Logout.

## Stop condition

Do not reinstall, recreate the database, or jump to another version because a single page misbehaves. Record the exact page, action, and visible error first. That keeps debugging deterministic.

# Fusball.id v5 Authentication Setup

## 1. Add JWT settings to `.env`

```env
JWT_SECRET=use_a_long_random_secret_here
JWT_EXPIRES_IN=2h
```

## 2. Create your first admin

From the project root:

```powershell
node backend/create-admin.js admin@fusball.id StrongPassword123
```

Use your own email/password in a real project.

## 3. Customer registration

Open:
`http://localhost:3000/register.html`

New registrations are created with `role=customer`.

## 4. Login

Open:
`http://localhost:3000/login.html`

- customer → storefront
- admin → `/admin/index.html`

## 5. Security status

v5 adds bcrypt password hashing and JWT authorization. Admin APIs require a valid Bearer token and `role=admin`.

Still required before production: HTTPS, secure token storage/cookies, rate limiting, audit logging, CSRF strategy, stricter validation, password reset, and account lockout policies.

# V9.1 Stability Audit

This patch deliberately prioritizes regression safety over adding new business features.

## Regressions identified in V9
1. Logged-in header combined the account name and logout into a single text link.
   This made logout discoverability and interaction fragile.
2. Customer header no longer exposed a clear Account entry.
3. Customer footer still exposed an Admin dashboard link.
4. Product cards preferred old browser `localStorage` image overrides over the new real server image.
   A newly uploaded main image could therefore appear not to update.
5. Admin logout was dependent on the generic header link instead of having a dedicated admin control.

## V9.1 fixes
- Dedicated Account link.
- Dedicated Logout button.
- Dedicated Admin link only for admins.
- Dedicated admin-session logout control.
- Server/database product image is authoritative.
- Account shortcuts are visible on My Account.
- Logout uses `location.replace` and clears sessionStorage.
- No database migration is required for V9.1.

## Manual smoke test
1. Admin login -> dashboard opens.
2. Click top Logout -> login page appears.
3. Login as customer -> Account is visible.
4. Customer has no Admin Dashboard link.
5. Open product -> server image/gallery loads.
6. Cart -> checkout still available.
7. Customer account -> order and custom request history remain visible.
8. Admin login -> Orders, Products, Custom Requests remain accessible.

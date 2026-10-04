# v9.2 Stability Audit

## Source-level findings fixed

| Area | Finding | Repair |
|---|---|---|
| Frontend boot | `app.js` defined render functions but did not boot customer pages | Added one controlled `bootApp()` flow |
| Auth navigation | Shop/Product/Cart omitted `auth.js` | Added `auth.js` to all customer app pages |
| Product data | Customer pages could fall back to stale local data after a successful API call | Live `/api/products` data is now authoritative |
| Product status | Product detail used raw DB status while UI expected display labels | Added normalized `rawStatus` + display `status` |
| Cart | Missing/closed products could crash cart rendering | Cart now resolves product references and blocks invalid checkout |
| Checkout | Prices could come from stale local data | Checkout uses the same live product set as Shop/Product |
| Account | No custom-request container; zero-order branch returned early | Added custom-request section and removed the early return |
| Account storage | Malformed auth JSON could crash page | Defensive auth parsing |
| Custom API | Duplicate POST handler in `server.js` shadowed route ownership | Removed dead duplicate route |
| Custom upload | Uploaded reference files could become orphan files after validation/DB failure | Cleanup on failure |
| Admin orders | Search/filter UI existed but was not bound | Wired input/change events |
| Fresh schema | `orders.updated_at` and history tables depended on a separate migration | Included them in final schema for fresh installs |
| Upload dependency | Project used deprecated Multer 1.x | Updated dependency to Multer 2.4.x |

## Static checks

- `node --check` across backend and frontend JS: **0 syntax errors**.
- HTML local script/image references: **0 missing references**.
- Duplicate HTML IDs: **0 detected**.
- Customer app pages using `app.js` without `auth.js`: **0**.
- Duplicate `/api/custom-requests` POST route in `server.js`: **0**.

## Runtime limitation

The build environment used for this repair does not contain the project's installed Node modules or the user's XAMPP/MySQL database, so a real DB-backed browser smoke test cannot be honestly marked as completed here. The package is prepared for that test on the user's Windows/XAMPP machine.

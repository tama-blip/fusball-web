# V7 Operational & Design Upgrade

## New operational data
Run:
`database/migrations/v7_operational_upgrade.sql`

This adds:
- `orders.updated_at`
- `order_status_history`
- `custom_status_history`

Existing orders and custom requests are backfilled with their current status and original creation time.

## UI improvements
### Orders
- Order number: `FSB-YYYYMMDD-XXXX`
- Explicit order date/time in WIB
- Last updated time
- Status history
- Search by customer or order number
- Status filter

### Customer account
- Date/time ordered
- Last updated
- Current status
- Latest status timestamp

### Product detail
- Product category/status
- Production estimate
- Order type
- Purchase trust microcopy

## Important
This is still a local MVP. Real payment, real file storage, shipping APIs, production notifications, and production deployment remain separate phases.

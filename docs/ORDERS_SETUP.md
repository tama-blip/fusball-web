# V6 Order System

## What is now real
- Customer checkout creates a row in `orders`.
- Each product line is stored in `order_items`.
- Customer can view order history on `account.html`.
- Admin can see orders and update status.
- Product availability and selected sizes are validated by the backend.

## Status flow
pending -> paid -> processing -> shipped -> completed

Cancellation:
pending/paid/processing -> cancelled

## Test flow
1. Log in as customer.
2. Shop -> open a PO product.
3. Choose size.
4. Add to cart.
5. Checkout.
6. Submit order.
7. Open `/account.html`.
8. Log in as admin separately and open `/admin/index.html`.
9. Go to Orders and change the status.

No real payment is processed yet.

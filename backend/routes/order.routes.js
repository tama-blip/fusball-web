const express = require("express");
const pool = require("../db");
const { authenticate, requireRole } = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/", authenticate, async (req, res, next) => {
  let connection;

  try {
    connection = await pool.getConnection();
    const {
      customerName,
      customerPhone,
      customerEmail,
      shippingAddress,
      paymentMethod = "transfer",
      items
    } = req.body;

    if (!customerName || !customerPhone || !customerEmail || !shippingAddress) {
      return res.status(400).json({ message: "Customer and shipping details are required." });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "At least one cart item is required." });
    }

    const allowedPayments = new Set(["transfer", "qris", "manual"]);
    if (!allowedPayments.has(String(paymentMethod))) {
      return res.status(400).json({ message: "Invalid payment method." });
    }

    await connection.beginTransaction();

    let total = 0;
    const normalizedItems = [];

    for (const raw of items) {
      const productId = Number(raw.productId);
      const quantity = Number(raw.quantity);
      const sizeCode = String(raw.size || "").trim();

      if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity < 1 || !sizeCode) {
        throw new Error("Invalid order item.");
      }

      const [rows] = await connection.query(
        `SELECT id, name, price, status
         FROM products
         WHERE id = ?
         LIMIT 1`,
        [productId]
      );

      if (!rows.length) {
        throw new Error(`Product ${productId} not found.`);
      }

      const product = rows[0];

      if (product.status !== "po_open") {
        throw new Error(`${product.name} is not currently open for pre-order.`);
      }

      const [sizeRows] = await connection.query(
        `SELECT id
         FROM product_sizes
         WHERE product_id = ? AND size_code = ?
         LIMIT 1`,
        [productId, sizeCode]
      );

      if (!sizeRows.length) {
        throw new Error(`Size ${sizeCode} is not available for ${product.name}.`);
      }

      const lineTotal = Number(product.price) * quantity;
      total += lineTotal;

      normalizedItems.push({
        productId,
        sizeCode,
        quantity,
        unitPrice: Number(product.price)
      });
    }

    const [orderResult] = await connection.query(
      `INSERT INTO orders
       (user_id, customer_name, customer_phone, customer_email, shipping_address, payment_method, total, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        req.user.id,
        String(customerName).trim(),
        String(customerPhone).trim(),
        String(customerEmail).trim().toLowerCase(),
        String(shippingAddress).trim(),
        paymentMethod,
        total
      ]
    );

    for (const item of normalizedItems) {
      await connection.query(
        `INSERT INTO order_items
         (order_id, product_id, size_code, quantity, unit_price)
         VALUES (?, ?, ?, ?, ?)`,
        [
          orderResult.insertId,
          item.productId,
          item.sizeCode,
          item.quantity,
          item.unitPrice
        ]
      );
    }

    await connection.query(
      `INSERT INTO order_status_history(order_id,status,note)
       VALUES (?, 'pending', 'Order created')`,
      [orderResult.insertId]
    );

    await connection.commit();

    res.status(201).json({
      orderId: orderResult.insertId,
      status: "pending",
      total,
      message: "Order created successfully."
    });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch {}
    }
    next(error);
  } finally {
    connection?.release();
  }
});

router.get("/mine", authenticate, async (req, res, next) => {
  try {
    const [orders] = await pool.query(
      `SELECT id, customer_name, customer_phone, customer_email,
              shipping_address, payment_method, total, status, created_at, updated_at
       FROM orders
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    if (!orders.length) return res.json([]);

    const orderIds = orders.map(order => order.id);
    const placeholders = orderIds.map(() => "?").join(",");

    const [items] = await pool.query(
      `SELECT oi.order_id, oi.product_id, oi.size_code, oi.quantity, oi.unit_price,
              p.name, p.image_url
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id IN (${placeholders})
       ORDER BY oi.id`,
      orderIds
    );

    const grouped = {};
    for (const item of items) {
      (grouped[item.order_id] ||= []).push(item);
    }

    const [history] = await pool.query(
      `SELECT order_id, status, note, created_at
       FROM order_status_history
       WHERE order_id IN (${placeholders})
       ORDER BY created_at ASC, id ASC`,
      orderIds
    );

    const historyMap = {};
    for (const row of history) {
      (historyMap[row.order_id] ||= []).push(row);
    }

    res.json(
      orders.map(order => ({
        ...order,
        items: grouped[order.id] || [],
        history: historyMap[order.id] || []
      }))
    );
  } catch (error) {
    next(error);
  }
});

router.get("/admin", authenticate, requireRole("admin"), async (_req, res, next) => {
  try {
    const [orders] = await pool.query(
      `SELECT o.id, o.customer_name, o.customer_phone, o.customer_email,
              o.shipping_address, o.payment_method, o.total, o.status, o.created_at,
              COUNT(oi.id) AS item_count
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       GROUP BY o.id
       ORDER BY o.created_at DESC`
    );

    res.json(orders);
  } catch (error) {
    next(error);
  }
});

router.get("/admin/:id", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [orders] = await pool.query(
      `SELECT id, customer_name, customer_phone, customer_email,
              shipping_address, payment_method, total, status, created_at, updated_at
       FROM orders
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    if (!orders.length) return res.status(404).json({ message: "Order not found." });

    const [items] = await pool.query(
      `SELECT oi.product_id, oi.size_code, oi.quantity, oi.unit_price,
              p.name, p.image_url
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ?
       ORDER BY oi.id`,
      [id]
    );

    const [history] = await pool.query(
      `SELECT status,note,created_at
       FROM order_status_history
       WHERE order_id=?
       ORDER BY created_at ASC,id ASC`,
      [id]
    );

    res.json({ ...orders[0], items, history });
  } catch (error) {
    next(error);
  }
});

router.put("/admin/:id/status", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const allowed = ["pending", "paid", "processing", "shipped", "completed", "cancelled"];
    const status = String(req.body.status || "");

    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Invalid order status." });
    }

    const [currentRows] = await pool.query(
      "SELECT status FROM orders WHERE id=? LIMIT 1",
      [id]
    );

    if (!currentRows.length) return res.status(404).json({ message: "Order not found." });
    const previousStatus = currentRows[0].status;

    const [result] = await pool.query(
      "UPDATE orders SET status = ? WHERE id = ?",
      [status, id]
    );

    if (!result.affectedRows) return res.status(404).json({ message: "Order not found." });

    if (previousStatus !== status) {
      await pool.query(
        `INSERT INTO order_status_history(order_id,status,note)
         VALUES (?, ?, ?)`,
        [id, status, `Status changed from ${previousStatus} to ${status}`]
      );
    }

    res.json({ message: "Order status updated.", status });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

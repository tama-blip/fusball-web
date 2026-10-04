const express = require("express");
const pool = require("../db");
const { authenticate, requireRole } = require("../middleware/auth.middleware");
const { customUpload } = require("../middleware/upload.middleware");
const fs = require("fs");

const router = express.Router();

router.post("/", authenticate, customUpload.single("reference"), async (req, res, next) => {
  try {
    const { teamName, contactName, whatsapp, teamSize, brief } = req.body;
    const numericTeamSize = Number(teamSize);
    const referenceUrl = req.file ? `/uploads/custom/${req.file.filename}` : null;

    if (!teamName || !contactName || !whatsapp || !brief || !Number.isInteger(numericTeamSize) || numericTeamSize < 1) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: "Team name, contact, WhatsApp, valid team size, and brief are required." });
    }

    const [result] = await pool.query(
      `INSERT INTO custom_requests
       (user_id, team_name, contact_name, whatsapp, team_size, brief, reference_url, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'consultation')`,
      [
        req.user.id,
        String(teamName).trim(),
        String(contactName).trim(),
        String(whatsapp).trim(),
        numericTeamSize,
        String(brief).trim(),
        referenceUrl
      ]
    );

    await pool.query(
      `INSERT INTO custom_status_history(custom_request_id,status,note)
       VALUES (?, 'consultation', 'Request created')`,
      [result.insertId]
    );

    res.status(201).json({
      id: result.insertId,
      status: "consultation",
      message: "Custom request created successfully."
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    next(error);
  }
});

router.get("/mine", authenticate, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, team_name, contact_name, whatsapp, team_size, brief,
              reference_url, status, created_at, updated_at
       FROM custom_requests
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    if (!rows.length) return res.json([]);

    const ids = rows.map(row => row.id);
    const placeholders = ids.map(() => "?").join(",");
    const [history] = await pool.query(
      `SELECT custom_request_id,status,note,created_at
       FROM custom_status_history
       WHERE custom_request_id IN (${placeholders})
       ORDER BY created_at ASC,id ASC`,
      ids
    );

    const historyMap = {};
    for (const row of history) {
      (historyMap[row.custom_request_id] ||= []).push(row);
    }

    res.json(rows.map(row => ({
      ...row,
      history: historyMap[row.id] || []
    })));
  } catch (error) {
    next(error);
  }
});

router.get("/admin", authenticate, requireRole("admin"), async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, user_id, team_name, contact_name, whatsapp, team_size,
              brief, reference_url, status, created_at, updated_at
       FROM custom_requests
       ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.get("/admin/:id", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query(
      `SELECT id, user_id, team_name, contact_name, whatsapp, team_size,
              brief, reference_url, status, created_at, updated_at
       FROM custom_requests
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    if (!rows.length) return res.status(404).json({ message: "Custom request not found." });
    const [history] = await pool.query(
      `SELECT status,note,created_at
       FROM custom_status_history
       WHERE custom_request_id=?
       ORDER BY created_at ASC,id ASC`,
      [id]
    );

    res.json({ ...rows[0], history });
  } catch (error) {
    next(error);
  }
});

router.put("/admin/:id/status", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const allowed = [
      "consultation",
      "designing",
      "revision",
      "approved",
      "po",
      "production",
      "completed"
    ];
    const status = String(req.body.status || "");

    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Invalid custom request status." });
    }

    const [currentRows] = await pool.query(
      "SELECT status FROM custom_requests WHERE id=? LIMIT 1",
      [id]
    );

    if (!currentRows.length) {
      return res.status(404).json({ message: "Custom request not found." });
    }

    const previousStatus = currentRows[0].status;

    const [result] = await pool.query(
      "UPDATE custom_requests SET status = ? WHERE id = ?",
      [status, id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Custom request not found." });
    }

    if (previousStatus !== status) {
      await pool.query(
        `INSERT INTO custom_status_history(custom_request_id,status,note)
         VALUES (?, ?, ?)`,
        [id, status, `Status changed from ${previousStatus} to ${status}`]
      );
    }

    res.json({ message: "Custom request status updated.", status });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

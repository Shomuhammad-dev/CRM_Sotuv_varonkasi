import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();
router.use(requireAuth);

const SELECT_BASE = `
  SELECT r.id, r.lead_id, l.full_name AS lead_full_name, r.operator_id,
         u.display_name AS operator_name, r.remind_at, r.note, r.status
  FROM reminders r
  JOIN leads l ON l.id = r.lead_id
  LEFT JOIN users u ON u.id = r.operator_id
`;

// Operator faqat o'ziga biriktirilgan liddagi eslatmalarni ko'ra/qo'sha oladi —
// GET /api/leads, PUT /api/leads/:id va leadComments.js dagi bilan bir xil qoida.
async function loadLeadForAccess(req, res) {
  const leadId = Number(req.body?.lead_id);
  const { rows } = await pool.query(
    "SELECT id, assigned_operator_id FROM leads WHERE id = $1",
    [leadId]
  );
  const lead = rows[0];
  if (!lead) {
    res.status(404).json({ error: "Lid topilmadi" });
    return null;
  }
  if (req.user.role === "operator" && lead.assigned_operator_id !== req.user.id) {
    res.status(403).json({ error: "Bu lid sizga biriktirilmagan" });
    return null;
  }
  return lead;
}

// ── GET /api/reminders ────────────────────────
// Operator: faqat o'z eslatmalari. Admin: barcha operatorlarniki.
// Ikkalasida ham: status='pending' va remind_at <= hozir + 24 soat.
router.get("/", asyncHandler(async (req, res) => {
  const params = [];
  let where = "WHERE r.status = 'pending' AND r.remind_at <= NOW() + INTERVAL '24 hours'";
  if (req.user.role === "operator") {
    params.push(req.user.id);
    where += ` AND r.operator_id = $${params.length}`;
  }

  const { rows } = await pool.query(
    `${SELECT_BASE} ${where} ORDER BY r.remind_at ASC`,
    params
  );
  res.json(rows);
}));

// ── GET /api/reminders/count ──────────────────
// Bell ikonkasi uchun — bugungi status='pending' eslatmalar soni.
router.get("/count", asyncHandler(async (req, res) => {
  const params = [];
  let where = "WHERE status = 'pending' AND remind_at::date = CURRENT_DATE";
  if (req.user.role === "operator") {
    params.push(req.user.id);
    where += ` AND operator_id = $${params.length}`;
  }

  const { rows } = await pool.query(
    `SELECT count(*)::int AS count FROM reminders ${where}`,
    params
  );
  res.json({ count: rows[0].count });
}));

// ── POST /api/reminders ───────────────────────
router.post("/", asyncHandler(async (req, res) => {
  const lead = await loadLeadForAccess(req, res);
  if (!lead) return;

  const remindAt = req.body?.remind_at ? new Date(req.body.remind_at) : null;
  if (!remindAt || Number.isNaN(remindAt.getTime())) {
    return res.status(400).json({ error: "remind_at noto'g'ri yoki bo'sh" });
  }

  const operatorId =
    req.user.role === "admin"
      ? Number(req.body?.operator_id) || req.user.id
      : req.user.id;

  const note = req.body?.note ?? null;

  const { rows } = await pool.query(
    `INSERT INTO reminders (lead_id, operator_id, remind_at, note)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [lead.id, operatorId, remindAt, note]
  );

  const { rows: saved } = await pool.query(
    `${SELECT_BASE} WHERE r.id = $1`,
    [rows[0].id]
  );
  res.status(201).json(saved[0]);
}));

// ── PATCH /api/reminders/:id ──────────────────
router.patch("/:id", asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const status = req.body?.status;
  if (status !== "done" && status !== "snoozed") {
    return res.status(400).json({ error: "status faqat 'done' yoki 'snoozed' bo'lishi mumkin" });
  }

  const { rows: existingRows } = await pool.query(
    "SELECT id, operator_id FROM reminders WHERE id = $1",
    [id]
  );
  const existing = existingRows[0];
  if (!existing) return res.status(404).json({ error: "Eslatma topilmadi" });

  if (req.user.role !== "admin" && existing.operator_id !== req.user.id) {
    return res.status(403).json({ error: "Bu eslatma sizga biriktirilmagan" });
  }

  const { rows } = await pool.query(
    status === "snoozed"
      ? `UPDATE reminders SET status = 'snoozed', remind_at = remind_at + INTERVAL '1 day' WHERE id = $1 RETURNING id`
      : `UPDATE reminders SET status = 'done' WHERE id = $1 RETURNING id`,
    [id]
  );

  const { rows: updated } = await pool.query(
    `${SELECT_BASE} WHERE r.id = $1`,
    [rows[0].id]
  );
  res.json(updated[0]);
}));

export default router;

import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();
router.use(requireAuth);

// Operator faqat o'ziga biriktirilgan liddagi izohlarni ko'ra/qo'sha oladi —
// GET /api/leads va PUT /api/leads/:id dagi bilan bir xil qoida.
async function loadLeadForAccess(req, res) {
  const leadId = Number(req.params.id);
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

// ── GET /api/leads/:id/comments ───────────────
router.get("/:id/comments", asyncHandler(async (req, res) => {
  const lead = await loadLeadForAccess(req, res);
  if (!lead) return;

  const { rows } = await pool.query(
    `SELECT c.id, c.text, c.created_at, u.display_name AS operator_name
     FROM lead_comments c
     LEFT JOIN users u ON u.id = c.operator_id
     WHERE c.lead_id = $1
     ORDER BY c.created_at DESC`,
    [lead.id]
  );
  res.json(rows);
}));

// ── POST /api/leads/:id/comments ──────────────
router.post("/:id/comments", asyncHandler(async (req, res) => {
  const lead = await loadLeadForAccess(req, res);
  if (!lead) return;

  const text = (req.body?.text || "").trim();
  if (!text) return res.status(400).json({ error: "Izoh matni bo'sh bo'lishi mumkin emas" });

  const { rows } = await pool.query(
    `INSERT INTO lead_comments (lead_id, operator_id, text)
     VALUES ($1, $2, $3)
     RETURNING id, text, created_at`,
    [lead.id, req.user.id, text]
  );

  res.status(201).json({ ...rows[0], operator_name: req.user.displayName });
}));

export default router;

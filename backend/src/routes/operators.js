import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, operator_number, display_name FROM users
     WHERE role = 'operator' ORDER BY operator_number`
  );
  res.json(
    rows.map((r) => ({ id: r.id, operatorNumber: r.operator_number, displayName: r.display_name }))
  );
}));

export default router;

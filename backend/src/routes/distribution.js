import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();
router.use(requireAuth);

// Excel import orqali kelgan "Qaysi fanlarga qiziqasiz" ustuni erkin matn
// bo'lgani uchun ko'plab imlo variantlari mavjud (masalan "ingliz tiliga
// ko'proq", "ingliz tilli"). Shu sabab aniq moslik o'rniga har bir fan
// uchun kichik-katta harflarga sezgir bo'lmagan "ildiz" (stem) qidiruvi
// ishlatiladi. Ro'yxatda yo'q fanlar uchun o'z nomining kichik harfdagi
// shakli ishlatiladi (haqiqiy ma'lumotda ular uchun imlo xatosi topilmadi).
const SUBJECT_STEMS = {
  "Ingliz tili": ["ingliz"],
  "Matematika": ["matematik"],
  "Rus tili": ["rus t"],
  "Kimyo": ["kimyo"],
  "Fizika": ["fizik"],
  "Biologiya": ["bio"],
  "Informatika": ["informati", "it"],
  "Tarix": ["tarix"],
};

function subjectStems(subject) {
  return SUBJECT_STEMS[subject] || [subject.toLowerCase()];
}

// ── POST /api/distribute (admin) ──────────────
// "Vazifa" sahifasi: fan (subjects) va sinf (grade) bo'yicha filtrlangan,
// hali operatorga biriktirilmagan lidlarni operatorlar orasida teng
// taqsimlaydi. IRON RULE — leads.js dagi /leads/distribute bilan bir xil
// qoida: faqat assigned_operator_id IS NULL bo'lgan lidlar taqsimlanadi,
// allaqachon biriktirilganlar (oldingi Vazifa yurishlaridan yoki boshqa
// yo'l bilan) hech qachon qayta yozilmaydi — har bir filtr partiyasi
// mustaqil, oldingi partiyalar bilan kesishmaydi.
router.post("/", requireAdmin, asyncHandler(async (req, res) => {
  const { subjectFilter, gradeFilter } = req.body || {};

  if (gradeFilter != null && gradeFilter !== "" && !/^\d+$/.test(String(gradeFilter))) {
    return res.status(400).json({ error: "gradeFilter faqat raqam bo'lishi kerak" });
  }

  const { rows: operatorRows } = await pool.query(
    `SELECT id, display_name FROM users WHERE role = 'operator' ORDER BY operator_number`
  );
  if (operatorRows.length === 0) {
    return res.status(400).json({ error: "Operatorlar topilmadi" });
  }

  const params = [];
  const conditions = ["assigned_operator_id IS NULL"];
  if (subjectFilter) {
    const patterns = subjectStems(subjectFilter).map((stem) => `%${stem}%`);
    params.push(patterns);
    conditions.push(`EXISTS (SELECT 1 FROM unnest(subjects) AS sub WHERE sub ILIKE ANY($${params.length}::text[]))`);
  }
  if (gradeFilter != null && gradeFilter !== "") {
    params.push(String(gradeFilter));
    conditions.push(`substring(grade FROM '^[0-9]+') = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows: matchedRows } = await pool.query(
    `SELECT id FROM leads ${where} ORDER BY id ASC`,
    params
  );

  if (matchedRows.length === 0) {
    return res.json({
      distributed: operatorRows.map((o) => ({ operatorId: o.id, displayName: o.display_name, count: 0, studentIds: [] })),
      totalMatched: 0,
      distributedCount: 0,
    });
  }

  const base = Math.floor(matchedRows.length / operatorRows.length);
  const remainder = matchedRows.length % operatorRows.length;

  const distributed = [];
  const leadIds = [];
  const operatorIds = [];
  let cursor = 0;
  operatorRows.forEach((op, i) => {
    const take = base + (i < remainder ? 1 : 0);
    const chunk = matchedRows.slice(cursor, cursor + take).map((r) => r.id);
    cursor += take;
    distributed.push({ operatorId: op.id, displayName: op.display_name, count: chunk.length, studentIds: chunk });
    for (const id of chunk) {
      leadIds.push(id);
      operatorIds.push(op.id);
    }
  });

  const client = await pool.connect();
  let updatedCount = 0;
  try {
    await client.query("BEGIN");
    const { rowCount } = await client.query(
      `UPDATE leads AS l
         SET assigned_operator_id = v.operator_id, updated_at = now()
       FROM (SELECT unnest($1::int[]) AS id, unnest($2::int[]) AS operator_id) AS v
       WHERE l.id = v.id AND l.assigned_operator_id IS NULL`,
      [leadIds, operatorIds]
    );
    updatedCount = rowCount;
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  res.json({ distributed, totalMatched: matchedRows.length, distributedCount: updatedCount });
}));

export default router;

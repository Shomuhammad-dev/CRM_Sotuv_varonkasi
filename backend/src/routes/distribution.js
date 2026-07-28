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
  "Ona tili": ["ona t"],
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
  const { subjectFilter, gradeFilter, operatorId } = req.body || {};

  if (gradeFilter != null && gradeFilter !== "" && !/^\d+$/.test(String(gradeFilter))) {
    return res.status(400).json({ error: "gradeFilter faqat raqam bo'lishi kerak" });
  }

  const { rows: operatorRows } = await pool.query(
    `SELECT id, display_name FROM users WHERE role = 'operator' ORDER BY operator_number`
  );
  if (operatorRows.length === 0) {
    return res.status(400).json({ error: "Operatorlar topilmadi" });
  }

  // operatorId qiymati 3 xil kelishi mumkin:
  //   null / ""        → standart: barcha operatorlarga teng bo'linish
  //   raqam / string   → bitta operatorga to'liq biriktirish (oldingi xulq-atvor)
  //   massiv (number[])→ ko'p tanlangan: faqat shular orasida teng bo'linish (yangi)
  //
  // targetOps === null  →  barcha operatorlar (standart rejim)
  // targetOps === array →  faqat tanlangan operatorlar
  let targetOps = null;

  if (Array.isArray(operatorId) && operatorId.length > 0) {
    // Ko'p tanlov rejimi
    const ids = operatorId.map(Number).filter((n) => !isNaN(n) && n > 0);
    if (ids.length === 0) {
      return res.status(400).json({ error: "operatorId massivi bo'sh yoki noto'g'ri" });
    }
    targetOps = operatorRows.filter((o) => ids.includes(o.id));
    if (targetOps.length !== ids.length) {
      return res.status(400).json({ error: "Bir yoki bir nechta operator topilmadi" });
    }
  } else if (operatorId != null && operatorId !== "") {
    // Bitta operator rejimi (oldingi xulq-atvor — o'zgarishsiz)
    const single = operatorRows.find((o) => o.id === Number(operatorId));
    if (!single) {
      return res.status(400).json({ error: "Operator topilmadi" });
    }
    targetOps = [single];
  }
  // targetOps === null → standart (barcha operatorlar)

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

  // Taqsimlashda ishlatiluvchi operatorlar ro'yxati
  const opsToUse = targetOps || operatorRows;

  if (matchedRows.length === 0) {
    return res.json({
      distributed: opsToUse.map((o) => ({ operatorId: o.id, displayName: o.display_name, count: 0, studentIds: [] })),
      totalMatched: 0,
      distributedCount: 0,
    });
  }

  let distributed;
  let updatedCount = 0;

  if (targetOps && targetOps.length === 1) {
    // ── Bitta operatorga to'liq biriktirish rejimi (oldingi xulq-atvor — o'zgarishsiz) ──
    // Barcha mos (hali biriktirilmagan) lidlar bitta atomik so'rov bilan shu operatorga
    // yoziladi. assigned_operator_id IS NULL tekshiruvi allaqachon biriktirilgan lidlarni
    // qayta yozilishdan himoya qiladi.
    const op = targetOps[0];
    const leadIds = matchedRows.map((r) => r.id);
    distributed = [{
      operatorId: op.id,
      displayName: op.display_name,
      count: leadIds.length,
      studentIds: leadIds,
    }];

    const { rowCount } = await pool.query(
      `UPDATE leads SET assigned_operator_id = $1, updated_at = now()
       WHERE id = ANY($2::int[]) AND assigned_operator_id IS NULL`,
      [op.id, leadIds]
    );
    updatedCount = rowCount;
  } else {
    // ── Teng bo'linish rejimi ──────────────────────────────────────────────────────────
    // Standart (targetOps === null): barcha operatorlar — oldingi xulq-atvor o'zgarishsiz.
    // Ko'p tanlov (targetOps.length > 1): faqat tanlangan operatorlar orasida teng bo'linish.
    // Ikki holatda ham qoldiq (remainder) birinchi operatorlarga +1 beriladi.
    // assigned_operator_id IS NULL tekshiruvi allaqachon biriktirilgan lidlarni himoya qiladi.
    const base = Math.floor(matchedRows.length / opsToUse.length);
    const remainder = matchedRows.length % opsToUse.length;

    distributed = [];
    const leadIds = [];
    const operatorIds = [];
    let cursor = 0;
    opsToUse.forEach((op, i) => {
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
  }

  res.json({ distributed, totalMatched: matchedRows.length, distributedCount: updatedCount });
}));

export default router;

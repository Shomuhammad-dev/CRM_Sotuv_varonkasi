import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { safeRedis } from "../redis.js";

const router = Router();
router.use(requireAuth);

// "Rad etdi arxivi" uchun kerakli ustunlar — fayl cheklovi tufayli
// schema.sql ga tegilmaydi, shu sabab server ishga tushganda runtime'da
// (idempotent, IF NOT EXISTS bilan) qo'shiladi.
pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS lost_at TIMESTAMPTZ`)
  .catch((err) => console.error("✘ leads.lost_at ustunini qo'shishda xatolik:", err.message));
pool.query(`ALTER TABLE lead_archive ADD COLUMN IF NOT EXISTS notes TEXT`)
  .catch((err) => console.error("✘ lead_archive.notes ustunini qo'shishda xatolik:", err.message));
pool.query(`ALTER TABLE lead_archive ADD COLUMN IF NOT EXISTS lost_at TIMESTAMPTZ`)
  .catch((err) => console.error("✘ lead_archive.lost_at ustunini qo'shishda xatolik:", err.message));
pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS won_at TIMESTAMPTZ`)
  .catch((err) => console.error("✘ leads.won_at ustunini qo'shishda xatolik:", err.message));
pool.query(`ALTER TABLE lead_archive ADD COLUMN IF NOT EXISTS won_at TIMESTAMPTZ`)
  .catch((err) => console.error("✘ lead_archive.won_at ustunini qo'shishda xatolik:", err.message));

const CACHE_SET = "leads_cache_keys";
const CACHE_TTL = Number(process.env.LEADS_CACHE_TTL_SEC || 20);

function leadsCacheKey(req) {
  if (req.user.role === "admin") {
    return req.query.operator ? `leads:admin:op:${req.query.operator}` : "leads:admin:all";
  }
  return `leads:operator:${req.user.id}`;
}

function toApi(row) {
  return {
    id: row.id,
    no: row.id,
    stage: row.stage,
    district: row.district || "",
    fullName: row.full_name,
    school: row.school || "",
    grade: row.grade || "",
    sector: row.sector || "",
    futureProfession: row.future_profession || "",
    subjects: row.subjects || [],
    prevCenter: row.prev_center || "",
    notes: row.notes || "",
    phonePersonal: row.phone_personal || "",
    phoneFather: row.phone_father || "",
    phoneMother: row.phone_mother || "",
    assignedOperatorId: row.assigned_operator_id,
    operatorName: row.operator_name || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── GET /api/leads ──────────────────────────
router.get("/", asyncHandler(async (req, res) => {
  const params = [];
  let where = "";

  if (req.user.role === "admin") {
    if (req.query.operator) {
      params.push(req.query.operator);
      where = `WHERE l.assigned_operator_id = $${params.length}`;
    }
  } else {
    params.push(req.user.id);
    where = `WHERE l.assigned_operator_id = $${params.length}`;
  }

  const cacheKey = leadsCacheKey(req);
  const cached = await safeRedis.get(cacheKey);
  if (cached) return res.json(JSON.parse(cached));

  const { rows } = await pool.query(
    `SELECT l.*, u.display_name AS operator_name
     FROM leads l
     LEFT JOIN users u ON u.id = l.assigned_operator_id
     ${where}
     ORDER BY l.full_name ASC`,
    params
  );

  const result = rows.map(toApi);
  await safeRedis.cacheSet(cacheKey, JSON.stringify(result), CACHE_TTL, CACHE_SET);
  res.json(result);
}));

// ── GET /api/leads/archive?finalStage=lost|won (admin, Hisobot arxivlari) ──
// "lost" — lost_at (haqiqiy "rad etildi" payti), "won" — won_at (haqiqiy
// "a'zo bo'ldi" payti) ustunidan foydalanadi. COALESCE javob shaklini
// (archivedAt) o'zgartirmaydi — HisobotPage.jsx buni bilmaydi ham,
// shu sabab frontendga tegmasdan aniqroq sana ko'rsatiladi. processed_at
// faqat ikkalasi ham mavjud bo'lmagan (eski) yozuvlar uchun zaxira.
router.get("/archive", requireAdmin, asyncHandler(async (req, res) => {
  const finalStage = req.query.finalStage === "won" ? "won" : "lost";
  const { rows } = await pool.query(
    `SELECT id, full_name, subjects, future_profession, notes, operator_name,
            COALESCE(lost_at, won_at, processed_at) AS archived_at
     FROM lead_archive
     WHERE final_stage = $1
     ORDER BY archived_at DESC NULLS LAST`,
    [finalStage]
  );
  res.json(rows.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    subjects: r.subjects || [],
    futureProfession: r.future_profession || "",
    notes: r.notes || "",
    operatorName: r.operator_name || null,
    archivedAt: r.archived_at,
  })));
}));

// ── GET /api/leads/activity (admin, Reja: Kunlik/Haftalik/Oylik) ──
function periodStart(period) {
  const now = new Date();
  if (period === "daily") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "weekly") {
    const day = now.getDay(); // 0=Yakshanba
    const diffToMonday = day === 0 ? 6 : day - 1;
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
  }
  if (period === "monthly") return new Date(now.getFullYear(), now.getMonth(), 1);
  return null;
}

router.get("/activity", requireAdmin, asyncHandler(async (req, res) => {
  const period = req.query.period;
  const start = periodStart(period);
  if (!start) {
    return res.status(400).json({ error: "period daily, weekly yoki monthly bo'lishi kerak" });
  }

  const { rows } = await pool.query(
    `SELECT operator_id, to_stage, count(*)::int AS cnt
     FROM lead_stage_history
     WHERE changed_at >= $1
     GROUP BY operator_id, to_stage`,
    [start]
  );

  const { rows: operatorRows } = await pool.query(
    `SELECT id, display_name FROM users WHERE role = 'operator' ORDER BY operator_number`
  );

  const byOperator = new Map(
    operatorRows.map((o) => [o.id, { operatorId: o.id, displayName: o.display_name, byStage: {} }])
  );
  const unassigned = { operatorId: null, displayName: "Biriktirilmagan", byStage: {} };

  for (const r of rows) {
    const target = r.operator_id == null ? unassigned : byOperator.get(r.operator_id);
    if (target) target.byStage[r.to_stage] = r.cnt;
  }

  res.json({
    period,
    since: start.toISOString(),
    operators: [...byOperator.values()],
    unassigned: Object.keys(unassigned.byStage).length ? unassigned : null,
  });
}));

// ── POST /api/leads ──────────────────────────
router.post("/", asyncHandler(async (req, res) => {
  const b = req.body || {};
  if (!b.fullName?.trim()) {
    return res.status(400).json({ error: "Ism/Familya majburiy" });
  }

  const assignedOperatorId =
    req.user.role === "operator" ? req.user.id : b.assignedOperatorId ?? null;

  const { rows } = await pool.query(
    `INSERT INTO leads
       (stage, district, full_name, school, grade, sector, future_profession,
        subjects, prev_center, notes, phone_personal, phone_father, phone_mother,
        assigned_operator_id, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING *`,
    [
      b.stage || "new",
      b.district || null,
      b.fullName.trim(),
      b.school || null,
      b.grade || null,
      b.sector || null,
      b.futureProfession || null,
      b.subjects || [],
      b.prevCenter || null,
      b.notes || null,
      b.phonePersonal?.trim() || null,
      b.phoneFather || null,
      b.phoneMother || null,
      assignedOperatorId,
      req.user.id,
    ]
  );

  await safeRedis.invalidateCacheSet(CACHE_SET);
  res.status(201).json(toApi(rows[0]));
}));

// ── PUT /api/leads/:id ────────────────────────
router.put("/:id", asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { rows: existingRows } = await pool.query("SELECT * FROM leads WHERE id = $1", [id]);
  const existing = existingRows[0];
  if (!existing) return res.status(404).json({ error: "Lid topilmadi" });

  if (req.user.role === "operator" && existing.assigned_operator_id !== req.user.id) {
    return res.status(403).json({ error: "Bu lid sizga biriktirilmagan" });
  }

  const b = req.body || {};
  const merged = {
    stage: b.stage ?? existing.stage,
    district: b.district ?? existing.district,
    full_name: b.fullName ?? existing.full_name,
    school: b.school ?? existing.school,
    grade: b.grade ?? existing.grade,
    sector: b.sector ?? existing.sector,
    future_profession: b.futureProfession ?? existing.future_profession,
    subjects: b.subjects ?? existing.subjects,
    prev_center: b.prevCenter ?? existing.prev_center,
    notes: b.notes ?? existing.notes,
    phone_personal: b.phonePersonal ?? existing.phone_personal,
    phone_father: b.phoneFather ?? existing.phone_father,
    phone_mother: b.phoneMother ?? existing.phone_mother,
  };

  const stageChanged = merged.stage !== existing.stage;

  // AMO CRM uslubida: "won" ham, "lost" ham oddiy bosqich — lid darhol
  // arxivlanmaydi, kanban board'da ko'rinishda davom etadi. Arxivlash
  // faqat tungi cron orqali (00:00–08:00 oralig'ida, quyidagi
  // archiveOldFinalLeads() funksiyasida) amalga oshiriladi.

  // "lost"/"won"ga kirganda tegishli vaqt belgilanadi (cron shundan
  // hisoblaydi); bosqichdan chiqsa tozalanadi; bosqich o'zgarmasa
  // saqlanib qoladi (masalan lid hali shu bosqichda turib, faqat izohi
  // tahrirlansa).
  let lostAt = existing.lost_at;
  let wonAt = existing.won_at;
  if (stageChanged) {
    if (merged.stage === "lost") lostAt = new Date();
    else if (existing.stage === "lost") lostAt = null;

    if (merged.stage === "won") wonAt = new Date();
    else if (existing.stage === "won") wonAt = null;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `UPDATE leads SET
         stage=$1, district=$2, full_name=$3, school=$4, grade=$5, sector=$6,
         future_profession=$7, subjects=$8, prev_center=$9, notes=$10, phone_personal=$11,
         phone_father=$12, phone_mother=$13, lost_at=$14, won_at=$15, updated_at=now()
       WHERE id=$16
       RETURNING *`,
      [
        merged.stage, merged.district, merged.full_name, merged.school, merged.grade,
        merged.sector, merged.future_profession, merged.subjects, merged.prev_center,
        merged.notes, merged.phone_personal, merged.phone_father, merged.phone_mother,
        lostAt, wonAt, id,
      ]
    );
    const updated = rows[0];

    if (stageChanged) {
      await client.query(
        `INSERT INTO lead_stage_history (lead_id, operator_id, from_stage, to_stage, changed_by)
         VALUES ($1,$2,$3,$4,$5)`,
        [id, existing.assigned_operator_id, existing.stage, merged.stage, req.user.id]
      );
    }
    await client.query("COMMIT");
    await safeRedis.invalidateCacheSet(CACHE_SET);
    res.json(toApi(updated));
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}));

// ── PATCH /api/leads/:id/assign (admin) ───────
// IRON RULE: lid bir marta operatorga biriktirilgach, boshqa operatorga
// (yoki bo'sh holatga) hech qachon qayta yozilmaydi — shu sabab UPDATE
// faqat hozircha biriktirilmagan (assigned_operator_id IS NULL) lidlarda
// ishlaydi. Allaqachon biriktirilgan lidga urinish 409 bilan rad etiladi.
router.patch("/:id/assign", requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { operatorId } = req.body || {};
  if (!operatorId) return res.status(400).json({ error: "Operator tanlanmagan" });

  const { rows } = await pool.query(
    `UPDATE leads SET assigned_operator_id = $1, updated_at = now()
     WHERE id = $2 AND assigned_operator_id IS NULL
     RETURNING *`,
    [operatorId, id]
  );

  if (rows[0]) {
    await safeRedis.invalidateCacheSet(CACHE_SET);
    return res.json(toApi(rows[0]));
  }

  const { rows: existingRows } = await pool.query("SELECT id FROM leads WHERE id = $1", [id]);
  if (!existingRows[0]) return res.status(404).json({ error: "Lid topilmadi" });
  return res.status(409).json({ error: "Bu lid allaqachon operatorga biriktirilgan, uni o'zgartirib bo'lmaydi" });
}));

// ── DELETE /api/leads/:id (admin) ─────────────
router.delete("/:id", requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await pool.query("DELETE FROM leads WHERE id = $1 RETURNING id", [id]);
  if (!rows[0]) return res.status(404).json({ error: "Lid topilmadi" });
  await safeRedis.invalidateCacheSet(CACHE_SET);
  res.json({ id: rows[0].id });
}));

// ── POST /api/leads/bulk-delete (admin) ───────
router.post("/bulk-delete", requireAdmin, asyncHandler(async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isInteger) : [];
  if (ids.length === 0) return res.status(400).json({ error: "O'chirish uchun lidlar tanlanmagan" });

  const { rowCount } = await pool.query("DELETE FROM leads WHERE id = ANY($1::int[])", [ids]);
  await safeRedis.invalidateCacheSet(CACHE_SET);
  res.json({ deleted: rowCount });
}));

// ── POST /api/leads/bulk-assign (admin) ───────
// IRON RULE: faqat hozircha biriktirilmagan lidlar yangilanadi — allaqachon
// operatorga biriktirilgan lidlar tanlovda bo'lsa ham o'zgarmaydi (`skipped`
// sonida qaytariladi).
router.post("/bulk-assign", requireAdmin, asyncHandler(async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isInteger) : [];
  const { operatorId } = req.body || {};
  if (ids.length === 0) return res.status(400).json({ error: "Biriktirish uchun lidlar tanlanmagan" });
  if (!operatorId) return res.status(400).json({ error: "Operator tanlanmagan" });

  const { rowCount } = await pool.query(
    `UPDATE leads SET assigned_operator_id = $1, updated_at = now()
     WHERE id = ANY($2::int[]) AND assigned_operator_id IS NULL`,
    [operatorId, ids]
  );
  await safeRedis.invalidateCacheSet(CACHE_SET);
  res.json({ assigned: rowCount, skipped: ids.length - rowCount });
}));

// ── POST /api/leads/distribute (admin) ────────
// Faqat HALI HECH KIMGA BIRIKTIRILMAGAN (assigned_operator_id IS NULL)
// lidlarni ID bo'yicha o'sish tartibida operatorlar orasida ketma-ket
// bloklarga bo'lib taqsimlaydi: har operatorga Math.ceil(jami/operatorlar
// soni) tadan, oxirgi operatorga esa qolgan qismi tegadi. Allaqachon
// biror operatorga biriktirilgan lid HECH QACHON qayta yozilmaydi — bu
// shart ham tanlovdagi SELECT'da (WHERE assigned_operator_id IS NULL),
// ham yakuniy UPDATE'da takror tekshiriladi (concurrent chaqiruvlardan
// himoya uchun). Barcha yozuvlar bitta UPDATE (loopda emas) va bitta
// tranzaksiya ichida saqlanadi.
router.post("/distribute", requireAdmin, asyncHandler(async (req, res) => {
  const { rows: operatorRows } = await pool.query(
    `SELECT id, display_name FROM users WHERE role = 'operator' ORDER BY operator_number`
  );
  if (operatorRows.length === 0) {
    return res.status(400).json({ error: "Operatorlar topilmadi" });
  }

  const { rows: unassignedRows } = await pool.query(
    `SELECT id FROM leads WHERE assigned_operator_id IS NULL ORDER BY id ASC`
  );

  if (unassignedRows.length === 0) {
    return res.json({
      distributed: 0,
      message: "Barcha lidlar allaqachon taqsimlangan",
      perOperator: operatorRows.map((o) => ({ operatorId: o.id, displayName: o.display_name, count: 0 })),
    });
  }

  const perOperator = Math.ceil(unassignedRows.length / operatorRows.length);
  const leadIds = [];
  const operatorIds = [];
  const newlyAssigned = new Map(operatorRows.map((o) => [o.id, 0]));

  operatorRows.forEach((op, i) => {
    const chunk = unassignedRows.slice(i * perOperator, (i + 1) * perOperator);
    for (const lead of chunk) {
      leadIds.push(lead.id);
      operatorIds.push(op.id);
    }
    newlyAssigned.set(op.id, chunk.length);
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
  await safeRedis.invalidateCacheSet(CACHE_SET);

  res.json({
    distributed: updatedCount,
    perOperator: operatorRows.map((o) => ({
      operatorId: o.id,
      displayName: o.display_name,
      count: newlyAssigned.get(o.id),
    })),
  });
}));

// Ikki lidni "bir xil" deb hisoblash uchun imzo — ism+maktab+sinf+ikkala
// telefon. Excel import paytida shu imzo bo'yicha allaqachon bazada bor
// (yoki shu faylning o'zida takrorlangan) qatorlarni avtomatik o'tkazib
// yuborish uchun ishlatiladi (bir xil fayl tasodifan qayta yuklansa ham
// dublikat kelib chiqmasligi uchun).
function leadSignature(fullName, school, grade, phonePersonal, phoneFather) {
  const norm = (v) => (v || "").toString().trim();
  return [norm(fullName), norm(school), norm(grade), norm(phonePersonal), norm(phoneFather)].join("|");
}

// ── POST /api/leads/import (admin, bulk) ──────
router.post("/import", requireAdmin, asyncHandler(async (req, res) => {
  const { rows: importRows, defaultOperatorId } = req.body || {};
  if (!Array.isArray(importRows) || importRows.length === 0) {
    return res.status(400).json({ error: "Import uchun qatorlar topilmadi" });
  }

  const { rows: existingRows } = await pool.query(
    "SELECT full_name, school, grade, phone_personal, phone_father FROM leads"
  );
  const seen = new Set(
    existingRows.map((r) => leadSignature(r.full_name, r.school, r.grade, r.phone_personal, r.phone_father))
  );

  const client = await pool.connect();
  let inserted = 0;
  let skipped = 0;
  let duplicates = 0;

  try {
    await client.query("BEGIN");
    for (const b of importRows) {
      const fullName = (b.fullName || "").trim();
      const phonePersonal = (b.phonePersonal || "").trim();
      if (!fullName) {
        skipped++;
        continue;
      }

      const signature = leadSignature(fullName, b.school, b.grade, phonePersonal, b.phoneFather);
      if (seen.has(signature)) {
        duplicates++;
        continue;
      }
      seen.add(signature);

      await client.query(
        `INSERT INTO leads
           (stage, district, full_name, school, grade, sector, future_profession,
            subjects, prev_center, phone_personal, phone_father, phone_mother,
            assigned_operator_id, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          "new",
          b.district || null,
          fullName,
          b.school || null,
          b.grade || null,
          b.sector || null,
          b.futureProfession || null,
          Array.isArray(b.subjects) ? b.subjects : [],
          b.prevCenter || null,
          phonePersonal || null,
          b.phoneFather || null,
          b.phoneMother || null,
          defaultOperatorId || null,
          req.user.id,
        ]
      );
      inserted++;
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  await safeRedis.invalidateCacheSet(CACHE_SET);
  const { rows: totalRows } = await pool.query("SELECT COUNT(*)::int AS total FROM leads");
  res.status(201).json({ inserted, skipped, duplicates, totalLeads: totalRows[0].total });
}));

// ── POST /api/leads/wipe-all (admin, Sozlamalar > Tarixni tozalash) ──
// Barcha lidlar va ularning bosqich tarixini butunlay o'chiradi.
// `users` jadvaliga tegilmaydi — login/parollar saqlanib qoladi.
router.post("/wipe-all", requireAdmin, asyncHandler(async (req, res) => {
  await pool.query("TRUNCATE leads RESTART IDENTITY CASCADE");
  await safeRedis.invalidateCacheSet(CACHE_SET);
  res.json({ ok: true });
}));

// ── "Rad etdi" + "A'zo bo'ldi" arxivlash job ───
// Kunlik 00:00–08:00 oralig'ida (tekshiruv callback ichida, cron jadvali
// sifatida emas — node-cron o'rnatilmagan) ikkalasini ham arxivlaydi:
// - "lost": lost_at dan 24 soatdan ortiq o'tgan bo'lsa.
// - "won": won_at qo'yilgan bo'lsa (qo'shimcha 24 soatlik kutish yo'q —
//   faqat tungi oynani kutadi).
// Har bir lid uchun copy+delete BITTA tranzaksiyada — nusxa muvaffaqiyatli
// bo'lmasa o'chirilmaydi. Bitta lidning xatosi qolganlarini to'xtatmaydi.
async function archiveOldFinalLeads() {
  const hour = new Date().getHours();
  if (hour < 0 || hour >= 8) return;

  const { rows: lostCandidates } = await pool.query(
    `SELECT l.*, u.display_name AS operator_name, 'lost' AS archive_stage
     FROM leads l
     LEFT JOIN users u ON u.id = l.assigned_operator_id
     WHERE l.stage = 'lost' AND l.lost_at IS NOT NULL AND l.lost_at < NOW() - INTERVAL '24 hours'`
  );
  const { rows: wonCandidates } = await pool.query(
    `SELECT l.*, u.display_name AS operator_name, 'won' AS archive_stage
     FROM leads l
     LEFT JOIN users u ON u.id = l.assigned_operator_id
     WHERE l.stage = 'won' AND l.won_at IS NOT NULL`
  );
  const candidates = [...lostCandidates, ...wonCandidates];
  if (candidates.length === 0) return;

  let archivedLost = 0;
  let archivedWon = 0;
  for (const lead of candidates) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { rows: commentRows } = await client.query(
        `SELECT lc.text, u.display_name AS operator_name, lc.created_at
         FROM lead_comments lc
         LEFT JOIN users u ON u.id = lc.operator_id
         WHERE lc.lead_id = $1
         ORDER BY lc.created_at ASC`,
        [lead.id]
      );

      // 1. Nusxa — lead_archive'ga
      await client.query(
        `INSERT INTO lead_archive
           (original_lead_id, full_name, phone_personal, phone_father, phone_mother,
            district, school, grade, sector, subjects, prev_center, future_profession,
            notes, final_stage, operator_id, operator_name, comments, assigned_at, lost_at, won_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
        [
          lead.id,
          lead.full_name,
          lead.phone_personal,
          lead.phone_father,
          lead.phone_mother,
          lead.district,
          lead.school,
          lead.grade,
          lead.sector,
          lead.subjects || [],
          lead.prev_center,
          lead.future_profession,
          lead.notes,
          lead.archive_stage,
          lead.assigned_operator_id,
          lead.operator_name,
          JSON.stringify(commentRows),
          lead.updated_at,
          lead.lost_at,
          lead.won_at,
        ]
      );

      // 2. Nusxa tasdiqlangandan keyingina o'chirish — shu bilan bitta
      // tranzaksiya, shu sabab COMMIT bo'lmaguncha hech narsa yo'qolmaydi.
      await client.query("DELETE FROM leads WHERE id = $1", [lead.id]);

      await client.query("COMMIT");
      if (lead.archive_stage === "lost") archivedLost++; else archivedWon++;
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`✘ Lid #${lead.id} ("${lead.archive_stage}" arxivi) arxivlashda xatolik:`, err.message);
    } finally {
      client.release();
    }
  }

  const archivedCount = archivedLost + archivedWon;
  if (archivedCount > 0) {
    await safeRedis.invalidateCacheSet(CACHE_SET);
  }
  console.log(`✔ Arxivlash: ${archivedLost} ta "Rad etdi" + ${archivedWon} ta "A'zo bo'ldi" = ${archivedCount}/${candidates.length} ta lid arxivlandi (${new Date().toISOString()})`);
}

const ARCHIVE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // har soatda tekshiradi
setInterval(() => {
  archiveOldFinalLeads().catch((err) => console.error("✘ Arxivlash job xatosi:", err.message));
}, ARCHIVE_CHECK_INTERVAL_MS);

export default router;

// ─────────────────────────────────────────────
// Jadval ko'rinishi — katta hajmdagi ma'lumot uchun
// responsive: gorizontal scroll + "yopishqoq" (sticky) ustunlar
// Excel import — faqat admin
// ─────────────────────────────────────────────

import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  Upload, X, Loader2, AlertCircle, CheckCircle2,
  ChevronLeft, ChevronRight, FileSpreadsheet, Shuffle,
  UserCheck, Trash2, Filter,
} from "lucide-react";
import { STAGES, STAGE_STYLES } from "./constants";
import { api } from "./api";
import { useLanguage } from "./LanguageContext";

const PAGE_SIZE = 50;

// Excel sarlavhalarini ichki maydon nomlariga moslashtirish.
// MUHIM: kalitlarda apostrof ishlatilmaydi — normalizeHeader() har qanday
// apostrof turini (', ’, ‘, ʼ, ʻ, `, ´ — o'zbekcha matnlarda ko'p uchraydi)
// butunlay olib tashlaydi, shu sabab "o'zbek", "oʻzbek", "o`zbek" barchasi
// bir xil "ozbek" ga tushadi.
const HEADER_MAP = {
  "no": "no",
  "tuman": "district",
  "ism/familya": "fullName",
  "ism familya": "fullName",
  "maktab": "school",
  "sinf": "grade",
  "ozbek/russ": "sector",
  "ozbek/rus": "sector",
  "kelajakda kim bolmoqchisiz": "futureProfession",
  "kelajakda kim bolmoqchsiz": "futureProfession", // "i" tushib qolgan yozilish varianti
  "qaysi fanlarga qiziqasiz": "subjects",
  "qaysi fanlarga qiziqasizlar": "subjects",
  "qaysi fanlarga qiziqasiz masalan ingiliz tili": "subjects", // to'liq sarlavha varianti
  "qiziqadigan fanlar": "subjects",
  "fanlar": "subjects",
  "fan": "subjects",
  "qiziqish": "subjects",
  "yo'nalish": "subjects",
  "yonalish": "subjects",
  "soha": "subjects",
  "qaysi oquv markazida qancha vaqt tayyorlangansiz": "prevCenter",
  "telefon raqam shaxsiy": "phonePersonal",
  "telefon raqam ota": "phoneFather",
  "telefon raqam ona": "phoneMother",
};

// Standart 12 ustunli tartib (rasmdagi sarlavhalar tartibi bilan bir xil).
// Agar ustun sarlavhasi bo'sh (masalan Excel'da birlashtirilgan katak
// sabab SheetJS uni "__EMPTY" deb nomlaydi) yoki tanilmagan yozilishda
// bo'lsa, va jami ustunlar soni aynan 12 ta bo'lsa, joylashuviga qarab
// zaxira sifatida mos maydon tayinlanadi.
const COLUMN_ORDER = [
  null, "district", "fullName", "school", "grade", "sector",
  "futureProfession", "subjects", "prevCenter",
  "phonePersonal", "phoneFather", "phoneMother",
];

// SheetJS bo'sh sarlavhali ustunlarni "__EMPTY", "__EMPTY_1", "__EMPTY_2"...
// deb nomlaydi (masalan Excel'da yashirin/formatlangan bo'sh ustunlar).
// Bular haqiqiy ma'lumot emas — qatordan butunlay olib tashlanadi, aks
// holda ular ham "notanish ustun" sifatida ko'rsatiladi, ham 12 ustunli
// pozitsion zaxira hisobini buzadi.
function stripEmptyColumns(row) {
  const cleaned = {};
  for (const [key, value] of Object.entries(row)) {
    // "__EMPTY"/"__EMPTY_1"... — sarlavha katakchasi umuman yo'q edi.
    // Bo'sh satr kaliti — sarlavha katakchasi bor, lekin matni bo'sh edi.
    // Ikkalasi ham haqiqiy ustun emas.
    if (/^__EMPTY(_\d+)?$/.test(key) || key.trim() === "") continue;
    cleaned[key] = value;
  }
  return cleaned;
}

function normalizeHeader(h) {
  return String(h || "")
    .toLowerCase()
    .replace(/['’‘ʼʻ`´]/g, "")   // barcha apostrof turlarini olib tashlash
    .replace(/\s*\/\s*/g, "/")   // "so'z / so'z" -> "so'z/so'z"
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[?.:]+$/g, "");    // oxiridagi ?, ., : belgilari
}

function mapExcelRow(rawRow) {
  const mapped = {
    district: "", fullName: "", school: "", grade: "", sector: "",
    futureProfession: "", subjects: [], prevCenter: "",
    phonePersonal: "", phoneFather: "", phoneMother: "",
  };
  const unmatched = [];
  const entries = Object.entries(rawRow);
  // Faqat ustunlar soni aniq kutilgan 12 taga teng bo'lsa pozitsiya
  // bo'yicha zaxiradan foydalanamiz — aks holda notanish tartibdagi
  // fayllarda noto'g'ri ustunga ma'lumot tushib qolishi mumkin.
  const usePositional = entries.length === COLUMN_ORDER.length;

  entries.forEach(([key, value], i) => {
    const norm = normalizeHeader(key);
    // Aniq moslik topilmasa — "fan" ildizini o'z ichiga olgan har qanday
    // sarlavha ("fanlarga", "fanni" va h.k.) ham subjects'ga tushadi.
    // HEADER_MAP'dagi boshqa hech bir ustun "fan" ildizini o'z ichiga
    // olmaydi, shu sabab bu xavfsiz zaxira.
    const nameField = HEADER_MAP[norm] || (norm.includes("fan") ? "subjects" : undefined);
    const isKnownPosition = usePositional && i < COLUMN_ORDER.length;
    const field = nameField || (isKnownPosition ? COLUMN_ORDER[i] : undefined);

    if (!nameField && !isKnownPosition) unmatched.push(key);
    if (!field || value === undefined || value === null || value === "") return;

    if (field === "no") return;
    if (field === "subjects") {
      mapped.subjects = String(value)
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      mapped[field] = String(value).trim();
    }
  });

  return { lead: mapped, unmatched };
}

const IMPORTED_FINGERPRINTS_KEY = "educrm_imported_file_fingerprints";

// Obyekt kalitlari tartibi barqaror bo'lishi uchun (JS raqamsimon
// kalitlarni avtomatik saralaydi, qolganlarini kiritilgan tartibda
// qoldiradi — shu aralashish bir xil qatorni turlicha JSON qilib
// qo'yishi mumkin edi) — kalitlarni saralab keyin JSON qilamiz.
function stableRowSignature(row) {
  const sorted = Object.keys(row || {}).sort().map((k) => [k, row[k]]);
  return JSON.stringify(sorted);
}

// Faqat birinchi qatorga tayanish yetarli emas — ikkita boshqa faylda
// birinchi qator tasodifan bir xil bo'lishi mumkin (masalan bir xil
// ismdan boshlanadigan alifbo tartibidagi eksport). Oxirgi qator ham
// qo'shilib, faylning "imzosi" ancha ishonchli bo'ladi.
function computeFileFingerprint(fileName, rowCount, firstRow, lastRow) {
  return `${fileName}|${rowCount}|${stableRowSignature(firstRow)}|${stableRowSignature(lastRow)}`;
}

function getImportedFingerprints() {
  try {
    const raw = localStorage.getItem(IMPORTED_FINGERPRINTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveImportedFingerprint(fp) {
  try {
    const existing = getImportedFingerprints();
    if (!existing.includes(fp)) {
      localStorage.setItem(IMPORTED_FINGERPRINTS_KEY, JSON.stringify([...existing, fp]));
    }
  } catch {
    // localStorage unavailable — not critical, just skip persisting
  }
}

function ImportModal({ operators, onClose, onDone }) {
  const { t } = useLanguage();
  const fileRef = useRef(null);
  const [parsedRows, setParsedRows] = useState(null); // {lead, unmatched}[]
  const [unmatchedHeaders, setUnmatchedHeaders] = useState([]);
  const [fileName, setFileName] = useState("");
  const [fileFingerprint, setFileFingerprint] = useState(null);
  const [defaultOperatorId, setDefaultOperatorId] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const parseFileRaw = async (file) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    let rawRows = [];
    for (const sheetName of wb.SheetNames) {
      const candidate = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(candidate, { defval: "" });
      if (rows.length > 0 && Object.keys(rows[0]).some((k) => k !== "0")) {
        rawRows = rawRows.concat(rows);
      }
    }
    rawRows = rawRows.map(stripEmptyColumns);
    return rawRows;
  };

  const applyParsedRows = (rawRows, fingerprint) => {
    setFileFingerprint(fingerprint);
    const mapped = rawRows.map(mapExcelRow);
    const allUnmatched = new Set();
    mapped.forEach((r) => r.unmatched.forEach((h) => allUnmatched.add(h)));
    setParsedRows(mapped.map((r) => r.lead));
    setUnmatchedHeaders([...allUnmatched]);
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setResult(null);
    setFileName(file.name);

    try {
      const rawRows = await parseFileRaw(file);

      if (rawRows.length === 0) {
        setError("Faylda ma'lumot topilmadi");
        setParsedRows(null);
        return;
      }

      const fingerprint = computeFileFingerprint(
        file.name, rawRows.length, rawRows[0], rawRows[rawRows.length - 1]
      );

      if (getImportedFingerprints().includes(fingerprint)) {
        setError("Fayl avval import qilingan!");
        setParsedRows(null);
        return;
      }

      applyParsedRows(rawRows, fingerprint);
    } catch (err) {
      setError("Faylni o'qishda xatolik: " + err.message);
      setParsedRows(null);
    }
  };


  const validCount = useMemo(
    () => (parsedRows || []).filter((r) => r.fullName).length,
    [parsedRows]
  );

  const handleImport = async () => {
    if (!parsedRows) return;
    setImporting(true);
    setError("");
    try {
      const res = await api.importLeads(
        parsedRows,
        defaultOperatorId ? Number(defaultOperatorId) : null
      );
      if (fileFingerprint) saveImportedFingerprint(fileFingerprint);
      setResult(res);
      onDone();
    } catch (err) {
      setError(err.message || "Import qilishda xatolik");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col
        animate-in fade-in slide-in-from-bottom-4 duration-200">

        <div className="px-6 py-4 border-b dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg flex items-center justify-center">
              <FileSpreadsheet size={16} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="font-bold text-slate-800 dark:text-slate-100 text-base">{t("btn_import")}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          {!result && (
            <>
              <label className="flex flex-col items-center justify-center gap-2 py-8 rounded-xl
                border-2 border-dashed border-slate-200 dark:border-slate-600 hover:border-indigo-300 cursor-pointer transition text-center">
                <Upload size={22} className="text-slate-400" />
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  {fileName || ".xlsx yoki .xls faylni tanlang"}
                </span>
                <span className="text-[11px] text-slate-400">Birinchi qator sarlavha bo'lishi kerak</span>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
              </label>

              {parsedRows && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between">
                    <span><b>{parsedRows.length}</b> qator topildi, <b>{validCount}</b> tasi yaroqli</span>
                  </div>
                  {unmatchedHeaders.length > 0 && (
                    <div className="px-4 py-2 bg-amber-50 dark:bg-amber-500/10 text-[11px] text-amber-700 dark:text-amber-400 border-t border-amber-100 dark:border-amber-900">
                      Tanilmagan ustunlar (e'tiborga olinmaydi): {unmatchedHeaders.join(", ")}
                    </div>
                  )}
                  <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1.5">Birinchi qatorlar</p>
                    <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                      {parsedRows.slice(0, 5).map((r, i) => (
                        <p key={i} className="text-xs text-slate-600 dark:text-slate-300 truncate">
                          {r.fullName || "(ism yo'q)"} — {r.phonePersonal || "(telefon yo'q)"}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {operators.length > 0 && parsedRows && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                    Barchasini operatorga biriktirish (ixtiyoriy)
                  </label>
                  <select
                    value={defaultOperatorId}
                    onChange={(e) => setDefaultOperatorId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-100
                      focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition"
                  >
                    <option value="">Biriktirilmagan qoldirish</option>
                    {operators.map((o) => (
                      <option key={o.id} value={o.id}>{o.displayName}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {result && (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <CheckCircle2 size={28} className="text-emerald-500" />
              <p className="text-xs text-slate-400">{t("import_file_label")}: {fileName}</p>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {result.inserted} ta lid muvaffaqiyatli import qilindi
              </p>
              {result.skipped > 0 && (
                <p className="text-xs text-slate-400">{result.skipped} ta qator o'tkazib yuborildi (ism yo'q)</p>
              )}
              {result.duplicates > 0 && (
                <p className="text-xs text-amber-500">{result.duplicates} ta qator o'tkazib yuborildi (allaqachon bazada bor — dublikat)</p>
              )}
              <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                {t("import_total_label")}: {result.totalLeads}
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50
              border border-rose-100 rounded-lg px-3 py-2">
              <AlertCircle size={13} />
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-b-2xl flex items-center justify-end gap-2">
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm font-medium
              text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition">
            {result ? t("btn_close") : t("btn_cancel")}
          </button>
          {!result && (
            <button
              onClick={handleImport}
              disabled={!parsedRows || validCount === 0 || importing}
              className={`px-5 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2
                transition ${parsedRows && validCount > 0 && !importing
                  ? "bg-indigo-500 hover:bg-indigo-600 shadow-sm"
                  : "bg-slate-300 dark:bg-slate-600 cursor-not-allowed"}`}
            >
              {importing && <Loader2 size={13} className="animate-spin" />}
              {t("btn_import")} ({validCount})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Sticky ustunlar uchun aniq piksel kengligi — header va qatorlarda bir xil
// bo'lishi shart, aks holda ikkinchi yopishqoq ustun keyingi ustunni bosib qoladi.
const STICKY_WIDTHS = { select: 40, no: 56, fullName: 176 };

function stickyLeft(columns, colKey) {
  let left = 0;
  for (const c of columns) {
    if (c.key === colKey) return left;
    if (c.sticky) left += STICKY_WIDTHS[c.key];
  }
  return left;
}

const COLUMNS = [
  { key: "no", labelKey: "table_no", sticky: true },
  { key: "fullName", labelKey: "table_name", sticky: true },
  { key: "district", labelKey: "table_district", width: "w-32" },
  { key: "school", labelKey: "table_school", width: "w-32" },
  { key: "grade", labelKey: "table_grade", width: "w-16" },
  { key: "sector", labelKey: "table_sector", width: "w-24" },
  { key: "futureProfession", labelKey: "table_future", width: "w-48" },
  { key: "subjects", labelKey: "table_subjects", width: "w-48" },
  { key: "prevCenter", labelKey: "table_prevcenter", width: "w-52" },
  { key: "phonePersonal", labelKey: "table_phone_personal", width: "w-36" },
  { key: "phoneFather", labelKey: "table_phone_father", width: "w-36" },
  { key: "phoneMother", labelKey: "table_phone_mother", width: "w-36" },
  { key: "stage", labelKey: "table_stage", width: "w-40" },
];

export default function LeadsTable({ leads, leadDisplayNo, isAdmin, operators, onOpenLead, onRefresh }) {
  const { t } = useLanguage();
  const [page, setPage] = useState(1);
  const [showImport, setShowImport] = useState(false);
  const [operatorFilter, setOperatorFilter] = useState(""); // "" | "unassigned" | operatorId
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkOperatorId, setBulkOperatorId] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [distributing, setDistributing] = useState(false);

  const visibleLeads = useMemo(() => {
    if (!operatorFilter) return leads;
    if (operatorFilter === "unassigned") return leads.filter((l) => l.assignedOperatorId == null);
    const opId = Number(operatorFilter);
    return leads.filter((l) => l.assignedOperatorId === opId);
  }, [leads, operatorFilter]);

  const columns = isAdmin
    ? [{ key: "select", labelKey: null, sticky: true }, ...COLUMNS, { key: "operatorName", labelKey: "table_operator", width: "w-32" }]
    : COLUMNS;

  const totalPages = Math.max(1, Math.ceil(visibleLeads.length / PAGE_SIZE));
  const pageLeads = visibleLeads.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const goPage = (p) => setPage(Math.min(totalPages, Math.max(1, p)));

  const changeOperatorFilter = (value) => {
    setOperatorFilter(value);
    setPage(1);
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const allOnPageSelected = pageLeads.length > 0 && pageLeads.every((l) => selectedIds.has(l.id));
  const toggleSelectAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageLeads.forEach((l) => next.delete(l.id));
      else pageLeads.forEach((l) => next.add(l.id));
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkAssign = async () => {
    if (!bulkOperatorId || selectedIds.size === 0) return;
    setBulkBusy(true);
    try {
      const res = await api.bulkAssignLeads([...selectedIds], Number(bulkOperatorId));
      if (res.skipped > 0) {
        alert(`${res.assigned} ta biriktirildi, ${res.skipped} ta allaqachon operatorga biriktirilgani uchun o'tkazib yuborildi`);
      }
      clearSelection();
      setBulkOperatorId("");
      onRefresh();
    } catch (err) {
      alert(err.message || "Biriktirishda xatolik");
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`${selectedIds.size} ta lidni o'chirmoqchimisiz? Bu amalni orqaga qaytarib bo'lmaydi.`)) return;
    setBulkBusy(true);
    try {
      await api.bulkDeleteLeads([...selectedIds]);
      clearSelection();
      onRefresh();
    } catch (err) {
      alert(err.message || "O'chirishda xatolik");
    } finally {
      setBulkBusy(false);
    }
  };

  const unassignedCount = leads.filter((l) => l.assignedOperatorId == null).length;

  const handleDistribute = async () => {
    if (unassignedCount === 0) {
      alert("Barcha lidlar allaqachon taqsimlangan");
      return;
    }
    if (operators.length === 0) return;
    const per = Math.ceil(unassignedCount / operators.length);
    const msg = `${unassignedCount} ta biriktirilmagan lid ${operators.length} operatorga ID tartibida ` +
      `taqsimlanadi (har biriga taxminan ${per} tadan, oxirgi operatorga ozroq tushishi mumkin). Davom etasizmi?`;
    if (!window.confirm(msg)) return;
    setDistributing(true);
    try {
      const res = await api.distributeLeads();
      onRefresh();
      alert(`${res.distributed} ta lid muvaffaqiyatli taqsimlandi`);
    } catch (err) {
      alert(err.message || "Taqsimlashda xatolik");
    } finally {
      setDistributing(false);
    }
  };

  const stickyStyle = (col) => {
    if (!col.sticky) return undefined;
    const width = STICKY_WIDTHS[col.key];
    return { left: stickyLeft(columns, col.key), width, minWidth: width, maxWidth: width };
  };

  const sectorStyle = (sector) => {
    const s = (sector || "").toLowerCase();
    if (s.startsWith("rus")) return "bg-violet-50 text-violet-600";
    if (s.startsWith("o") || s.startsWith("uzb")) return "bg-blue-50 text-blue-600";
    return "bg-slate-100 text-slate-500";
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Asboblar paneli */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-2.5 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Jami <b className="text-slate-700 dark:text-slate-200">{visibleLeads.length}</b> ta lid
          </p>
          {isAdmin && (
            <div className="relative">
              <Filter size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={operatorFilter}
                onChange={(e) => changeOperatorFilter(e.target.value)}
                className="pl-7 pr-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700
                  text-xs font-medium text-slate-600 dark:text-slate-200 outline-none focus:border-indigo-300 transition cursor-pointer"
              >
                <option value="">Barcha operatorlar</option>
                <option value="unassigned">Biriktirilmagan</option>
                {operators.map((o) => (
                  <option key={o.id} value={o.id}>{o.displayName}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white
                px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition"
            >
              <Upload size={13} /> {t("btn_import")}
            </button>
          </div>
        )}
      </div>

      {/* Ommaviy amallar paneli — tanlangan qatorlar bo'lsa ko'rinadi */}
      {isAdmin && selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-4 sm:px-6 py-2 bg-indigo-50 dark:bg-indigo-500/10 border-b border-indigo-100 dark:border-indigo-900">
          <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">{selectedIds.size} ta tanlandi</span>
          <select
            value={bulkOperatorId}
            onChange={(e) => setBulkOperatorId(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-700 text-xs text-slate-700 dark:text-slate-200 outline-none"
          >
            <option value="">Operator tanlang...</option>
            {operators.map((o) => (
              <option key={o.id} value={o.id}>{o.displayName}</option>
            ))}
          </select>
          <button
            onClick={handleBulkAssign}
            disabled={!bulkOperatorId || bulkBusy}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold
              bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-40 transition"
          >
            <UserCheck size={12} /> Biriktirish
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={bulkBusy}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold
              bg-rose-500 hover:bg-rose-600 text-white disabled:opacity-40 transition"
          >
            <Trash2 size={12} /> {t("btn_delete")}
          </button>
          <button onClick={clearSelection} className="text-xs text-indigo-500 dark:text-indigo-400 hover:underline ml-auto">
            {t("btn_cancel")}
          </button>
        </div>
      )}

      {/* Jadval — gorizontal scroll, sarlavha va birinchi ustunlar yopishqoq */}
      <div className="flex-1 overflow-auto">
        {visibleLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
            <FileSpreadsheet size={28} />
            <p className="text-sm">Hozircha lidlar yo'q</p>
          </div>
        ) : (
          <table className="min-w-full text-[13px] border-collapse">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`text-left px-3 py-3 font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide whitespace-nowrap
                      overflow-hidden text-ellipsis text-[11px] bg-gradient-to-b from-indigo-50 to-indigo-50/70 dark:from-slate-800 dark:to-slate-800
                      border-b-2 border-indigo-200 dark:border-indigo-900 sticky top-0
                      ${col.width || ""} ${col.sticky ? "z-30" : "z-20"}`}
                    style={stickyStyle(col)}
                  >
                    {col.key === "select" ? (
                      <input
                        type="checkbox"
                        checked={allOnPageSelected}
                        onChange={toggleSelectAllOnPage}
                        className="accent-indigo-500 cursor-pointer"
                      />
                    ) : t(col.labelKey)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageLeads.map((lead, i) => {
                const st = STAGE_STYLES[lead.stage];
                const stageLabel = t(`stage_${lead.stage}`);
                const stripe = i % 2 === 0 ? "bg-white dark:bg-slate-800" : "bg-slate-50/70 dark:bg-slate-800/60";
                return (
                  <tr
                    key={lead.id}
                    onClick={() => onOpenLead(lead)}
                    className={`${stripe} border-b border-slate-100 dark:border-slate-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10 cursor-pointer transition-colors`}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        onClick={col.key === "select" ? (e) => e.stopPropagation() : undefined}
                        className={`px-3 py-2.5 text-slate-700 dark:text-slate-300
                          ${col.key === "subjects" ? "" : "whitespace-nowrap overflow-hidden text-ellipsis"}
                          ${col.sticky ? `sticky z-10 ${stripe}` : ""}`}
                        style={stickyStyle(col)}
                      >
                        {col.key === "select" ? (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(lead.id)}
                            onChange={() => toggleSelect(lead.id)}
                            className="accent-indigo-500 cursor-pointer"
                          />
                        ) : col.key === "stage" ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white ${st.badge}`}>
                            {stageLabel}
                          </span>
                        ) : col.key === "sector" ? (
                          lead.sector ? (
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${sectorStyle(lead.sector)}`}>
                              {lead.sector}
                            </span>
                          ) : "—"
                        ) : col.key === "subjects" ? (
                          lead.subjects.length ? (
                            <div className="flex flex-wrap gap-1">
                              {lead.subjects.map((s, si) => (
                                <span key={`${s}-${si}`} className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 rounded-full text-[10px] font-medium">
                                  {s}
                                </span>
                              ))}
                            </div>
                          ) : "—"
                        ) : col.key === "no" ? (
                          <span className="font-bold text-slate-400">#{leadDisplayNo?.get(lead.id) ?? lead.no}</span>
                        ) : col.key === "fullName" ? (
                          <span className="font-semibold text-slate-800 dark:text-slate-100">{lead.fullName}</span>
                        ) : col.key === "operatorName" ? (
                          lead.operatorName
                            ? <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">{lead.operatorName}</span>
                            : <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">Biriktirilmagan</span>
                        ) : ["phonePersonal", "phoneFather", "phoneMother"].includes(col.key) ? (
                          lead[col.key]
                            ? <span className="font-medium text-indigo-600 dark:text-indigo-400 tabular-nums">{lead[col.key]}</span>
                            : "—"
                        ) : (
                          lead[col.key] || "—"
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {visibleLeads.length > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-2.5 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
          <p className="text-xs text-slate-400">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, visibleLeads.length)} / {visibleLeads.length}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => goPage(page - 1)}
              disabled={page === 1}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300 px-1">{page} / {totalPages}</span>
            <button
              onClick={() => goPage(page + 1)}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {showImport && (
        <ImportModal
          operators={operators}
          onClose={() => setShowImport(false)}
          onDone={onRefresh}
        />
      )}
    </div>
  );
}

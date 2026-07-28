// ─────────────────────────────────────────────
// Hisobot — operatorlar samaradorligi (faqat admin)
// Barcha statistika `leads` massividan hisoblanadi — yangi API
// so'rovlari yo'q. Sana kalitlari UTC bo'yicha ("YYYY-MM-DD") — bir xil
// qoida bilan hisoblanadi, mahalliy vaqt zonasi chalkashligidan qochish
// uchun.
// ─────────────────────────────────────────────

import { useEffect, useMemo, useState, Fragment } from "react";
import * as XLSX from "xlsx";
import { ChevronDown, ChevronRight, Download, Archive, Loader2, AlertCircle, Target, Pencil, Trash2 } from "lucide-react";

// ── localStorage kaliti ──
const GOALS_KEY = "crm_operator_goals";

const DATE_FILTERS = [
  { id: "today", label: "Bugun", days: 1 },
  { id: "7d", label: "7 kun", days: 7 },
  { id: "30d", label: "30 kun", days: 30 },
  { id: "all", label: "Barchasi", days: null },
];

function dayKey(d) {
  return new Date(d).toISOString().slice(0, 10);
}

function todayKey() {
  return dayKey(new Date());
}

function addDaysToKey(key, delta) {
  const d = new Date(`${key}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return dayKey(d);
}

function last7DayKeys() {
  const today = todayKey();
  const keys = [];
  for (let i = 6; i >= 0; i--) keys.push(addDaysToKey(today, -i));
  return keys;
}

// "Barchasi" tanlanganda oyna boshlanishi — bazadagi eng qadimgi
// lidning yaratilgan sanasi (boshqa signal mavjud emas).
function windowStartKeyFor(filterId, leads) {
  const filter = DATE_FILTERS.find((f) => f.id === filterId);
  if (filter.days != null) return addDaysToKey(todayKey(), -(filter.days - 1));
  if (leads.length === 0) return todayKey();
  let earliest = todayKey();
  for (const l of leads) {
    if (l.createdAt) {
      const k = dayKey(l.createdAt);
      if (k < earliest) earliest = k;
    }
  }
  return earliest;
}

function windowDaysFor(filterId, windowStartKey) {
  const filter = DATE_FILTERS.find((f) => f.id === filterId);
  if (filter.days != null) return filter.days;
  const start = new Date(`${windowStartKey}T00:00:00.000Z`);
  const today = new Date(`${todayKey()}T00:00:00.000Z`);
  return Math.max(1, Math.round((today - start) / 86400000) + 1);
}

// goal — adminning belgilagan kunlik maqsadi. Agar yo'q bo'lsa, standart 15
function goalBadge(perDay, goal = 15) {
  const mid = goal * 0.6;
  if (perDay >= goal) return { label: "Yaxshi", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" };
  if (perDay >= mid) return { label: "O'rta", cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400" };
  return { label: "Past", cls: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400" };
}

// ── Maqsad CRUD modali ──
function GoalModal({ operator, currentGoal, onSave, onDelete, onClose }) {
  const [value, setValue] = useState(String(currentGoal ?? 15));
  const [note, setNote] = useState("");

  const isNew = currentGoal == null;

  const handleSave = () => {
    const num = parseInt(value, 10);
    if (!num || num < 1 || num > 999) return;
    onSave(num, note.trim());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl w-80 p-6">
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Target size={16} className="text-indigo-500" />
          {isNew ? "Maqsad belgilash" : "Maqsadni tahrirlash"}
        </h3>

        <div className="mb-3">
          <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Operator</label>
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-900 rounded-lg px-3 py-2">
            {operator?.displayName ?? "—"}
          </div>
        </div>

        <div className="mb-3">
          <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">
            Kunlik maqsad (lid/kun)
          </label>
          <input
            type="number"
            min={1}
            max={999}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900
              px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none
              focus:ring-2 focus:ring-indigo-400"
            autoFocus
          />
          <p className="text-[10px] text-slate-400 mt-1">
            Standart: 15 &nbsp;·&nbsp; ≥ maqsad = Yaxshi &nbsp;·&nbsp; ≥ 60% = O'rta
          </p>
        </div>

        <div className="mb-5">
          <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Izoh (ixtiyoriy)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Masalan: yangi oydan qo'llaniladi"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900
              px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none
              focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        <div className="flex gap-2">
          {!isNew && (
            <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-500/10
                text-rose-600 dark:text-rose-400 text-xs font-semibold hover:bg-rose-100 transition"
            >
              <Trash2 size={12} /> O'chirish
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600
              dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 transition"
          >
            Bekor
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white
              text-xs font-semibold transition"
          >
            Saqlash
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("uz-UZ", { day: "numeric", month: "short" }) + " " +
    d.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
}

function formatDDMMYYYY(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

// api.js ga tegilmasligi kerak bo'lgani uchun (fayl cheklovi) shu yerda
// alohida, minimal fetch — "Rad etdi arxivi" va "A'zo bo'ldi arxivi"
// bo'limlari uchun, final_stage bo'yicha.
async function fetchArchiveByStage(finalStage) {
  const base = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
  const token = localStorage.getItem("token");
  const res = await fetch(`${base}/leads/archive?finalStage=${finalStage}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Arxivni yuklashda xatolik");
  return data;
}

/** Sof SVG mini bar chart — kutubxonasiz. Har bir ustun = shu operatorning
 * o'sha kuni yangilangan lidlari soni (so'nggi 7 kun, UTC kunlar). */
function Sparkline({ leads }) {
  const keys = last7DayKeys();
  const counts = keys.map((key) => leads.filter((l) => l.updatedAt && dayKey(l.updatedAt) === key).length);
  const max = Math.max(1, ...counts);
  const barW = 28, barGap = 6, chartH = 42;

  return (
    <svg width={(barW + barGap) * keys.length} height={chartH + 16} className="overflow-visible">
      {counts.map((c, i) => {
        const barH = Math.max(Math.round((c / max) * chartH), c > 0 ? 2 : 1);
        const x = i * (barW + barGap);
        const y = chartH - barH;
        const d = new Date(`${keys[i]}T00:00:00.000Z`);
        return (
          <g key={keys[i]}>
            {c > 0 && (
              <text x={x + barW / 2} y={y - 3} textAnchor="middle" className="fill-slate-500 dark:fill-slate-400 text-[9px] font-semibold">
                {c}
              </text>
            )}
            <rect
              x={x} y={y} width={barW} height={barH} rx={3}
              className={c > 0 ? "fill-indigo-400 dark:fill-indigo-500" : "fill-slate-200 dark:fill-slate-700"}
            />
            <text x={x + barW / 2} y={chartH + 12} textAnchor="middle" className="fill-slate-400 text-[9px]">
              {d.getUTCDate()}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Operator qatori ochilganda ko'rinadigan faol lidlar jadvali —
 * sparkline'ning sibling'i, uni almashtirmaydi. Ma'lumot allaqachon
 * yuklangan `leads` propidan (GET /api/leads) client-side filtrlanadi,
 * yangi so'rov yuborilmaydi. */
function ActiveLeadsDrilldown({ leads }) {
  if (leads.length === 0) {
    return <p className="text-xs text-slate-400">Bu operatorda faol lidlar yo'q</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <th className="text-left px-3 py-2 font-bold text-slate-500 dark:text-slate-400 uppercase whitespace-nowrap">Ism familya</th>
            <th className="text-left px-3 py-2 font-bold text-slate-500 dark:text-slate-400 uppercase whitespace-nowrap">Sinf</th>
            <th className="text-left px-3 py-2 font-bold text-slate-500 dark:text-slate-400 uppercase whitespace-nowrap">Fanlar</th>
            <th className="text-left px-3 py-2 font-bold text-slate-500 dark:text-slate-400 uppercase whitespace-nowrap">Telefon</th>
            <th className="text-left px-3 py-2 font-bold text-slate-500 dark:text-slate-400 uppercase whitespace-nowrap">Izoh</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr key={l.id} className="border-b border-slate-100 dark:border-slate-700 last:border-0 bg-white dark:bg-slate-800">
              <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">{l.fullName}</td>
              <td className="px-3 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap">{l.grade || "—"}</td>
              <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{(l.subjects || []).join(", ") || "—"}</td>
              <td className="px-3 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap">{l.phonePersonal || "—"}</td>
              <td className="px-3 py-2 text-slate-600 dark:text-slate-300 max-w-xs truncate">{l.notes || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** "Rad etdi arxivi" va "A'zo bo'ldi arxivi" bo'limlarida bir xil
 * ustunlar bilan qayta ishlatiladigan jadval — ikkalasi ham
 * GET /api/leads/archive?finalStage=... javobini bir xil shaklda oladi. */
function ArchiveTable({ rows, loading, error, emptyMessage }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden overflow-x-auto">
      {loading && (
        <div className="flex items-center justify-center py-8 text-slate-400 gap-2">
          <Loader2 size={16} className="animate-spin" /> <span className="text-sm">Yuklanmoqda...</span>
        </div>
      )}
      {!loading && error && (
        <p className="flex items-center gap-1.5 text-sm text-rose-600 px-4 py-4">
          <AlertCircle size={14} /> {error}
        </p>
      )}
      {!loading && !error && (
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
              <th className="text-left px-4 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase text-xs whitespace-nowrap">Ism familya</th>
              <th className="text-left px-4 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase text-xs whitespace-nowrap">Fan nomi</th>
              <th className="text-left px-4 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase text-xs whitespace-nowrap">Qiziqish</th>
              <th className="text-left px-4 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase text-xs whitespace-nowrap">Izoh</th>
              <th className="text-left px-4 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase text-xs whitespace-nowrap">Operator</th>
              <th className="text-left px-4 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase text-xs whitespace-nowrap">Sana</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 dark:border-slate-700 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">{r.fullName}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{(r.subjects || []).join(", ") || "—"}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.futureProfession || "—"}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-xs truncate">{r.notes || "—"}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">{r.operatorName || "Biriktirilmagan"}</td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatDDMMYYYY(r.archivedAt)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-sm text-slate-400">{emptyMessage}</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function HisobotPage({ leads, operators }) {
  const [dateFilter, setDateFilter] = useState("7d");
  const [expandedId, setExpandedId] = useState(null);

  // ── MAQSAD CRUD: { [operatorId]: number } ──
  const [goals, setGoals] = useState(() => {
    try { return JSON.parse(localStorage.getItem(GOALS_KEY) || "{}"); }
    catch { return {}; }
  });
  const [goalModal, setGoalModal] = useState(null); // { operator } | null

  const saveGoal = (operatorId, value) => {
    setGoals((prev) => {
      const next = { ...prev, [operatorId]: value };
      localStorage.setItem(GOALS_KEY, JSON.stringify(next));
      return next;
    });
    setGoalModal(null);
  };

  const deleteGoal = (operatorId) => {
    setGoals((prev) => {
      const next = { ...prev };
      delete next[operatorId];
      localStorage.setItem(GOALS_KEY, JSON.stringify(next));
      return next;
    });
    setGoalModal(null);
  };

  // ── "Rad etdi arxivi" — GET /api/leads/archive?finalStage=lost ──
  const [archiveRows, setArchiveRows] = useState([]);
  const [archiveLoading, setArchiveLoading] = useState(true);
  const [archiveError, setArchiveError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setArchiveLoading(true);
    setArchiveError("");
    fetchArchiveByStage("lost")
      .then((rows) => { if (!cancelled) setArchiveRows(rows); })
      .catch((err) => { if (!cancelled) setArchiveError(err.message || "Arxivni yuklashda xatolik"); })
      .finally(() => { if (!cancelled) setArchiveLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // ── "A'zo bo'ldi arxivi" — GET /api/leads/archive?finalStage=won ──
  const [wonArchiveRows, setWonArchiveRows] = useState([]);
  const [wonArchiveLoading, setWonArchiveLoading] = useState(true);
  const [wonArchiveError, setWonArchiveError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setWonArchiveLoading(true);
    setWonArchiveError("");
    fetchArchiveByStage("won")
      .then((rows) => { if (!cancelled) setWonArchiveRows(rows); })
      .catch((err) => { if (!cancelled) setWonArchiveError(err.message || "Arxivni yuklashda xatolik"); })
      .finally(() => { if (!cancelled) setWonArchiveLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const windowStartKey = useMemo(() => windowStartKeyFor(dateFilter, leads), [dateFilter, leads]);
  const windowDays = windowDaysFor(dateFilter, windowStartKey);

  const inWindow = (l) => dateFilter === "all" || (l.updatedAt && dayKey(l.updatedAt) >= windowStartKey);

  // Operator bo'yicha statistika. "Biriktirilgan" — operatorning butun
  // hozirgi lidlar soni (sana filtriga bog'liq emas, joriy holat).
  // "Aloqa"/"A'zo" — tanlangan sana oynasida yangilangan lidlar orasidan.
  const rows = useMemo(() => {
    return operators.map((op) => {
      const assigned = leads.filter((l) => l.assignedOperatorId === op.id);
      const windowed = assigned.filter(inWindow);
      const aloqa = windowed.filter((l) => l.stage === "contacted").length;
      const azo = windowed.filter((l) => l.stage === "won").length;
      const perDay = windowDays > 0 ? aloqa / windowDays : 0;

      let lastActivityMs = 0;
      for (const l of assigned) {
        if (!l.updatedAt) continue;
        const t = new Date(l.updatedAt).getTime();
        if (t > lastActivityMs) lastActivityMs = t;
      }

      return {
        operatorId: op.id,
        displayName: op.displayName,
        assignedCount: assigned.length,
        aloqa,
        azo,
        perDay,
        lastActivity: lastActivityMs ? new Date(lastActivityMs).toISOString() : null,
        assignedLeads: assigned,
        activeLeads: assigned.filter((l) => l.stage !== "lost"),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, operators, dateFilter, windowStartKey, windowDays]);

  const handleExport = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1 — Operatorlar
    const sheet1 = rows.map((r) => ({
      Operator: r.displayName,
      Biriktirilgan: r.assignedCount,
      Aloqa: r.aloqa,
      "A'zo": r.azo,
      "Kun/lid": Number(r.perDay.toFixed(2)),
      "Belgilangan maqsad": goals[r.operatorId] ?? 15,
      Maqsad: goalBadge(r.perDay, goals[r.operatorId]).label,
      "So'nggi faollik": formatDateTime(r.lastActivity),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet1), "Operatorlar");

    // Sheet 2 — Kunlik (operator + sana + aloqa + a'zo, so'nggi 7 kun)
    const keys = last7DayKeys();
    const sheet2 = [];
    rows.forEach((r) => {
      keys.forEach((key) => {
        const dayLeads = r.assignedLeads.filter((l) => l.updatedAt && dayKey(l.updatedAt) === key);
        sheet2.push({
          Operator: r.displayName,
          Sana: key,
          Aloqa: dayLeads.filter((l) => l.stage === "contacted").length,
          "A'zo": dayLeads.filter((l) => l.stage === "won").length,
        });
      });
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet2), "Kunlik");

    // Sheet 3 — Fanlar (joriy sana filtriga mos lidlar bo'yicha taqsimot)
    const subjectCounts = {};
    leads.filter(inWindow).forEach((l) => {
      (l.subjects || []).forEach((s) => {
        subjectCounts[s] = (subjectCounts[s] || 0) + 1;
      });
    });
    const sheet3 = Object.entries(subjectCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([subject, count]) => ({ Fan: subject, Soni: count }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet3), "Fanlar");

    // Sheet 4 — Rad etdilar (arxivlangan "lost" lidlar)
    const sheet4 = archiveRows.map((r) => ({
      "Ism familya": r.fullName,
      "Fan nomi": (r.subjects || []).join(", "),
      Qiziqish: r.futureProfession,
      Izoh: r.notes,
      Operator: r.operatorName || "Biriktirilmagan",
      Sana: formatDDMMYYYY(r.archivedAt),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet4), "Rad etdilar");

    // Sheet 5 — Azo boldilar (arxivlangan "won" lidlar)
    const sheet5 = wonArchiveRows.map((r) => ({
      "Ism familya": r.fullName,
      "Fan nomi": (r.subjects || []).join(", "),
      Qiziqish: r.futureProfession,
      Izoh: r.notes,
      Operator: r.operatorName || "Biriktirilmagan",
      Sana: formatDDMMYYYY(r.archivedAt),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet5), "Azo boldilar");

    XLSX.writeFile(wb, `EduCRM-Hisobot-${todayKey()}.xlsx`);
  };

  return (
    <main className="flex-1 min-h-0 overflow-auto p-4 sm:p-6">

      {/* ── GoalModal ── */}
      {goalModal && (
        <GoalModal
          operator={goalModal.operator}
          currentGoal={goals[goalModal.operator.id] ?? null}
          onSave={(val) => saveGoal(goalModal.operator.id, val)}
          onDelete={() => deleteGoal(goalModal.operator.id)}
          onClose={() => setGoalModal(null)}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Hisobot — operatorlar samaradorligi</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
            {DATE_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setDateFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition
                  ${dateFilter === f.id
                    ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-500 dark:text-slate-400"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white
              px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition"
          >
            <Download size={13} /> Excel'ga eksport
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
              <th className="w-8"></th>
              <th className="text-left px-4 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase text-xs whitespace-nowrap">Operator</th>
              <th className="text-center px-4 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase text-xs whitespace-nowrap">Biriktirilgan</th>
              <th className="text-center px-4 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase text-xs whitespace-nowrap">Aloqa</th>
              <th className="text-center px-4 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase text-xs whitespace-nowrap">A'zo bo'ldi / Yutildi</th>
              <th className="text-center px-4 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase text-xs whitespace-nowrap">Kun/lid</th>
              <th className="text-center px-4 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase text-xs whitespace-nowrap">Maqsad</th>
              <th className="text-left px-4 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase text-xs whitespace-nowrap">So'nggi faollik</th>
              <th className="text-center px-4 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase text-xs whitespace-nowrap">Amallar</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const opGoal = goals[r.operatorId];
              const badge = goalBadge(r.perDay, opGoal);
              const expanded = expandedId === r.operatorId;
              const colSpan = 9;
              return (
                <Fragment key={r.operatorId}>
                  <tr className="border-b border-slate-100 dark:border-slate-700 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                    <td
                      className="px-2 text-slate-400 cursor-pointer"
                      onClick={() => setExpandedId(expanded ? null : r.operatorId)}
                    >
                      {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </td>
                    <td
                      className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap cursor-pointer"
                      onClick={() => setExpandedId(expanded ? null : r.operatorId)}
                    >
                      {r.displayName}
                      {opGoal != null && (
                        <span className="ml-2 text-[10px] font-normal text-indigo-500 dark:text-indigo-400">
                          M:{opGoal}/kun
                        </span>
                      )}
                    </td>
                    <td className="text-center px-4 py-3 text-slate-600 dark:text-slate-300">{r.assignedCount}</td>
                    <td className="text-center px-4 py-3 text-slate-600 dark:text-slate-300">{r.aloqa}</td>
                    <td className="text-center px-4 py-3 text-slate-600 dark:text-slate-300">{r.azo}</td>
                    <td className="text-center px-4 py-3 font-semibold text-indigo-600 dark:text-indigo-400">{r.perDay.toFixed(1)}</td>
                    <td className="text-center px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${badge.cls}`}>{badge.label}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatDateTime(r.lastActivity)}</td>
                    {/* ── CRUD tugmalari ── */}
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {/* Ko'rish / yashirish */}
                        <button
                          type="button"
                          title={expanded ? "Yopish" : "Ko'rish"}
                          onClick={() => setExpandedId(expanded ? null : r.operatorId)}
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300
                            hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                        >
                          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        </button>
                        {/* Maqsad — tahrirlash/yaratish */}
                        <button
                          type="button"
                          title={opGoal != null ? "Maqsadni tahrirlash" : "Maqsad belgilash"}
                          onClick={() => setGoalModal({ operator: { id: r.operatorId, displayName: r.displayName } })}
                          className={`p-1.5 rounded-lg transition ${
                            opGoal != null
                              ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200"
                              : "bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"
                          }`}
                        >
                          {opGoal != null ? <Pencil size={13} /> : <Target size={13} />}
                        </button>
                        {/* O'chirish — faqat maqsad belgilangan bo'lsa */}
                        {opGoal != null && (
                          <button
                            type="button"
                            title="Maqsadni o'chirish"
                            onClick={() => deleteGoal(r.operatorId)}
                            className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-500
                              hover:bg-rose-100 dark:hover:bg-rose-500/20 transition"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="bg-slate-50 dark:bg-slate-900/50">
                      <td colSpan={colSpan} className="px-4 py-4">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase mb-2">So'nggi 7 kun — yangilangan lidlar soni</p>
                        <Sparkline leads={r.assignedLeads} />
                      </td>
                    </tr>
                  )}
                  {expanded && (
                    <tr className="bg-slate-50 dark:bg-slate-900/50">
                      <td colSpan={colSpan} className="px-4 pb-4">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase mb-2">Faol lidlar</p>
                        <ActiveLeadsDrilldown leads={r.activeLeads} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={9} className="text-center py-8 text-sm text-slate-400">Operatorlar topilmadi</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── RAD ETDI ARXIVI ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-6 mb-4">
        <div className="flex items-center gap-2">
          <Archive size={16} className="text-slate-400" />
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Rad etdi arxivi</h2>
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white
            px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition"
        >
          <Download size={13} /> Excel eksport
        </button>
      </div>

      <ArchiveTable
        rows={archiveRows}
        loading={archiveLoading}
        error={archiveError}
        emptyMessage={'Hali arxivlangan "Rad etdi" lidlar yo\'q'}
      />

      {/* ── A'ZO BO'LDI ARXIVI ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-6 mb-4">
        <div className="flex items-center gap-2">
          <Archive size={16} className="text-slate-400" />
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">A'zo bo'ldi arxivi</h2>
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white
            px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition"
        >
          <Download size={13} /> Excel eksport
        </button>
      </div>

      <ArchiveTable
        rows={wonArchiveRows}
        loading={wonArchiveLoading}
        error={wonArchiveError}
        emptyMessage={'Hali arxivlangan "A\'zo bo\'ldi" lidlar yo\'q'}
      />
    </main>
  );
}

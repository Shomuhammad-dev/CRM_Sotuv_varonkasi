// ─────────────────────────────────────────────
// "Vazifa" — fan + sinf bo'yicha filtrlab, hali operatorga
// biriktirilmagan lidlarni operatorlar orasida teng taqsimlash.
// Filtrlash butunlay client-side (leads allaqachon yuklangan).
// "Taqsimlashni boshlash" bosilganda backend chaqiriladi.
//
// ARXITEKTURA QOIDALARI:
//  1. Fan filter: faqat 1 ta tanlanadi (single-select)
//  2. Sinf filter: ixtiyoriy, fan filtridan mustaqil
//  3. subjects bo'sh bo'lsa fan tugmalari DISABLED — silent bypass yo'q
//  4. alreadyAssignedCount matched bilan bir xil logika ishlatadi
// ─────────────────────────────────────────────

import { useMemo, useState } from "react";
import { Shuffle, Loader2, CheckCircle2, AlertCircle, X, Info } from "lucide-react";
import { SUBJECTS } from "./constants";
import { api } from "./api";

const GRADES = ["5", "6", "7", "8", "9", "10", "11"];

const SUBJECT_STEMS = {
  "Ingliz tili":  ["ingliz"],
  "Matematika":   ["matematik"],
  "Rus tili":     ["rus t"],
  "Ona tili":     ["ona t"],
  "Kimyo":        ["kimyo"],
  "Fizika":       ["fizik"],
  "Biologiya":    ["bio"],
  "Informatika":  ["informati", "it"],
  "Tarix":        ["tarix"],
  "Geografiya":   ["geograf"],
  "Adabiyot":     ["adabiy"],
  "Chizmachilik": ["chizma"],
};

function subjectStems(subject) {
  return SUBJECT_STEMS[subject] || [subject.toLowerCase()];
}

function matchesSubject(leadSubjects, subjectFilter) {
  if (!subjectFilter) return true;
  if (!Array.isArray(leadSubjects) || leadSubjects.length === 0) return false;
  const stems     = subjectStems(subjectFilter);
  const filterLow = subjectFilter.toLowerCase();
  return leadSubjects.some((s) => {
    const low = String(s).toLowerCase();
    if (low.includes("hamma fan")) return true;
    if (stems.some((stem) => low.includes(stem))) return true;
    return low.includes(filterLow) || (low.length >= 3 && filterLow.includes(low));
  });
}

function gradeNumber(grade) {
  const m = String(grade || "").trim().match(/^\d+/);
  return m?.[0] ?? null;
}

function splitEvenly(total, operators) {
  if (operators.length === 0) return [];
  const base      = Math.floor(total / operators.length);
  const remainder = total % operators.length;
  return operators.map((op, i) => ({
    operatorId:  op.id,
    displayName: op.displayName,
    count:       base + (i < remainder ? 1 : 0),
  }));
}

// ── Bitta filtr funksiyasi — matched va alreadyAssigned ikkalasi shu orqali ──
// subjectDisabled = true bo'lsa fan filtri QABUL QILINMAYDI (silent bypass yo'q)
function applyFilters(list, subjectFilter, gradeFilter, subjectDisabled) {
  return list.filter((l) => {
    if (!subjectDisabled && subjectFilter && !matchesSubject(l.subjects, subjectFilter)) return false;
    if (gradeFilter && gradeNumber(l.grade) !== gradeFilter) return false;
    return true;
  });
}

export default function VazifaPage({ leads, operators, onDistributed }) {
  const [subjectFilter, setSubjectFilter] = useState(null);
  const [gradeFilter,   setGradeFilter]   = useState(null);
  const [distributing,  setDistributing]  = useState(false);
  const [error,         setError]         = useState("");
  const [success,       setSuccess]       = useState(false);
  // [] = hech biri tanlanmagan -> barcha operatorlarga teng bo'linish (standart).
  // Bir yoki bir necha operator tanlansa, faqat shular orasida teng bo'linadi.
  const [selectedOperatorIds, setSelectedOperatorIds] = useState([]);

  // ── Taqsimlanmagan lidlar ─────────────────────────────────────────
  const unassigned = useMemo(
    () => leads.filter((l) => l.assignedOperatorId == null),
    [leads]
  );

  // ── Bazada subjects bor-yo'qligini tekshirish ─────────────────────
  // Eng kamida bitta lidda subjects bo'lsa subjectsEmpty = false
  const subjectsEmpty = useMemo(
    () => unassigned.length > 0 && unassigned.every((l) => !l.subjects || l.subjects.length === 0),
    [unassigned]
  );

  // Fan filtri ishlatilishi mumkinmi (subject data bor + subjects populated)
  const subjectDisabled = subjectsEmpty;

  // ── Fan tugmachalari uchun sonlar ─────────────────────────────────
  // Sinf filtriga BOG'LIQ EMAS (mustaqil ko'rsatiladi)
  const subjectCounts = useMemo(() => {
    if (subjectDisabled) return {};
    const counts = {};
    for (const lead of unassigned) {
      for (const s of SUBJECTS) {
        if (matchesSubject(lead.subjects, s)) {
          counts[s] = (counts[s] || 0) + 1;
        }
      }
    }
    return counts;
  }, [unassigned, subjectDisabled]);

  // ── Sinf tugmachalari uchun sonlar ───────────────────────────────
  // Fan filtriga BOG'LIQ EMAS (mustaqil ko'rsatiladi)
  const gradeCounts = useMemo(() => {
    const counts = {};
    for (const lead of unassigned) {
      const g = gradeNumber(lead.grade);
      if (g) counts[g] = (counts[g] || 0) + 1;
    }
    return counts;
  }, [unassigned]);

  // ── Filtrlangan (taqsimlanmagan) natija ──────────────────────────
  const matched = useMemo(
    () => applyFilters(unassigned, subjectFilter, gradeFilter, subjectDisabled),
    [unassigned, subjectFilter, gradeFilter, subjectDisabled]
  );

  // ── Allaqachon biriktirilgan lekin filtrga mos kelganlar ──────────
  // matched bilan AYNAN BIR XIL logika (inconsistency yo'q)
  const alreadyAssigned = useMemo(() => {
    const assigned = leads.filter((l) => l.assignedOperatorId != null);
    return applyFilters(assigned, subjectFilter, gradeFilter, subjectDisabled);
  }, [leads, subjectFilter, gradeFilter, subjectDisabled]);

  // Tanlangan operatorlar ro'yxati (bo'sh = hammasi)
  const selectedOperators = useMemo(
    () =>
      selectedOperatorIds.length === 0
        ? operators
        : operators.filter((op) => selectedOperatorIds.includes(op.id)),
    [operators, selectedOperatorIds]
  );

  // Preview: 0 tanlangan → barcha 7 ta, 1 tanlangan → hammasi unga, N → shular orasida teng
  const preview = useMemo(() => {
    if (selectedOperatorIds.length === 0) return splitEvenly(matched.length, operators);
    if (selectedOperatorIds.length === 1)
      return [{ operatorId: selectedOperators[0].id, displayName: selectedOperators[0].displayName, count: matched.length }];
    return splitEvenly(matched.length, selectedOperators);
  }, [matched.length, operators, selectedOperators, selectedOperatorIds]);

  const handleDistribute = async () => {
    setDistributing(true);
    setError("");
    setSuccess(false);
    try {
      // subjectDisabled bo'lsa fan filtri backend ga ham yuborilmaydi
      await api.distributeFiltered(
        subjectDisabled ? null : subjectFilter,
        gradeFilter,
        selectedOperatorIds.length === 0 ? null : selectedOperatorIds
      );
      setSuccess(true);
      setSubjectFilter(null);
      setGradeFilter(null);
      setSelectedOperatorIds([]);
      onDistributed();
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      setError(err.message || "Taqsimlashda xatolik");
    } finally {
      setDistributing(false);
    }
  };

  // Operatorni toggle qilish — id massivga qo'shiladi yoki olib tashlanadi
  const toggleOperator = (id) =>
    setSelectedOperatorIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const clearFilters = () => {
    setSubjectFilter(null);
    setGradeFilter(null);
  };

  const hasFilter = (!subjectDisabled && subjectFilter) || gradeFilter;
  const activeFilterLabel = [
    !subjectDisabled && subjectFilter ? subjectFilter : null,
    gradeFilter ? `${gradeFilter}-sinf` : null,
  ].filter(Boolean).join(" · ");

  return (
    <main className="flex-1 min-h-0 overflow-auto p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
          Vazifa — Operatorlarga taqsimlash
        </h2>
        {hasFilter && (
          <button onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-rose-500 transition">
            <X size={13} /> Filterni tozalash
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">

        {/* ── Chap: statistika + filtrlar ────────────────────────── */}
        <div className="flex flex-col gap-4">

          {/* Statistika */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 text-center">
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{leads.length}</p>
              <p className="text-xs text-slate-400 mt-1">Jami</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 text-center">
              <p className="text-2xl font-bold text-amber-500">{unassigned.length}</p>
              <p className="text-xs text-slate-400 mt-1">Taqsimlanmagan</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 text-center">
              <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{matched.length}</p>
              <p className="text-xs text-slate-400 mt-1">Tanlandi</p>
            </div>
          </div>

          {/* subjects bo'sh ogohlantirish — fan disabled sababi tushuntiriladi */}
          {subjectsEmpty && unassigned.length > 0 && (
            <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2.5">
              <AlertCircle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Fan ma'lumotlari bazada yo'q — fan filtri <span className="font-semibold">ishlamaydi</span>.
                Faqat sinf bo'yicha filter yoki filtrsiz taqsimlang.
                Fan filtri uchun Excel qayta import qiling.
              </p>
            </div>
          )}

          {/* Fan filtri */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Fan</p>
              {subjectDisabled && (
                <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">
                  ma'lumot yo'q
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              {SUBJECTS.map((s) => {
                const count  = subjectCounts[s] || 0;
                const active = !subjectDisabled && subjectFilter === s;
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={subjectDisabled}
                    onClick={() => {
                      if (subjectDisabled) return;
                      setSubjectFilter((cur) => (cur === s ? null : s));
                      setGradeFilter(null);
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm font-medium transition
                      ${subjectDisabled
                        ? "bg-slate-50 dark:bg-slate-700/30 text-slate-300 dark:text-slate-600 border-slate-100 dark:border-slate-700/50 cursor-not-allowed"
                        : active
                          ? "bg-indigo-500 text-white border-indigo-500"
                          : count === 0
                            ? "bg-slate-50 dark:bg-slate-700/50 text-slate-400 dark:text-slate-500 border-slate-100 dark:border-slate-700"
                            : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-indigo-300 cursor-pointer"
                      }`}
                  >
                    <span>{s}</span>
                    <span className={`text-xs font-bold tabular-nums ${
                      subjectDisabled ? "text-slate-300 dark:text-slate-700"
                        : active ? "text-indigo-100"
                        : count === 0 ? "text-slate-300 dark:text-slate-600"
                        : "text-indigo-600 dark:text-indigo-400"
                    }`}>
                      {subjectDisabled ? "—" : count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sinf filtri */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3">Sinf</p>
            <div className="flex flex-wrap gap-2">
              {GRADES.map((g) => {
                const count  = gradeCounts[g] || 0;
                const active = gradeFilter === g;
                return (
                  <button key={g} type="button"
                    onClick={() => setGradeFilter((cur) => (cur === g ? null : g))}
                    className={`relative flex flex-col items-center justify-center w-12 h-12 rounded-lg border text-sm font-semibold transition
                      ${active
                        ? "bg-indigo-500 text-white border-indigo-500"
                        : count === 0
                          ? "bg-slate-50 dark:bg-slate-700/50 text-slate-300 dark:text-slate-600 border-slate-100 dark:border-slate-700"
                          : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-indigo-300"
                      }`}
                  >
                    <span>{g}</span>
                    <span className={`text-[9px] font-bold leading-none tabular-nums ${
                      active ? "text-indigo-200" : "text-slate-400 dark:text-slate-500"
                    }`}>{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Aktiv filtr natijalari */}
            {(hasFilter || gradeFilter) && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-3 font-medium">
                {activeFilterLabel || "Barcha sinflar"} →{" "}
                <span className="font-bold">{matched.length} ta</span> taqsimlanmagan lid
              </p>
            )}
          </div>
        </div>

        {/* ── O'ng: taqsimlash paneli ─────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-emerald-400 dark:border-emerald-500 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Shuffle size={16} className="text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Operatorlarga taqsimlash</p>
              </div>
              <span className="text-[11px] text-slate-400">
                {selectedOperatorIds.length === 0
                  ? `${matched.length} ÷ ${operators.length} operator`
                  : selectedOperatorIds.length === 1
                    ? `${matched.length} ta → ${selectedOperators[0]?.displayName}`
                    : `${matched.length} ÷ ${selectedOperatorIds.length} operator`}
              </span>
            </div>

            {/* Operator-picker — ko'p tanlov: hech biri tanlanmasa barcha operatorlarga
                teng bo'linadi; bir yoki bir nechasi tanlansa faqat shular orasida teng taqsimlanadi */}
            <div className="mb-3">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                Operator <span className="normal-case font-normal text-slate-400">(ixtiyoriy)</span>
              </label>
              <div className="border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden
                divide-y divide-slate-100 dark:divide-slate-700">
                {/* "Barchasi" varianti — hech biri tanlanmagan holat */}
                <label className="flex items-center gap-2.5 px-3 py-2 cursor-pointer
                  hover:bg-slate-50 dark:hover:bg-slate-700/50 select-none">
                  <input
                    type="checkbox"
                    checked={selectedOperatorIds.length === 0}
                    onChange={() => setSelectedOperatorIds([])}
                    className="accent-indigo-500 w-3.5 h-3.5 flex-shrink-0"
                  />
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    Barcha operatorlar (teng taqsimlash)
                  </span>
                </label>
                {/* Har bir operator uchun checkbox */}
                {operators.map((op) => (
                  <label key={op.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer
                    hover:bg-slate-50 dark:hover:bg-slate-700/50 select-none">
                    <input
                      type="checkbox"
                      checked={selectedOperatorIds.includes(op.id)}
                      onChange={() => toggleOperator(op.id)}
                      className="accent-indigo-500 w-3.5 h-3.5 flex-shrink-0"
                    />
                    <span className="text-sm text-slate-600 dark:text-slate-300">{op.displayName}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Allaqachon biriktirilganlar haqida ogohlantirish */}
            {alreadyAssigned.length > 0 && (
              <div className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400
                bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-900
                rounded-lg px-3 py-2 mb-3">
                <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
                <span>
                  {alreadyAssigned.length} ta lid{activeFilterLabel ? ` (${activeFilterLabel})` : ""} allaqachon
                  operatorga biriktirilgan — taqsimlanmaydi
                </span>
              </div>
            )}

            {/* Operator preview */}
            <div className="flex flex-col gap-1.5 mb-4">
              {preview.map((p) => (
                <div key={p.operatorId}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 text-sm">
                  <span className="text-slate-600 dark:text-slate-300">{p.displayName}</span>
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">
                    {p.count} ta
                  </span>
                </div>
              ))}
              {operators.length === 0 && (
                <p className="text-xs text-slate-400">Operatorlar topilmadi</p>
              )}
            </div>

            <button
              onClick={handleDistribute}
              disabled={matched.length === 0 || distributing || operators.length === 0}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition
                ${success ? "bg-emerald-500" : "bg-indigo-500 hover:bg-indigo-600"}
                disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {distributing && <Loader2 size={14} className="animate-spin" />}
              {success ? <CheckCircle2 size={14} /> : <Shuffle size={14} />}
              {success ? "Taqsimlandi!" : "Taqsimlashni boshlash"}
            </button>

            {error && (
              <p className="flex items-center gap-1.5 text-xs text-rose-600 mt-2">
                <AlertCircle size={12} /> {error}
              </p>
            )}
          </div>

          {/* Yo'riqnoma */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-1.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Info size={12} className="text-slate-400" />
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Qanday ishlaydi:</p>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              1. Fan tanlang <span className="text-slate-400">(faqat 1 ta, bazada ma'lumot bo'lsa)</span>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              2. Sinf tanlang <span className="text-slate-400">(ixtiyoriy)</span>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              3. Operator(lar) tanlang <span className="text-slate-400">(ixtiyoriy — hech biri tanlanmasa barcha operatorlarga teng bo'linadi; bir yoki bir nechasi tanlansa faqat shular orasida teng taqsimlanadi)</span>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              4. "Taqsimlashni boshlash" tugmasini bosing
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              5. Taqsimlangandan keyin operatorlar kanban orqali ishlaydi
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────
// "Vazifa" — fan + sinf bo'yicha filtrlab, hali operatorga
// biriktirilmagan lidlarni operatorlar orasida teng taqsimlash.
// Filtrlash butunlay client-side (leads allaqachon yuklangan) — hech
// qanday so'rov yubormaydi, faqat "Taqsimlashni boshlash" bosilganda
// backend chaqiriladi. Boshqa sahifalarga (Ish stoli, Reja, Sozlamalar,
// Jadval) hech qanday ta'sir qilmaydi.
// ─────────────────────────────────────────────

import { useMemo, useState } from "react";
import { Shuffle, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { SUBJECTS } from "./constants";
import { api } from "./api";

const GRADES = ["5", "6", "7", "8", "9", "10", "11"];

// Excel import orqali kelgan "Qaysi fanlarga qiziqasiz" ustuni erkin matn
// bo'lgani uchun ko'plab imlo variantlari mavjud (masalan "ingliz tiliga
// ko'proq", "ingliz tilli"). Shu sabab aniq moslik o'rniga har bir fan
// uchun kichik-katta harflarga sezgir bo'lmagan "ildiz" (stem) qidiruvi
// ishlatiladi — backenddagi distribution.js bilan bir xil ro'yxat.
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

function matchesSubject(leadSubjects, subjectFilter) {
  if (!subjectFilter) return true;
  // subjects bo'sh [], null yoki undefined bo'lsa — fan filtri tanlangan
  // paytda bunday lidlar hech qachon mos kelmaydi (va .some() xato
  // bermaydi, agar massiv bo'lmasa).
  if (!Array.isArray(leadSubjects) || leadSubjects.length === 0) return false;
  const stems = subjectStems(subjectFilter);
  const filterLower = subjectFilter.toLowerCase();
  return leadSubjects.some((s) => {
    const lower = String(s).toLowerCase();
    // "hamma fanlarga" (yoki shunga o'xshash) — har qanday fan filtriga mos keladi
    if (lower.includes("hamma fan")) return true;
    // Mavjud stem-asosidagi tekshiruv
    if (stems.some((stem) => lower.includes(stem))) return true;
    // Ikki tomonlama fuzzy substring: element filtr nomini o'z ichiga
    // olsa, YOKI element filtr nomining qisqartirilgan shakli bo'lsa
    // (masalan "geo" ~ "Geografiya"). Teskari yo'nalishda kamida 3
    // belgili elementlar bilan cheklangan — aks holda "a" kabi juda
    // qisqa/chalkash qiymatlar har qanday filtrga mos kelib qolardi.
    return lower.includes(filterLower) || (lower.length >= 3 && filterLower.includes(lower));
  });
}

function gradeNumber(grade) {
  const m = String(grade || "").trim().match(/^\d+/);
  return m?.[0] ?? null;
}

function splitEvenly(total, operators) {
  if (operators.length === 0) return [];
  const base = Math.floor(total / operators.length);
  const remainder = total % operators.length;
  return operators.map((op, i) => ({
    operatorId: op.id,
    displayName: op.displayName,
    count: base + (i < remainder ? 1 : 0),
  }));
}

export default function VazifaPage({ leads, operators, onDistributed }) {
  const [subjectFilter, setSubjectFilter] = useState(null);
  const [gradeFilter, setGradeFilter] = useState(null);
  const [distributing, setDistributing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Fan+sinf filtriga mos kelgan, LEKIN hali operatorga biriktirilmagan
  // lidlar — IRON RULE (leads.js /leads/distribute bilan bir xil qoida):
  // allaqachon biriktirilgan lid (oldingi Vazifa yurishidan yoki boshqa
  // yo'l bilan) hech qachon qayta yozilmaydi, shu sabab har bir filtr
  // partiyasi mustaqil bo'ladi va oldingi partiyalar bilan kesishmaydi.
  const matchesFilter = useMemo(() => {
    return leads.filter((l) => {
      if (!matchesSubject(l.subjects, subjectFilter)) return false;
      console.log('DEBUG grade compare — raw stored grade:', JSON.stringify(l.grade), 'selected gradeFilter:', JSON.stringify(gradeFilter));
      if (gradeFilter && gradeNumber(l.grade) !== gradeFilter) return false;
      return true;
    });
  }, [leads, subjectFilter, gradeFilter]);

  const matched = useMemo(
    () => matchesFilter.filter((l) => l.assignedOperatorId == null),
    [matchesFilter]
  );

  // Faqat ma'lumot uchun — filtrga mos keladigan, lekin shu sabab
  // "Tanlandi"ga kirmagan (allaqachon biriktirilgan) lidlar soni.
  const alreadyAssignedCount = matchesFilter.length - matched.length;

  const preview = useMemo(() => splitEvenly(matched.length, operators), [matched.length, operators]);

  const handleDistribute = async () => {
    setDistributing(true);
    setError("");
    setSuccess(false);
    try {
      await api.distributeFiltered(subjectFilter, gradeFilter);
      setSuccess(true);
      setSubjectFilter(null);
      setGradeFilter(null);
      onDistributed();
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      setError(err.message || "Taqsimlashda xatolik");
    } finally {
      setDistributing(false);
    }
  };

  return (
    <main className="flex-1 min-h-0 overflow-auto p-4 sm:p-6">
      <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Vazifa — Operatorlarga taqsimlash</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Chap ustun: statistika + filtrlar */}
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 text-center">
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{leads.length}</p>
              <p className="text-xs text-slate-400 mt-1">Jami</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 text-center">
              <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{matched.length}</p>
              <p className="text-xs text-slate-400 mt-1">Tanlandi</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3">Fan</p>
            <div className="flex flex-col gap-1.5">
              {SUBJECTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSubjectFilter((cur) => (cur === s ? null : s))}
                  className={`text-left px-3 py-2 rounded-lg border text-sm font-medium transition
                    ${subjectFilter === s
                      ? "bg-indigo-500 text-white border-indigo-500"
                      : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-indigo-300"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3">Sinf</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {GRADES.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => {
                    console.log('DEBUG grade button clicked — value:', JSON.stringify(g));
                    setGradeFilter((cur) => (cur === g ? null : g));
                  }}
                  className={`w-11 h-11 rounded-lg border text-sm font-semibold transition
                    ${gradeFilter === g
                      ? "bg-indigo-500 text-white border-indigo-500"
                      : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-indigo-300"}`}
                >
                  {g}
                </button>
              ))}
            </div>
            {(subjectFilter || gradeFilter) && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                {subjectFilter || "Barcha fanlar"} · {gradeFilter ? `${gradeFilter}-sinf` : "barcha sinflar"} → {matched.length} ta
              </p>
            )}
          </div>
        </div>

        {/* O'ng ustun: taqsimlash paneli */}
        <div className="flex flex-col gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-emerald-400 dark:border-emerald-500 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Shuffle size={16} className="text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Operatorlarga taqsimlash</p>
              </div>
              <span className="text-[11px] text-slate-400">{matched.length} ÷ {operators.length} operator</span>
            </div>

            {alreadyAssignedCount > 0 && (
              <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10
                border border-amber-100 dark:border-amber-900 rounded-lg px-3 py-2 mb-3">
                <AlertCircle size={12} className="flex-shrink-0" />
                {alreadyAssignedCount} ta lid filtrga mos keladi, lekin allaqachon operatorga biriktirilgani uchun "Tanlandi"ga kiritilmadi
              </p>
            )}

            <div className="flex flex-col gap-1.5 mb-4">
              {preview.map((p) => (
                <div key={p.operatorId} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 text-sm">
                  <span className="text-slate-600 dark:text-slate-300">{p.displayName}</span>
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">{p.count} ta</span>
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
                disabled:opacity-50 disabled:cursor-not-allowed`}
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

          <div className="bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl border border-indigo-100 dark:border-indigo-900 p-4">
            <p className="text-xs text-indigo-700 dark:text-indigo-400">
              Chapdan fan va sinf tanlang → natija avtomatik hisoblanadi → "Taqsimlashni boshlash" tugmasi bilan
              hali operatorga biriktirilmagan lidlar operatorlarga teng taqsimlanadi.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

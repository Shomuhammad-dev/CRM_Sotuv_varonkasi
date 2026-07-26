// ─────────────────────────────────────────────
// AMO CRM uslubidagi izohlar tarixi — field #14 o'rniga
// ─────────────────────────────────────────────

import { useState, useEffect } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { api } from "./api";

const MONTHS_UZ = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

function formatCommentDate(iso) {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()}-${MONTHS_UZ[d.getMonth()]} ${hh}:${mm}`;
}

export default function LeadComments({ leadId }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api.getLeadComments(leadId)
      .then((rows) => { if (!cancelled) setComments(rows); })
      .catch((err) => { if (!cancelled) setError(err.message || "Izohlarni yuklashda xatolik"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [leadId]);

  const handleAdd = async () => {
    const trimmed = text.trim();
    if (!trimmed || posting) return;
    setPosting(true);
    setError("");
    try {
      const saved = await api.addLeadComment(leadId, trimmed);
      setComments((prev) => [saved, ...prev]);
      setText("");
    } catch (err) {
      setError(err.message || "Izohni saqlashda xatolik");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
        14. Izohlar
      </label>

      <div className="flex items-start gap-2">
        <textarea
          rows={2}
          placeholder="Izoh yozing..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-100
            placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/20
            outline-none transition resize-none"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!text.trim() || posting}
          className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-600 text-white
            px-3 py-2 rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          {posting && <Loader2 size={13} className="animate-spin" />}
          Qo'shish
        </button>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-rose-600 mt-1">
          <AlertCircle size={12} /> {error}
        </p>
      )}

      <div className="mt-2 max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700 border-t border-slate-100 dark:border-slate-700">
        {loading && <p className="text-xs text-slate-400 py-2">Yuklanmoqda...</p>}
        {!loading && comments.length === 0 && (
          <p className="text-xs text-slate-400 py-2">Hali izoh yo'q</p>
        )}
        {!loading && comments.map((c) => (
          <div key={c.id} className="py-2">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {c.operator_name || "Noma'lum"} · {formatCommentDate(c.created_at)}
            </p>
            <p className="text-sm text-slate-700 dark:text-slate-200 mt-0.5 whitespace-pre-wrap">{c.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

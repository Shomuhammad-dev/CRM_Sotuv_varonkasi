// ─────────────────────────────────────────────
// ReminderModal — SoftCRM uslubida eslatma qo'shish
// Faqat yangi reminder yaratadi. Mavjud hech narsaga tegmaydi.
// ─────────────────────────────────────────────

import { useState } from "react";
import { X, Bell, Loader2, AlertCircle } from "lucide-react";
import { api } from "./api";

function todayStr() {
  return new Date().toISOString().slice(0, 10); // "2026-07-26"
}

export default function ReminderModal({ lead, onClose, onSaved, operators = [], isAdmin = false, currentUserId }) {
  const [date, setDate]   = useState(todayStr());
  const [time, setTime]   = useState("09:00");
  const [note, setNote]   = useState("");
  const [opId, setOpId]   = useState(currentUserId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const handleSave = async () => {
    if (!date || !time) {
      setError("Sana va vaqtni kiriting");
      return;
    }
    setSaving(true);
    setError("");
    try {
      // remind_at = ISO string: "2026-07-26T09:00:00"
      const remindAt = new Date(`${date}T${time}:00`).toISOString();
      await api.addReminder({
        lead_id: lead.id,
        operator_id: isAdmin && opId ? Number(opId) : undefined,
        remind_at: remindAt,
        note: note.trim() || undefined,
      });
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message || "Saqlashda xatolik");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && !saving && onClose()}
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm
        animate-in fade-in slide-in-from-bottom-4 duration-200 overflow-hidden">

        {/* Header */}
        <div className="bg-indigo-500 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-white" />
            <span className="text-sm font-semibold text-white">Eslatma qo'shish</span>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="text-white/70 hover:text-white transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Lead nomi */}
        <div className="px-4 pt-3 pb-0">
          <p className="text-[11px] text-slate-400 uppercase font-semibold tracking-wide">Lid</p>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-0.5">{lead.fullName}</p>
        </div>

        {/* Form */}
        <div className="px-4 pt-3 pb-4 flex flex-col gap-3">

          {/* Sana + Vaqt */}
          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Sana</label>
              <input
                type="date"
                value={date}
                min={todayStr()}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700
                  px-3 py-2 text-sm text-slate-800 dark:text-slate-100
                  focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/20
                  outline-none transition"
              />
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Vaqt</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700
                  px-3 py-2 text-sm text-slate-800 dark:text-slate-100
                  focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/20
                  outline-none transition"
              />
            </div>
          </div>

          {/* Mas'ul operator — faqat admin */}
          {isAdmin && operators.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Mas'ul operator</label>
              <select
                value={opId}
                onChange={(e) => setOpId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700
                  px-3 py-2 text-sm text-slate-800 dark:text-slate-100
                  focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/20
                  outline-none transition"
              >
                <option value="">Admin (men)</option>
                {operators.map((o) => (
                  <option key={o.id} value={o.id}>{o.displayName}</option>
                ))}
              </select>
            </div>
          )}

          {/* Izoh */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Izoh (ixtiyoriy)</label>
            <textarea
              rows={3}
              placeholder="Masalan: ota-onasi bilan narx haqida gaplashish kerak..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700
                px-3 py-2 text-sm text-slate-800 dark:text-slate-100
                placeholder:text-slate-400
                focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/20
                outline-none transition resize-none"
            />
          </div>

          {/* Xato */}
          {error && (
            <div className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 dark:bg-rose-500/10
              border border-rose-100 dark:border-rose-500/20 rounded-lg px-3 py-2">
              <AlertCircle size={13} />
              {error}
            </div>
          )}

          {/* Tugmalar */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm font-medium
                text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              Bekor qilish
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !date || !time}
              className={`px-5 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2 transition
                ${saving || !date || !time
                  ? "bg-slate-300 dark:bg-slate-600 cursor-not-allowed"
                  : "bg-indigo-500 hover:bg-indigo-600 shadow-sm"}`}
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              Saqlash
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

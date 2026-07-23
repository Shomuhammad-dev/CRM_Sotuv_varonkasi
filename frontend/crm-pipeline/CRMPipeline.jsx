// ╔══════════════════════════════════════════════════════════════╗
// ║  O'quv Markazi CRM — Sotuv Varonkasi                        ║
// ║  ReactJS + Tailwind CSS + Lucide Icons                       ║
// ║  Barcha qurilmalarda responsive, 12 maydon, Drag & Drop      ║
// ╚══════════════════════════════════════════════════════════════╝

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  Plus, Search, Filter, X, Edit3, Phone, User,
  MapPin, School, BookOpen, GripVertical, Check, XCircle,
  Star, Users, ArrowRight, Loader2, Home, BarChart2, Menu,
  LogOut, LayoutGrid, Table2, AlertCircle, RotateCcw, Trash2,
  StickyNote, Monitor, CalendarDays, Shuffle, ListChecks,
  Settings, Sun, Moon, Languages, AlertTriangle,
} from "lucide-react";
import { STAGES, STAGE_STYLES, DISTRICTS, SUBJECTS, SECTORS, CLASSES, EMPTY_FORM } from "./constants";
import { LANGUAGES } from "./translations";
import { useAuth } from "./AuthContext";
import { useTheme } from "./ThemeContext";
import { useLanguage } from "./LanguageContext";
import { api } from "./api";
import LeadsTable from "./LeadsTable";

// ─────────────────────────────────────────────
// 3. YORDAMCHI KOMPONENTLAR
// ─────────────────────────────────────────────

/** Kirish maydoni (Input) */
function FormField({ label, required, children, hint }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

function Input({ className = "", ...props }) {
  return (
    <input
      className={`w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-100
        placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/20
        outline-none transition ${className}`}
      {...props}
    />
  );
}

function Select({ className = "", children, ...props }) {
  return (
    <select
      className={`w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-100
        focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/20 outline-none transition ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

function Textarea({ className = "", ...props }) {
  return (
    <textarea
      rows={2}
      className={`w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-100
        placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/20
        outline-none transition resize-none ${className}`}
      {...props}
    />
  );
}

/** Ko'p tanlov — fanlar */
function MultiSelect({ options, selected, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 min-h-[42px]">
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() =>
              onChange(active ? selected.filter((s) => s !== opt) : [...selected, opt])
            }
            className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition border
              ${active
                ? "bg-indigo-500 text-white border-indigo-500"
                : "bg-slate-100 text-slate-600 border-slate-200 hover:border-indigo-300"
              }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

/** Yopish tugmasi */
function CloseBtn({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
    >
      <X size={18} />
    </button>
  );
}

/** Chap tomondagi ingichka navigatsiya paneli (amoCRM uslubida, faqat admin) */
const REPORT_PERIODS = ["daily", "weekly", "monthly"];

function Sidebar({ view, reportPeriod, onNavigate, onSelectReport }) {
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const boardActive = view === "board";
  const tableActive = view === "table";
  const reportActive = view === "report";
  const settingsActive = view === "settings";

  return (
    <aside className="hidden sm:flex w-14 flex-shrink-0 h-full flex-col items-center
      bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 pt-3 gap-1 relative z-30">
      <button
        onClick={() => onNavigate("board")}
        title={t("sidebar_dashboard")}
        className={`flex flex-col items-center gap-1 w-12 py-2 rounded-xl transition
          ${boardActive ? "bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400" : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300"}`}
      >
        <Monitor size={19} />
        <span className="text-[9px] leading-tight text-center font-semibold">{t("sidebar_dashboard")}</span>
      </button>

      <button
        onClick={() => onNavigate("table")}
        title={t("sidebar_tasks")}
        className={`flex flex-col items-center gap-1 w-12 py-2 rounded-xl transition
          ${tableActive ? "bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400" : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300"}`}
      >
        <ListChecks size={19} />
        <span className="text-[9px] leading-tight text-center font-semibold">{t("sidebar_tasks")}</span>
      </button>

      <div className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          title={t("sidebar_plan")}
          className={`flex flex-col items-center gap-1 w-12 py-2 rounded-xl transition
            ${reportActive ? "bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400" : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300"}`}
        >
          <CalendarDays size={19} />
          <span className="text-[9px] leading-tight text-center font-semibold">{t("sidebar_plan")}</span>
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
            <div className="absolute left-full top-0 ml-1.5 z-40 bg-white dark:bg-slate-800 rounded-xl shadow-xl
              border border-slate-200 dark:border-slate-700 py-1.5 min-w-[140px]">
              {REPORT_PERIODS.map((id) => (
                <button
                  key={id}
                  onClick={() => { onSelectReport(id); setMenuOpen(false); }}
                  className={`flex items-center w-full px-3 py-2 text-xs text-left transition
                    ${reportActive && reportPeriod === id
                      ? "bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-semibold"
                      : "hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"}`}
                >
                  {t(`period_${id}`)}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <button
        onClick={() => onNavigate("settings")}
        title={t("sidebar_settings")}
        className={`flex flex-col items-center gap-1 w-12 py-2 rounded-xl transition
          ${settingsActive ? "bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400" : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300"}`}
      >
        <Settings size={19} />
        <span className="text-[9px] leading-tight text-center font-semibold">{t("sidebar_settings")}</span>
      </button>
    </aside>
  );
}

// ─────────────────────────────────────────────
// 4. LID KARTOCHKASI KOMPONENTI
// ─────────────────────────────────────────────

function LeadCard({ lead, displayNo, stages, onEdit, isDragging, dragHandleProps, onMobileStageChange, isAdmin }) {
  const { t } = useLanguage();
  const st = STAGE_STYLES[lead.stage];
  const [mobileMenu, setMobileMenu] = useState(false);

  return (
    <div
      className={`relative bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 shadow-sm transition-all duration-200 select-none
        ${isDragging
          ? "shadow-xl ring-2 " + st.ring + " rotate-1 scale-[1.02] opacity-95"
          : "hover:shadow-md hover:-translate-y-0.5"
        }`}
    >
      {/* Drag tutqichi (handle) */}
      <div
        {...dragHandleProps}
        className="absolute top-0 left-0 h-full w-6 flex items-center justify-center
          cursor-grab active:cursor-grabbing opacity-0 hover:opacity-30 transition-opacity"
      >
        <GripVertical size={14} className="text-slate-400" />
      </div>

      <div className="p-3 pl-5">
        {/* Yuqori qator: No + Ismi + Tugmalar */}
        <div className="flex items-start gap-2 mb-2">
          <span className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${st.count_color}`}>
            #{displayNo ?? lead.no}
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm leading-tight truncate">{lead.fullName}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{lead.school} · {lead.grade}-sinf</p>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            {/* Mobil: bosqich almashtirish */}
            <div className="relative md:hidden">
              <button
                onClick={() => setMobileMenu(!mobileMenu)}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition"
              >
                <ArrowRight size={13} className="text-slate-500 dark:text-slate-300" />
              </button>
              {mobileMenu && (
                <div className="absolute right-0 top-8 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl
                  min-w-[190px] py-1.5 overflow-hidden">
                  <p className="text-[10px] font-bold text-slate-400 px-3 pb-1 uppercase">Bosqichni o'zgartir</p>
                  {stages.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => { onMobileStageChange(lead.id, s.id); setMobileMenu(false); }}
                      disabled={s.id === lead.stage}
                      className={`flex items-center gap-2 w-full px-3 py-2 text-xs text-left transition
                        ${s.id === lead.stage
                          ? "bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-semibold"
                          : "hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"}`}
                    >
                      <span className={`w-2 h-2 rounded-full ${STAGE_STYLES[s.id].badge}`} />
                      {t(`stage_${s.id}`)}
                      {s.id === lead.stage && <Check size={11} className="ml-auto" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Ko'rish / Tahrirlash */}
            <button
              onClick={() => onEdit(lead)}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 hover:text-indigo-600 dark:hover:text-indigo-400 transition text-slate-500 dark:text-slate-300"
            >
              <Edit3 size={13} />
            </button>
          </div>
        </div>

        {/* Ma'lumotlar qatori */}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400 mb-2">
          <span className="flex items-center gap-1">
            <MapPin size={10} className="text-slate-400" />
            {lead.district}
          </span>
          <span className="flex items-center gap-1">
            <BookOpen size={10} className="text-slate-400" />
            {lead.sector}
          </span>
        </div>

        {/* Fanlar */}
        {lead.subjects.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {lead.subjects.slice(0, 3).map((s, i) => (
              <span key={`${s}-${i}`} className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-full text-[10px] font-medium">
                {s}
              </span>
            ))}
            {lead.subjects.length > 3 && (
              <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-full text-[10px]">
                +{lead.subjects.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Telefon */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
            <Phone size={10} className="text-slate-400" />
            <span className="font-medium text-slate-700 dark:text-slate-200">{lead.phonePersonal}</span>
          </div>
          {isAdmin && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full truncate max-w-[110px]
              ${lead.operatorName ? "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400" : "bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400"}`}>
              {lead.operatorName || "Biriktirilmagan"}
            </span>
          )}
        </div>
      </div>

      {/* Pastki rang chizig'i */}
      <div className={`h-0.5 rounded-b-xl ${st.badge}`} />
    </div>
  );
}

// ─────────────────────────────────────────────
// 5. LID FORMASI (Modal ichidagi 12 maydon)
// ─────────────────────────────────────────────

function LeadForm({ form, onChange, isAdmin, operators, mode }) {
  const { t } = useLanguage();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

      {/* 1. Tuman */}
      <FormField label={`1. ${t("field_1")}`} required>
        <Select value={form.district} onChange={(e) => onChange("district", e.target.value)}>
          <option value="">Tanlang...</option>
          {DISTRICTS.map((d) => <option key={d}>{d}</option>)}
        </Select>
      </FormField>

      {/* 2. Ism / Familya */}
      <FormField label={`2. ${t("field_2")}`} required>
        <Input
          placeholder="Masalan: Aziza Karimova"
          value={form.fullName}
          onChange={(e) => onChange("fullName", e.target.value)}
        />
      </FormField>

      {/* 3. Maktab */}
      <FormField label={`3. ${t("field_3")}`}>
        <Input
          placeholder="Masalan: 75-maktab"
          value={form.school}
          onChange={(e) => onChange("school", e.target.value)}
        />
      </FormField>

      {/* 4. Sinf */}
      <FormField label={`4. ${t("field_4")}`}>
        <Select value={form.grade} onChange={(e) => onChange("grade", e.target.value)}>
          <option value="">Tanlang...</option>
          {CLASSES.map((c) => <option key={c}>{c}</option>)}
        </Select>
      </FormField>

      {/* 5. Sektor */}
      <FormField label={`5. ${t("field_5")}`}>
        <div className="flex gap-2">
          {SECTORS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange("sector", s)}
              className={`flex-1 py-2 rounded-lg border text-sm font-medium transition
                ${form.sector === s
                  ? "bg-indigo-500 text-white border-indigo-500"
                  : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-indigo-300"
                }`}
            >
              {s}
            </button>
          ))}
        </div>
      </FormField>

      {/* 6. Kelajakda kim bo'lmoqchi */}
      <FormField label={`6. ${t("field_6")}`}>
        <Input
          placeholder="Masalan: Shifokor, Muhandis..."
          value={form.futureProfession}
          onChange={(e) => onChange("futureProfession", e.target.value)}
        />
      </FormField>

      {/* 7. Fanlar — to'liq kenglik */}
      <div className="sm:col-span-2">
        <FormField label={`7. ${t("field_7")}`} hint="Bir yoki bir nechta tanlang">
          <MultiSelect
            options={SUBJECTS}
            selected={form.subjects}
            onChange={(v) => onChange("subjects", v)}
          />
        </FormField>
      </div>

      {/* 8. Avvalgi markaz */}
      <div className="sm:col-span-2">
        <FormField label={`8. ${t("field_8")}`}>
          <Input
            placeholder="Masalan: Excellence markazi, 6 oy"
            value={form.prevCenter}
            onChange={(e) => onChange("prevCenter", e.target.value)}
          />
        </FormField>
      </div>

      {/* 9. Telefon — shaxsiy */}
      <FormField label={`9. ${t("field_9")}`}>
        <Input
          type="tel"
          placeholder="+998 90 000 00 00"
          value={form.phonePersonal}
          onChange={(e) => onChange("phonePersonal", e.target.value)}
        />
      </FormField>

      {/* 10. Telefon — ota */}
      <FormField label={`10. ${t("field_10")}`}>
        <Input
          type="tel"
          placeholder="+998 90 000 00 00"
          value={form.phoneFather}
          onChange={(e) => onChange("phoneFather", e.target.value)}
        />
      </FormField>

      {/* 11. Telefon — ona */}
      <FormField label={`11. ${t("field_11")}`}>
        <Input
          type="tel"
          placeholder="+998 90 000 00 00"
          value={form.phoneMother}
          onChange={(e) => onChange("phoneMother", e.target.value)}
        />
      </FormField>

      {/* 12. Bosqich */}
      <FormField label={`12. ${t("field_12")}`}>
        <Select value={form.stage} onChange={(e) => onChange("stage", e.target.value)}>
          {STAGES.map((s) => <option key={s.id} value={s.id}>{t(`stage_${s.id}`)}</option>)}
        </Select>
      </FormField>

      {/* 13. Operator (faqat admin) — biriktirilgan lidda o'zgartirib bo'lmaydi (Iron Rule) */}
      {isAdmin && (
        mode === "edit" && form.assignedOperatorId != null ? (
          <FormField label={`13. ${t("field_13")}`} hint="Lid operatorga biriktirilgach, operator o'zgartirilmaydi">
            <div className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900
              px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
              {operators.find((o) => o.id === form.assignedOperatorId)?.displayName || "Noma'lum operator"}
            </div>
          </FormField>
        ) : (
          <FormField label={`13. ${t("field_13")}`}>
            <Select
              value={form.assignedOperatorId ?? ""}
              onChange={(e) => onChange("assignedOperatorId", e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Biriktirilmagan</option>
              {operators.map((o) => (
                <option key={o.id} value={o.id}>{o.displayName}</option>
              ))}
            </Select>
          </FormField>
        )
      )}

      {/* 14. Izoh */}
      <FormField label={`14. ${t("field_14")}`}>
        <Textarea
          placeholder="Qo'ng'iroq natijasi, eslatma yoki boshqa izoh..."
          value={form.notes}
          onChange={(e) => onChange("notes", e.target.value)}
        />
      </FormField>
    </div>
  );
}

// ─────────────────────────────────────────────
// 6. LID KO'RISH MODALI (Batafsil ma'lumot)
// ─────────────────────────────────────────────

function DetailRow({ icon: Icon, label, value, highlight }) {
  if (!value && value !== 0) return null;
  return (
    <div className={`flex items-start gap-3 py-2.5 border-b border-slate-100 dark:border-slate-700 last:border-0`}>
      <div className={`mt-0.5 flex-shrink-0 ${highlight ? "text-indigo-500" : "text-slate-400"}`}>
        <Icon size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{label}</p>
        <p className={`text-sm font-medium mt-0.5 ${highlight ? "text-indigo-700 dark:text-indigo-400" : "text-slate-800 dark:text-slate-100"}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

function LeadDetailModal({ lead, displayNo, onClose, onEdit, onDelete, stages, onStageChange, isAdmin }) {
  const { t } = useLanguage();
  if (!lead) return null;
  const st = STAGE_STYLES[lead.stage];
  const stageName = t(`stage_${lead.stage}`);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col
        animate-in fade-in slide-in-from-bottom-4 duration-200">

        {/* Header */}
        <div className={`px-5 py-4 rounded-t-2xl border-b dark:border-slate-700 ${st.header} dark:bg-slate-800 border-l-4 flex items-center justify-between gap-3`}
          style={{ borderLeftColor: undefined }}>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-bold px-2 py-1 rounded-lg text-white ${st.badge}`}>
              #{displayNo ?? lead.no}
            </span>
            <div>
              <h2 className="font-bold text-slate-800 dark:text-slate-100 text-base leading-tight">{lead.fullName}</h2>
              <p className={`text-xs font-medium ${st.text}`}>{stageName}</p>
            </div>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => onEdit(lead)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5
                bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 hover:text-indigo-600 dark:hover:text-indigo-400
                hover:border-indigo-200 transition text-slate-700 dark:text-slate-200"
            >
              <Edit3 size={12} /> {t("btn_edit")}
            </button>
            {isAdmin && (
              <button
                onClick={() => onDelete(lead)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5
                  bg-white dark:bg-slate-700 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/20
                  transition"
              >
                <Trash2 size={12} /> {t("btn_delete")}
              </button>
            )}
            <CloseBtn onClick={onClose} />
          </div>
        </div>

        {/* Body — scroll */}
        <div className="flex-1 overflow-y-auto">
          {/* Bosqich almashtirish */}
          <div className="px-5 py-3 bg-slate-50 dark:bg-slate-900 border-b dark:border-slate-700">
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase mb-2">Bosqichni o'zgartirish</p>
            <div className="flex flex-wrap gap-1.5">
              {stages.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onStageChange(lead.id, s.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                    border transition ${s.id === lead.stage
                      ? `${STAGE_STYLES[s.id].badge} text-white border-transparent`
                      : "bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-300"}`}
                >
                  {s.id === lead.stage && <Check size={11} />}
                  {t(`stage_${s.id}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Ma'lumotlar */}
          <div className="px-5 divide-y divide-slate-50 dark:divide-slate-700">
            <DetailRow icon={MapPin}   label={`1. ${t("field_1")}`}  value={lead.district} />
            <DetailRow icon={User}     label={`2. ${t("field_2")}`}  value={lead.fullName} highlight />
            <DetailRow icon={School}   label={`3. ${t("field_3")}`}  value={lead.school} />
            <DetailRow icon={BookOpen} label={`4. ${t("field_4")}`}  value={lead.grade ? lead.grade + "-sinf" : ""} />
            <DetailRow icon={Users}    label={`5. ${t("field_5")}`}  value={lead.sector} />
            <DetailRow icon={Star}     label={`6. ${t("field_6")}`}  value={lead.futureProfession} />
            <DetailRow
              icon={BookOpen}
              label={`7. ${t("field_7")}`}
              value={lead.subjects.length ? lead.subjects.join(" · ") : "—"}
            />
            <DetailRow icon={Home}     label={`8. ${t("field_8")}`}   value={lead.prevCenter} />
            <DetailRow icon={Phone}    label={`9. ${t("field_9")}`}   value={lead.phonePersonal} highlight />
            <DetailRow icon={Phone}    label={`10. ${t("field_10")}`} value={lead.phoneFather} />
            <DetailRow icon={Phone}    label={`11. ${t("field_11")}`} value={lead.phoneMother} />
            {isAdmin && (
              <DetailRow icon={Users} label={`13. ${t("field_13")}`} value={lead.operatorName || "Biriktirilmagan"} />
            )}
            <DetailRow icon={StickyNote} label={`14. ${t("field_14")}`} value={lead.notes} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 7. YANGI / TAHRIRLASH MODALI
// ─────────────────────────────────────────────

function LeadFormModal({ mode, form, onChange, onSave, onClose, saving, isAdmin, operators, error }) {
  const { t } = useLanguage();
  const title = mode === "add" ? "Yangi lid qo'shish" : "Lidni tahrirlash";
  const isValid = form.fullName.trim() && form.district;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col
        animate-in fade-in slide-in-from-bottom-4 duration-200">

        {/* Header */}
        <div className="px-6 py-4 border-b dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg flex items-center justify-center">
              {mode === "add" ? <Plus size={16} className="text-indigo-600 dark:text-indigo-400" /> : <Edit3 size={15} className="text-indigo-600 dark:text-indigo-400" />}
            </div>
            <h2 className="font-bold text-slate-800 dark:text-slate-100 text-base">{title}</h2>
          </div>
          <CloseBtn onClick={onClose} />
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <LeadForm form={form} onChange={onChange} isAdmin={isAdmin} operators={operators} mode={mode} />
          {error && (
            <div className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50
              border border-rose-100 rounded-lg px-3 py-2 mt-4">
              <AlertCircle size={13} />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-b-2xl flex items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            <span className="text-rose-500">*</span> belgili maydonlar majburiy
          </p>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm font-medium
                text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition">
              {t("btn_cancel")}
            </button>
            <button
              onClick={onSave}
              disabled={!isValid || saving}
              className={`px-5 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2
                transition ${isValid && !saving
                  ? "bg-indigo-500 hover:bg-indigo-600 shadow-sm"
                  : "bg-slate-300 cursor-not-allowed"}`}
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              {mode === "add" ? t("btn_add") : t("btn_save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 8. STAGE USTUNI KOMPONENTI
// ─────────────────────────────────────────────

function StageColumn({ stage, leads, leadDisplayNo, onAddLead, onEdit, onMobileStageChange,
  onDragStart, onDragOver, onDrop, dragOverStage, draggingLead, stages, isAdmin }) {

  const { t } = useLanguage();
  const st = STAGE_STYLES[stage.id];
  const isOver = dragOverStage === stage.id;
  const StageIcon = stage.icon;

  return (
    <div
      className={`flex flex-col rounded-2xl border-2 transition-all duration-200 h-full min-h-[300px] flex-shrink-0
        w-[280px] sm:w-[300px] md:w-full md:min-w-0
        ${isOver ? "border-indigo-400 bg-indigo-50/60 dark:bg-indigo-500/10 shadow-lg" : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"}`}
      onDragOver={(e) => { e.preventDefault(); onDragOver(stage.id); }}
      onDrop={() => onDrop(stage.id)}
    >
      {/* Ustun sarlavhasi */}
      <div className={`px-3 py-3 rounded-t-2xl border-b-2 dark:border-slate-700 ${st.header} dark:bg-slate-800`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white ${st.badge}`}>
              <StageIcon size={14} />
            </div>
            <span className="font-bold text-slate-700 dark:text-slate-200 text-sm leading-tight">{t(`stage_${stage.id}`)}</span>
          </div>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${stage.count_color}`}>
            {leads.length}
          </span>
        </div>

        {/* Umumiy qiymat (lidlar soni) */}
        {leads.length > 0 && (
          <p className="text-[10px] text-slate-400 mt-1.5 ml-9">
            {leads.length} ta o'quvchi
          </p>
        )}
      </div>

      {/* Kartochkalar ro'yxati */}
      <div className="flex-1 min-h-0 p-2 flex flex-col gap-2 overflow-y-auto">
        {leads.length === 0 && (
          <div className={`flex-1 flex flex-col items-center justify-center py-8 text-center rounded-xl
            border-2 border-dashed transition-colors
            ${isOver ? "border-indigo-300 bg-indigo-50 dark:bg-indigo-500/10" : "border-slate-200 dark:border-slate-700"}`}>
            <StageIcon size={24} className="text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-xs text-slate-400">Bu bosqichda lid yo'q</p>
            {isOver && <p className="text-xs text-indigo-500 font-semibold mt-1">Bu yerga tashlang ↓</p>}
          </div>
        )}

        {leads.map((lead) => (
          <div
            key={lead.id}
            draggable
            onDragStart={() => onDragStart(lead)}
            className="touch-none"
          >
            <LeadCard
              lead={lead}
              displayNo={leadDisplayNo?.get(lead.id)}
              stages={stages}
              onEdit={onEdit}
              isDragging={draggingLead?.id === lead.id}
              onMobileStageChange={onMobileStageChange}
              dragHandleProps={{}}
              isAdmin={isAdmin}
            />
          </div>
        ))}

        {/* Drop zone ko'rsatgichi */}
        {isOver && leads.length > 0 && (
          <div className="h-16 rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50/60
            flex items-center justify-center text-xs text-indigo-500 font-semibold">
            Bu yerga tashlang ↓
          </div>
        )}
      </div>

      {/* Lid qo'shish tugmasi */}
      <div className="p-2 border-t border-slate-200 dark:border-slate-700">
        <button
          onClick={() => onAddLead(stage.id)}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl
            text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400
            hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm border border-transparent
            hover:border-slate-200 dark:hover:border-slate-700 transition"
        >
          <Plus size={13} />
          {t("newLead")}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 9. STATISTIKA KARTOCHKALARI
// ─────────────────────────────────────────────

function StatsBar({ leads }) {
  const { t } = useLanguage();
  const total   = leads.length;
  const won     = leads.filter((l) => l.stage === "won").length;
  const lost    = leads.filter((l) => l.stage === "lost").length;
  const active  = leads.filter((l) => !["won","lost"].includes(l.stage)).length;
  const convRate = total > 0 ? Math.round((won / total) * 100) : 0;

  const stats = [
    { label: t("stat_total"),      value: total,      color: "text-slate-700 dark:text-slate-200",   bg: "bg-slate-100 dark:bg-slate-800" },
    { label: t("stat_active"),     value: active,     color: "text-blue-700 dark:text-blue-400",    bg: "bg-blue-50 dark:bg-blue-500/10" },
    { label: t("stat_won"),        value: won,        color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
    { label: t("stat_lost"),       value: lost,       color: "text-rose-700 dark:text-rose-400",    bg: "bg-rose-50 dark:bg-rose-500/10" },
    { label: t("stat_conversion"), value: convRate+"%",color: "text-indigo-700 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-500/10" },
  ];

  return (
    <div className="flex-shrink-0 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      {stats.map((s) => (
        <div key={s.label} className={`${s.bg} rounded-xl px-4 py-3`}>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wide">{s.label}</p>
          <p className={`text-2xl font-black ${s.color} leading-none mt-1`}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// 9b. REJA HISOBOTI (Kunlik/Haftalik/Oylik) — faqat admin
// ─────────────────────────────────────────────

function ActivityReport({ period, onDistribute, distributing }) {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api.getActivity(period)
      .then((res) => { if (!cancelled) setData(res); })
      .catch((err) => { if (!cancelled) setError(err.message || "Hisobotni yuklashda xatolik"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [period]);

  const periodLabel = t(`period_${period}`);
  // "Yangi lidlar" — bosqich o'zgarishi emas, shu sabab hisobotda faqat
  // operator "ilgarilatgan" bosqichlar ko'rsatiladi.
  const stagesToShow = STAGES.filter((s) => s.id !== "new");

  const rows = data ? [...data.operators, ...(data.unassigned ? [data.unassigned] : [])] : [];
  const totals = Object.fromEntries(stagesToShow.map((s) => [s.id, 0]));
  rows.forEach((r) => stagesToShow.forEach((s) => { totals[s.id] += r.byStage[s.id] || 0; }));
  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);

  return (
    <main className="flex-1 min-h-0 overflow-auto p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{periodLabel} hisobot — operatorlar faoliyati</h2>
        {period === "daily" && (
          <button
            onClick={onDistribute}
            disabled={distributing}
            className="flex items-center gap-1.5 bg-violet-500 hover:bg-violet-600 text-white
              px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
          >
            {distributing ? <Loader2 size={13} className="animate-spin" /> : <Shuffle size={13} />}
            Bugungi importni operatorlarga teng taqsimlash
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-slate-400">Yuklanmoqda...</p>}
      {error && (
        <p className="flex items-center gap-1.5 text-sm text-rose-600"><AlertCircle size={14} /> {error}</p>
      )}

      {!loading && !error && data && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                <th className="text-left px-4 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase text-xs whitespace-nowrap">Operator</th>
                {stagesToShow.map((s) => (
                  <th key={s.id} className="text-center px-4 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase text-xs whitespace-nowrap">{t(`stage_${s.id}`)}</th>
                ))}
                <th className="text-center px-4 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase text-xs whitespace-nowrap">Jami</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={stagesToShow.length + 2} className="text-center py-8 text-sm text-slate-400">
                  Bu davrda faoliyat qayd etilmagan
                </td></tr>
              )}
              {rows.map((r) => {
                const rowTotal = stagesToShow.reduce((sum, s) => sum + (r.byStage[s.id] || 0), 0);
                return (
                  <tr key={r.operatorId ?? "unassigned"} className="border-b border-slate-100 dark:border-slate-700 last:border-0">
                    <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">{r.displayName}</td>
                    {stagesToShow.map((s) => (
                      <td key={s.id} className="text-center px-4 py-3 text-slate-600 dark:text-slate-300">
                        {r.byStage[s.id] ?? <span className="text-slate-300 dark:text-slate-600">0</span>}
                      </td>
                    ))}
                    <td className="text-center px-4 py-3 font-bold text-indigo-600 dark:text-indigo-400">
                      {rowTotal}
                    </td>
                  </tr>
                );
              })}
              {rows.length > 0 && (
                <tr className="bg-slate-50 dark:bg-slate-900 font-bold">
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">Jami</td>
                  {stagesToShow.map((s) => (
                    <td key={s.id} className="text-center px-4 py-3 text-slate-700 dark:text-slate-200">{totals[s.id]}</td>
                  ))}
                  <td className="text-center px-4 py-3 text-indigo-700 dark:text-indigo-400">{grandTotal}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

// ─────────────────────────────────────────────
// 9c. SOZLAMALAR — faqat admin
// ─────────────────────────────────────────────

function SettingsPage({ onWipeComplete }) {
  const { t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { lang, setLang } = useLanguage();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [wiping, setWiping] = useState(false);

  const handleWipe = async () => {
    setWiping(true);
    try {
      await api.wipeAllLeads();
      setConfirmOpen(false);
      onWipeComplete();
    } catch (err) {
      alert(err.message || "Xatolik yuz berdi");
    } finally {
      setWiping(false);
    }
  };

  return (
    <main className="flex-1 min-h-0 overflow-auto p-4 sm:p-6">
      <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">{t("settings_title")}</h2>

      <div className="flex flex-col gap-4 max-w-xl">
        {/* Ko'rinish rejimi */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3">{t("settings_theme_title")}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setTheme("light")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition
                ${theme === "light" ? "bg-indigo-500 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}
            >
              <Sun size={15} /> {t("settings_theme_light")}
            </button>
            <button
              onClick={() => setTheme("dark")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition
                ${theme === "dark" ? "bg-indigo-500 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}
            >
              <Moon size={15} /> {t("settings_theme_dark")}
            </button>
          </div>
        </div>

        {/* Til */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3 flex items-center gap-1.5">
            <Languages size={13} /> {t("settings_language_title")}
          </p>
          <div className="flex gap-2">
            {LANGUAGES.map((l) => (
              <button
                key={l.id}
                onClick={() => setLang(l.id)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition
                  ${lang === l.id ? "bg-indigo-500 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* Xavfli hudud */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-rose-200 dark:border-rose-900 p-4">
          <p className="text-xs font-bold text-rose-500 uppercase mb-3 flex items-center gap-1.5">
            <AlertTriangle size={13} /> {t("settings_danger_title")}
          </p>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-rose-600">{t("settings_clear_history")}</p>
              <p className="text-xs text-slate-400 mt-0.5">{t("settings_clear_history_desc")}</p>
            </div>
            <button
              onClick={() => setConfirmOpen(true)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold
                bg-rose-500 hover:bg-rose-600 text-white transition"
            >
              <Trash2 size={13} /> {t("settings_clear_history")}
            </button>
          </div>
        </div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && !wiping && setConfirmOpen(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6
            animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={19} className="text-rose-500" />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100">{t("settings_clear_confirm_title")}</h3>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">{t("settings_clear_confirm_body")}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={wiping}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-semibold
                  text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              >
                {t("btn_no")}
              </button>
              <button
                onClick={handleWipe}
                disabled={wiping}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold
                  text-white bg-rose-500 hover:bg-rose-600 transition disabled:opacity-60"
              >
                {wiping && <Loader2 size={13} className="animate-spin" />}
                {t("settings_clear_confirm_yes")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ─────────────────────────────────────────────
// 10. ASOSIY ILOVA KOMPONENTI
// ─────────────────────────────────────────────

export default function CRMPipeline() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const isAdmin = user.role === "admin";

  // ── State ────────────────────────────────
  const [leads,       setLeads]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState("");
  const [operators,   setOperators]   = useState([]);
  const [monitorOperatorId, setMonitorOperatorId] = useState(null); // real vaqtda kuzatilayotgan operator
  const [selectedSubject, setSelectedSubject] = useState(""); // fanlar statistikasida tanlangan fan

  // Ko'rinish: varonka (kanban) yoki jadval
  const [view, setView] = useState("board"); // "board" | "table" | "report"
  const [reportPeriod, setReportPeriod] = useState("daily"); // "daily" | "weekly" | "monthly"
  const [reportDistributing, setReportDistributing] = useState(false);

  // Qidiruv va filter
  const [search,      setSearch]      = useState("");
  const [filterDist,  setFilterDist]  = useState("");

  // Modallar
  const [formModal,   setFormModal]   = useState(null);   // null | "add" | "edit"
  const [detailLead,  setDetailLead]  = useState(null);   // ko'rish modali
  const [formData,    setFormData]    = useState(EMPTY_FORM);
  const [editingId,   setEditingId]   = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [formError,   setFormError]   = useState("");

  // Drag & Drop
  const [draggingLead,   setDraggingLead]   = useState(null);
  const [dragOverStage,  setDragOverStage]  = useState(null);

  // Mobil menyu
  const [mobileNav, setMobileNav] = useState(false);

  // ── Lidlarni backenddan yuklash ───────────
  // Faqat birinchi yuklashda butun ekranni spinner bilan yopamiz — keyingi
  // (masalan import'dan keyingi) yangilashlar fonda, joriy ko'rinishni
  // (va ochiq modalllarni) yashirmasdan bajariladi.
  const hasLoadedOnce = useRef(false);

  const loadLeads = useCallback(async () => {
    if (!hasLoadedOnce.current) setLoading(true);
    setLoadError("");
    try {
      const data = await api.getLeads();
      setLeads(data);
    } catch (err) {
      setLoadError(err.message || "Lidlarni yuklashda xatolik");
    } finally {
      hasLoadedOnce.current = true;
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  useEffect(() => {
    if (!isAdmin) return;
    api.getOperators().then(setOperators).catch(() => {});
  }, [isAdmin]);

  // ── Qidiruv va filter natijasi ────────────
  const filteredLeads = leads.filter((l) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      l.fullName.toLowerCase().includes(q) ||
      l.phonePersonal.includes(q) ||
      l.phoneFather.includes(q) ||
      l.phoneMother.includes(q) ||
      l.school.toLowerCase().includes(q) ||
      String(l.no).includes(q);
    const matchDist = !filterDist || l.district === filterDist;
    const matchOperator = !monitorOperatorId || l.assignedOperatorId === monitorOperatorId;
    return matchSearch && matchDist && matchOperator;
  });

  // ── Forma o'zgartirish ────────────────────
  const handleFormChange = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  // ── Yangi lid qo'shish ────────────────────
  const openAdd = (stageId = "new") => {
    setFormData({ ...EMPTY_FORM, stage: stageId });
    setEditingId(null);
    setFormError("");
    setFormModal("add");
  };

  // ── Lid tahrirlash ────────────────────────
  const openEdit = (lead) => {
    setDetailLead(null);
    setFormData({
      district: lead.district, fullName: lead.fullName, school: lead.school,
      grade: lead.grade, sector: lead.sector, futureProfession: lead.futureProfession,
      subjects: [...lead.subjects], prevCenter: lead.prevCenter, notes: lead.notes,
      phonePersonal: lead.phonePersonal, phoneFather: lead.phoneFather,
      phoneMother: lead.phoneMother, stage: lead.stage,
      assignedOperatorId: lead.assignedOperatorId ?? null,
    });
    setEditingId(lead.id);
    setFormError("");
    setFormModal("edit");
  };

  // ── Saqlash ───────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setFormError("");
    try {
      if (formModal === "add") {
        const created = await api.createLead(formData);
        setLeads((prev) => [created, ...prev]);
      } else {
        const updated = await api.updateLead(editingId, formData);
        setLeads((prev) => prev.map((l) => (l.id === editingId ? updated : l)));
      }
      setFormModal(null);
    } catch (err) {
      setFormError(err.message || "Saqlashda xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  };

  // ── Bosqich o'zgartirish (modal va mobil) ─
  const changeStage = async (leadId, newStage) => {
    const prevLeads = leads;
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, stage: newStage } : l));
    if (detailLead?.id === leadId) {
      setDetailLead((prev) => ({ ...prev, stage: newStage }));
    }
    try {
      await api.updateLead(leadId, { stage: newStage });
    } catch (err) {
      setLeads(prevLeads);
      alert(err.message || "Bosqichni o'zgartirishda xatolik");
    }
  };

  // ── O'chirish ──────────────────────────────
  const handleDeleteLead = async (lead) => {
    if (!window.confirm(`"${lead.fullName}" lidini o'chirmoqchimisiz? Bu amalni orqaga qaytarib bo'lmaydi.`)) return;
    try {
      await api.deleteLead(lead.id);
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
      setDetailLead(null);
    } catch (err) {
      alert(err.message || "O'chirishda xatolik");
    }
  };

  // ── Reja > Kunlik: bugungi importni taqsimlash ────
  const handleDistributeFromReport = async () => {
    const unassignedCount = leads.filter((l) => l.assignedOperatorId == null).length;
    if (unassignedCount === 0) {
      alert("Biriktirilmagan lid yo'q");
      return;
    }
    if (!window.confirm(`${unassignedCount} ta biriktirilmagan lid operatorlarga teng taqsimlanadi. Davom etasizmi?`)) return;
    setReportDistributing(true);
    try {
      const res = await api.distributeLeads();
      await loadLeads();
      alert(`${res.distributed} ta lid muvaffaqiyatli taqsimlandi`);
    } catch (err) {
      alert(err.message || "Taqsimlashda xatolik");
    } finally {
      setReportDistributing(false);
    }
  };

  // ── Har bir lid uchun toza, ketma-ket ko'rinadigan raqam ──
  // `lead.no` bazadagi xom `id` (import/o'chirish tarixi tufayli katta va
  // uzilishlar bilan bo'lishi mumkin) — foydalanuvchiga esa Ism/Familya
  // tartibidagi (backend qaytargan tartib) 1,2,3... ko'rsatiladi, Varonka,
  // Jadval va batafsil oynada bir xil bo'lishi uchun shu yerda hisoblanadi.
  const leadDisplayNo = useMemo(
    () => new Map(leads.map((l, i) => [l.id, i + 1])),
    [leads]
  );

  // ── Operatorlar bo'yicha taqsimot (admin uchun, tepada ko'rsatiladi) ─
  const operatorStats = useMemo(() => {
    if (!isAdmin) return { unassigned: 0, perOperator: [] };
    const counts = new Map(operators.map((o) => [o.id, 0]));
    let unassigned = 0;
    for (const l of leads) {
      if (l.assignedOperatorId == null) { unassigned++; continue; }
      if (counts.has(l.assignedOperatorId)) counts.set(l.assignedOperatorId, counts.get(l.assignedOperatorId) + 1);
    }
    return { unassigned, perOperator: operators.map((o) => ({ ...o, count: counts.get(o.id) || 0 })) };
  }, [isAdmin, leads, operators]);

  // ── Fanlar bo'yicha statistika ─────────────
  // Haqiqiy ma'lumotdagi subjects erkin matn (Excel'dan kelgan) — qat'iy
  // SUBJECTS ro'yxatiga emas, harf katta-kichikligi e'tiborsiz haqiqiy
  // qiymatlarga qarab dinamik hisoblanadi. Operator kuzatuvda bo'lsa
  // (monitorOperatorId), shu operatorning lidlariga qarab qayta hisoblanadi.
  const subjectStats = useMemo(() => {
    const scope = monitorOperatorId
      ? leads.filter((l) => l.assignedOperatorId === monitorOperatorId)
      : leads;
    const counts = new Map(); // key -> {key, label, count}
    for (const l of scope) {
      for (const s of l.subjects) {
        const key = s.trim().toLowerCase();
        if (!key) continue;
        const label = key.charAt(0).toUpperCase() + key.slice(1);
        const entry = counts.get(key) || { key, label, count: 0 };
        entry.count++;
        counts.set(key, entry);
      }
    }
    const total = scope.length || 1;
    return [...counts.values()]
      .map((e) => ({ ...e, percent: Math.round((e.count / total) * 100) }))
      .sort((a, b) => b.count - a.count);
  }, [leads, monitorOperatorId]);

  const selectedSubjectStat = subjectStats.find((s) => s.key === selectedSubject);

  // ── Operatorni real vaqtda kuzatish ───────
  // Admin bir operatorni tanlaganda, o'sha operator qilgan o'zgarishlarni
  // (qo'lda yangilamasdan) ko'rib turishi uchun fonda vaqti-vaqti bilan
  // qayta yuklaymiz. Kuzatuv o'chirilganda so'rov to'xtaydi.
  const toggleMonitor = (operatorId) => {
    setMonitorOperatorId((prev) => (prev === operatorId ? null : operatorId));
  };

  useEffect(() => {
    if (!monitorOperatorId) return;
    const interval = setInterval(() => { loadLeads(); }, 5000);
    return () => clearInterval(interval);
  }, [monitorOperatorId, loadLeads]);

  // ── Drag & Drop ───────────────────────────
  const onDragStart = (lead) => setDraggingLead(lead);

  const onDragOver = (stageId) => {
    if (draggingLead && draggingLead.stage !== stageId) setDragOverStage(stageId);
  };

  const onDrop = (targetStageId) => {
    if (draggingLead && draggingLead.stage !== targetStageId) {
      changeStage(draggingLead.id, targetStageId);
    }
    setDraggingLead(null);
    setDragOverStage(null);
  };

  // ── Barcha qurilmalarda drop ───────────────
  useEffect(() => {
    const clear = () => { setDraggingLead(null); setDragOverStage(null); };
    window.addEventListener("dragend", clear);
    return () => window.removeEventListener("dragend", clear);
  }, []);

  // ─────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────
  return (
    <div className="h-screen flex bg-slate-100 dark:bg-slate-950 overflow-hidden font-sans">
      {isAdmin && (
        <Sidebar
          view={view}
          reportPeriod={reportPeriod}
          onNavigate={setView}
          onSelectReport={(period) => { setReportPeriod(period); setView("report"); }}
        />
      )}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

      {/* ── NAVBAR ── */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm flex-shrink-0 z-30">
        <div className="flex items-center justify-between px-4 sm:px-6 h-14 gap-3">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <button className="md:hidden p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              onClick={() => setMobileNav(!mobileNav)}>
              <Menu size={18} className="text-slate-500 dark:text-slate-400" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl
                flex items-center justify-center shadow-sm">
                <BarChart2 size={16} className="text-white" />
              </div>
              <div>
                <p className="font-black text-slate-800 dark:text-slate-100 text-sm leading-none">{t("appName")}</p>
                <p className="text-[10px] text-slate-400 leading-none">{t("appSubtitle")}</p>
              </div>
            </div>
          </div>

          {/* Qidiruv */}
          <div className="flex-1 max-w-md hidden sm:block">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={t("searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800
                  text-sm text-slate-800 dark:text-slate-100 focus:border-indigo-300 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/20
                  outline-none transition placeholder:text-slate-400"
              />
              {search && (
                <button onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* O'ng tugmalar */}
          <div className="flex items-center gap-2">
            {/* Ko'rinish almashtirish */}
            <div className="hidden md:flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
              <button
                onClick={() => setView("board")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition
                  ${view === "board" ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}
              >
                <LayoutGrid size={13} /> {t("sidebar_dashboard")}
              </button>
            </div>

            {/* Tuman filteri */}
            <div className="relative hidden sm:block">
              <Filter size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={filterDist}
                onChange={(e) => setFilterDist(e.target.value)}
                className="pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800
                  text-xs font-medium text-slate-600 dark:text-slate-300 outline-none focus:border-indigo-300
                  focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/20 transition cursor-pointer"
              >
                <option value="">{t("allDistricts")}</option>
                {DISTRICTS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>

            <button
              onClick={() => openAdd()}
              className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-600 text-white
                px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition"
            >
              <Plus size={15} />
              <span className="hidden sm:inline">{t("newLead")}</span>
            </button>

            {/* Foydalanuvchi va chiqish */}
            <div className="flex items-center gap-2 pl-2 ml-1 border-l border-slate-200 dark:border-slate-700">
              <span className="hidden lg:block text-xs font-semibold text-slate-500 dark:text-slate-400 truncate max-w-[110px]">
                {user.displayName}
              </span>
              <button
                onClick={logout}
                title={t("logout")}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-500/20 hover:text-rose-600 dark:hover:text-rose-400 text-slate-500 dark:text-slate-400 transition"
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Mobil ko'rinish almashtirish */}
        <div className="md:hidden flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 mx-4 mb-3">
          <button
            onClick={() => setView("board")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition
              ${view === "board" ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 dark:text-slate-400"}`}
          >
            <LayoutGrid size={13} /> {t("sidebar_dashboard")}
          </button>
          <button
            onClick={() => setView("table")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition
              ${view === "table" ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 dark:text-slate-400"}`}
          >
            <Table2 size={13} /> {t("sidebar_tasks")}
          </button>
        </div>

        {/* Mobil qidiruv */}
        <div className="sm:hidden px-4 pb-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={t("searchPlaceholderShort")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800
                text-sm text-slate-800 dark:text-slate-100 outline-none placeholder:text-slate-400"
            />
          </div>
        </div>
      </header>

      {/* ── STATISTIKA + FILTR BLOKI — faqat "Ish stoli" (board) sahifasida ── */}
      {view === "board" && (
      <>
      {/* ── STATISTIKA ── */}
      <StatsBar leads={filteredLeads} />

      {/* ── OPERATORLAR BO'YICHA TAQSIMOT (faqat admin) — bosilsa shu operatorni kuzatish rejimi ── */}
      {isAdmin && operators.length > 0 && (
        <div className="flex-shrink-0 flex flex-col gap-1.5 px-4 sm:px-6 py-2 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="text-[10px] font-bold text-slate-400 uppercase flex-shrink-0">Operatorlar:</span>
            {operatorStats.perOperator.map((o) => {
              const active = monitorOperatorId === o.id;
              return (
                <button
                  key={o.id}
                  onClick={() => toggleMonitor(o.id)}
                  title="Bosib shu operatorni kuzating"
                  className={`flex-shrink-0 flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg transition
                    ${active
                      ? "bg-indigo-500 text-white ring-2 ring-indigo-300"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"}`}
                >
                  {o.displayName}: <span className={active ? "text-white" : "text-indigo-600 dark:text-indigo-400"}>{o.count}</span>
                </button>
              );
            })}
            {operatorStats.unassigned > 0 && (
              <span className="flex-shrink-0 text-[11px] font-semibold px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
                Biriktirilmagan: {operatorStats.unassigned}
              </span>
            )}
          </div>

          {monitorOperatorId && (
            <div className="flex items-center gap-2 text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
              </span>
              {operators.find((o) => o.id === monitorOperatorId)?.displayName} kuzatilmoqda — real vaqtda yangilanadi
              <button onClick={() => setMonitorOperatorId(null)} className="text-slate-400 hover:text-slate-600 underline font-medium ml-1">
                Chiqish
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── FANLAR BO'YICHA STATISTIKA (faqat admin) ── */}
      {isAdmin && subjectStats.length > 0 && (
        <div className="flex-shrink-0 flex flex-wrap items-center gap-2 px-4 sm:px-6 py-2 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
          <span className="text-[10px] font-bold text-slate-400 uppercase flex-shrink-0">Fan bo'yicha:</span>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800
              text-xs font-medium text-slate-600 dark:text-slate-300 outline-none focus:border-indigo-300 transition cursor-pointer"
          >
            <option value="">Fan tanlang...</option>
            {subjectStats.map((s) => (
              <option key={s.key} value={s.key}>{s.label} ({s.count})</option>
            ))}
          </select>
          {selectedSubjectStat && (
            <span className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
              {selectedSubjectStat.label}: {selectedSubjectStat.count} ta o'quvchi ({selectedSubjectStat.percent}%)
            </span>
          )}
        </div>
      )}
      </>
      )}

      {/* ── XATOLIK / YUKLANMOQDA ── */}
      {loadError && (
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-2.5 bg-rose-50 border-b border-rose-100 text-xs text-rose-600">
          <span className="flex items-center gap-1.5"><AlertCircle size={13} /> {loadError}</span>
          <button onClick={loadLeads} className="flex items-center gap-1 font-semibold hover:underline">
            <RotateCcw size={12} /> Qayta urinish
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-400">
          <Loader2 size={22} className="animate-spin" />
          <p className="text-sm">Yuklanmoqda...</p>
        </div>
      ) : view === "settings" ? (
        <SettingsPage onWipeComplete={loadLeads} />
      ) : view === "report" ? (
        <ActivityReport
          period={reportPeriod}
          onDistribute={handleDistributeFromReport}
          distributing={reportDistributing}
        />
      ) : view === "table" ? (
        <LeadsTable
          leads={filteredLeads}
          leadDisplayNo={leadDisplayNo}
          isAdmin={isAdmin}
          operators={operators}
          onOpenLead={(lead) => setDetailLead(lead)}
          onRefresh={loadLeads}
        />
      ) : (
        /* ── BOARD — gorizontal scroll (mobil) ── */
        <main className="flex-1 min-h-0 overflow-hidden">
          <div className="h-full overflow-x-auto overflow-y-hidden
            scroll-smooth snap-x snap-mandatory md:snap-none px-4 py-4">
            <div className="flex gap-4 h-full
              md:grid md:gap-3"
              style={{
                minWidth: "max-content",
                gridTemplateColumns: `repeat(${STAGES.length}, minmax(0, 1fr))`,
              }}
            >
              {STAGES.map((stage) => (
                <div key={stage.id} className="snap-start h-full min-h-0 md:snap-align-none flex flex-col">
                  <StageColumn
                    stage={stage}
                    stages={STAGES}
                    leads={filteredLeads.filter((l) => l.stage === stage.id)}
                    leadDisplayNo={leadDisplayNo}
                    onAddLead={openAdd}
                    onEdit={(lead) => setDetailLead(lead)}
                    onMobileStageChange={changeStage}
                    onDragStart={onDragStart}
                    onDragOver={onDragOver}
                    onDrop={onDrop}
                    dragOverStage={dragOverStage}
                    draggingLead={draggingLead}
                    isAdmin={isAdmin}
                  />
                </div>
              ))}
            </div>
          </div>
        </main>
      )}
      </div>

      {/* ── LID BATAFSIL MODALI ── */}
      {detailLead && (
        <LeadDetailModal
          lead={leads.find((l) => l.id === detailLead.id) ?? detailLead}
          displayNo={leadDisplayNo.get(detailLead.id)}
          stages={STAGES}
          onClose={() => setDetailLead(null)}
          onEdit={openEdit}
          onDelete={handleDeleteLead}
          onStageChange={changeStage}
          isAdmin={isAdmin}
        />
      )}

      {/* ── QO'SHISH / TAHRIRLASH MODALI ── */}
      {formModal && (
        <LeadFormModal
          mode={formModal}
          form={formData}
          onChange={handleFormChange}
          onSave={handleSave}
          onClose={() => setFormModal(null)}
          saving={saving}
          isAdmin={isAdmin}
          operators={operators}
          error={formError}
        />
      )}
    </div>
  );
}

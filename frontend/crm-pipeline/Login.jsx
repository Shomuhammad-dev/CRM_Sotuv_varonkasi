import { useState } from "react";
import { BarChart2, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "./AuthContext";
import { useLanguage } from "./LanguageContext";

export default function Login() {
  const { login } = useAuth();
  const { t } = useLanguage();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err.message || "Kirishda xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950 px-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl
            flex items-center justify-center shadow-sm mb-3">
            <BarChart2 size={22} className="text-white" />
          </div>
          <h1 className="font-black text-slate-800 dark:text-slate-100 text-lg leading-none">{t("appName")}</h1>
          <p className="text-xs text-slate-400 mt-1">{t("login_title")}</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
              {t("login_username")}
            </label>
            <input
              type="text"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t("login_username_placeholder")}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm
                text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:border-indigo-400
                focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/20 outline-none transition"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
              {t("login_password")}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm
                text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:border-indigo-400
                focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/20 outline-none transition"
            />
          </div>

          {error && (
            <div className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50
              border border-rose-100 rounded-lg px-3 py-2">
              <AlertCircle size={13} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className={`mt-2 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm
              font-semibold text-white transition ${
                loading || !username.trim() || !password
                  ? "bg-slate-300 cursor-not-allowed"
                  : "bg-indigo-500 hover:bg-indigo-600 shadow-sm"
              }`}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {t("login_submit")}
          </button>
        </form>
      </div>
    </div>
  );
}

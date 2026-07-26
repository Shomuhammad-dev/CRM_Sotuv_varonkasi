// ─────────────────────────────────────────────
// Backend bilan aloqa — fetch wrapper
// ─────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

function getToken() {
  return localStorage.getItem("token");
}

async function request(path, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.reload();
    throw new Error("Sessiya tugadi, qaytadan kiring");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Server bilan aloqa xatosi");
  return data;
}

export const api = {
  login: (username, password) =>
    request("/auth/login", { method: "POST", body: { username, password } }),

  getLeads: (operatorId) =>
    request(`/leads${operatorId ? `?operator=${operatorId}` : ""}`),

  createLead: (lead) => request("/leads", { method: "POST", body: lead }),

  updateLead: (id, lead) => request(`/leads/${id}`, { method: "PUT", body: lead }),

  assignLead: (id, operatorId) =>
    request(`/leads/${id}/assign`, { method: "PATCH", body: { operatorId } }),

  importLeads: (rows, defaultOperatorId) =>
    request("/leads/import", { method: "POST", body: { rows, defaultOperatorId } }),

  deleteLead: (id) => request(`/leads/${id}`, { method: "DELETE" }),

  bulkDeleteLeads: (ids) => request("/leads/bulk-delete", { method: "POST", body: { ids } }),

  bulkAssignLeads: (ids, operatorId) =>
    request("/leads/bulk-assign", { method: "POST", body: { ids, operatorId } }),

  distributeLeads: () => request("/leads/distribute", { method: "POST" }),
  distributeFiltered: (subjectFilter, gradeFilter) =>
    request("/distribute", { method: "POST", body: { subjectFilter, gradeFilter } }),

  getActivity: (period) => request(`/leads/activity?period=${period}`),

  getLeadComments: (leadId) => request(`/leads/${leadId}/comments`),
  addLeadComment: (leadId, text) => request(`/leads/${leadId}/comments`, { method: "POST", body: { text } }),

  getReminderCount: () => request("/reminders/count"),
  getReminders: () => request("/reminders"),
  addReminder: (data) => request("/reminders", { method: "POST", body: data }),
  updateReminder: (id, status) => request(`/reminders/${id}`, { method: "PATCH", body: { status } }),

  wipeAllLeads: () => request("/leads/wipe-all", { method: "POST" }),

  getOperators: () => request("/operators"),
};

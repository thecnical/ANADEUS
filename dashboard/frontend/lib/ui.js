export const h = React.createElement;
export const { useEffect, useMemo, useState } = React;

export function classNames(...values) {
  return values.filter(Boolean).join(" ");
}

export function severityTone(severity) {
  const value = String(severity || "").toLowerCase();
  if (value === "critical") {
    return "bg-red-500/15 text-red-300 ring-1 ring-red-400/30";
  }
  if (value === "high") {
    return "bg-orange-500/15 text-orange-300 ring-1 ring-orange-400/30";
  }
  if (value === "medium") {
    return "bg-yellow-500/15 text-yellow-300 ring-1 ring-yellow-400/30";
  }
  return "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30";
}

export function statusTone(status) {
  const value = String(status || "").toLowerCase();
  if (value === "completed" || value === "success" || value === "ready" || value === "reported") {
    return "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30";
  }
  if (value === "warning" || value === "partial" || value === "degraded") {
    return "bg-yellow-500/15 text-yellow-300 ring-1 ring-yellow-400/30";
  }
  if (value === "failed" || value === "error") {
    return "bg-red-500/15 text-red-300 ring-1 ring-red-400/30";
  }
  if (value === "running") {
    return "bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-400/30";
  }
  return "bg-slate-700/70 text-slate-200 ring-1 ring-slate-500/40";
}

export function formatPhase(value) {
  const text = String(value || "");
  return text ? `${text.slice(0, 1).toUpperCase()}${text.slice(1)}` : "Unknown";
}

export function metricCard(title, value, accent, hint = "") {
  return h("div", { className: classNames("glass-card rounded-2xl p-4", accent) }, [
    h("div", { className: "text-xs uppercase tracking-[0.28em] text-slate-400", key: "title" }, title),
    h("div", { className: "mt-3 text-3xl font-semibold text-white", key: "value" }, String(value)),
    h("div", { className: "mt-2 text-sm text-slate-400", key: "hint" }, hint),
  ]);
}

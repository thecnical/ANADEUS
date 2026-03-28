import { h } from "../lib/ui.js";

export function LiveLogPanel({ logs = [] }) {
  return h("section", { className: "glass-card rounded-3xl p-6" }, [
    h("div", { className: "text-xs uppercase tracking-[0.28em] text-cyan-300/80", key: "eyebrow" }, "Live Feed"),
    h("h2", { className: "mt-2 text-2xl font-semibold text-white", key: "title" }, "Recent Events"),
    h("div", { className: "mt-6 space-y-3 text-sm text-slate-300", key: "items" },
      logs.length > 0
        ? logs.map((entry, index) => h("div", { className: "log-line", key: `event-${index}` }, entry))
        : [h("div", { className: "text-slate-500", key: "empty" }, "No runtime events have been captured yet.")]),
  ]);
}

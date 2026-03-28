import { classNames, h, metricCard, statusTone } from "../lib/ui.js";

export function SystemStatusCard({ system = {} }) {
  const performance = system.performance || {};
  const logs = system.logs || {};

  return h("section", { className: "space-y-5" }, [
    h("div", { className: "grid gap-4 md:grid-cols-4", key: "metrics" }, [
      metricCard("Targets", system.targets?.length || 0, "border-cyan-500/10", "Workspace targets currently tracked."),
      metricCard("Active Agents", system.activeAgents?.length || 0, "border-emerald-500/10", "Agents observed in the live execution feed."),
      metricCard("Tool Runs", performance.toolExecutions || 0, "border-orange-500/10", "Aggregate tool executions across loaded phases."),
      metricCard("Cache Hits", performance.cacheHits || 0, "border-fuchsia-500/10", "Performance wins from workspace-backed reuse."),
    ]),
    h("div", { className: "glass-card rounded-3xl p-6", key: "agents" }, [
      h("div", { className: "flex flex-col gap-4 md:flex-row md:items-start md:justify-between", key: "header" }, [
        h("div", { key: "copy" }, [
          h("div", { className: "text-xs uppercase tracking-[0.28em] text-cyan-300/80", key: "eyebrow" }, "System Status"),
          h("h2", { className: "mt-2 text-2xl font-semibold text-white", key: "title" }, "Execution Health"),
        ]),
        h("div", { className: "flex flex-wrap gap-2", key: "chips" },
          (system.targets || []).slice(0, 6).map((item) => h("span", {
            className: classNames("inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em]", statusTone(item.executionStatus)),
            key: item.target,
          }, `${item.target} • ${item.executionStatus}`))),
      ]),
      h("div", { className: "mt-6 grid gap-4 lg:grid-cols-2", key: "logs" },
        Object.entries(logs).map(([name, entries]) => h("div", {
          className: "rounded-3xl border border-slate-800 bg-slate-950/80 p-5",
          key: name,
        }, [
          h("div", { className: "text-xs uppercase tracking-[0.25em] text-slate-400", key: "name" }, name),
          h("div", { className: "mt-4 space-y-3 text-xs text-slate-300", key: "lines" },
            entries.length > 0
              ? entries.map((entry, index) => h("div", { className: "log-line", key: `${name}-${index}` }, entry))
              : [h("div", { className: "text-slate-500", key: "empty" }, "No recent events recorded.")]),
        ]))),
    ]),
  ]);
}

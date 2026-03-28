import { classNames, formatPhase, h, statusTone } from "../lib/ui.js";

export function ProgressBoard({ progress = [], currentPhase, status }) {
  const completedCount = progress.filter((item) => item.status === "completed").length;
  const total = progress.length || 1;
  const percent = Math.round((completedCount / total) * 100);

  return h("section", { className: "glass-card rounded-3xl p-6" }, [
    h("div", { className: "flex flex-col gap-4 md:flex-row md:items-end md:justify-between", key: "header" }, [
      h("div", { key: "left" }, [
        h("div", { className: "text-xs uppercase tracking-[0.3em] text-cyan-300/80", key: "eyebrow" }, "Live Scan Monitor"),
        h("h2", { className: "mt-2 text-2xl font-semibold text-white", key: "title" }, "Execution Progress"),
        h("p", { className: "mt-2 max-w-2xl text-sm text-slate-400", key: "body" },
          "CLI and dashboard stay in sync through the shared workspace and live telemetry feed."),
      ]),
      h("div", { className: classNames("inline-flex rounded-full px-4 py-2 text-sm font-medium", statusTone(status)), key: "status" }, [
        h("span", { key: "label" }, `Current: ${formatPhase(currentPhase || "idle")}`),
      ]),
    ]),
    h("div", { className: "mt-6 overflow-hidden rounded-full bg-slate-900/80", key: "barWrap" }, [
      h("div", {
        className: "h-3 rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400 transition-all duration-500",
        key: "bar",
        style: { width: `${percent}%` },
      }),
    ]),
    h("div", { className: "mt-3 text-sm text-slate-400", key: "hint" }, `${completedCount} of ${total} major phases completed.`),
    h("div", { className: "mt-6 grid gap-3 md:grid-cols-5", key: "items" },
      progress.map((item) => h("div", {
        className: classNames("rounded-2xl px-4 py-4 text-sm font-medium", statusTone(item.status)),
        key: item.phase,
      }, [
        h("div", { className: "text-xs uppercase tracking-[0.25em] opacity-80", key: "phase" }, formatPhase(item.phase)),
        h("div", { className: "mt-2 text-base font-semibold", key: "status" }, formatPhase(item.status)),
      ]))),
  ]);
}

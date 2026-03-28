import { ProgressBoard } from "../components/ProgressBoard.js";
import { TargetView } from "../components/TargetView.js";
import { VulnerabilityPanel } from "../components/VulnerabilityPanel.js";
import { ReportViewer } from "../components/ReportViewer.js";
import { SystemStatusCard } from "../components/SystemStatusCard.js";
import { LiveLogPanel } from "../components/LiveLogPanel.js";
import { classNames, h, useMemo } from "../lib/ui.js";

export function DashboardPage({
  targets = [],
  selectedTarget,
  snapshot,
  system,
  vulnerabilities = [],
  filterText,
  onFilterChange,
  onSelectTarget,
  onCopyReport,
}) {
  const selectedSnapshot = selectedTarget ? snapshot?.targetDetails?.[selectedTarget] : null;
  const selectedVulnerabilities = useMemo(() => vulnerabilities.filter((item) => item.target === selectedTarget), [vulnerabilities, selectedTarget]);
  const liveLogs = system?.logs?.["system.log"] || [];

  return h("main", { className: "grid-shell min-h-screen px-4 py-8 md:px-8" }, [
    h("div", { className: "mx-auto flex w-full max-w-7xl flex-col gap-6", key: "wrap" }, [
      h("header", { className: "glass-card rounded-[2rem] p-6 md:p-8", key: "header" }, [
        h("div", { className: "flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between", key: "row" }, [
          h("div", { key: "copy" }, [
            h("div", { className: "text-xs uppercase tracking-[0.35em] text-cyan-300/80", key: "eyebrow" }, "ANADEUS Dashboard"),
            h("h1", { className: "mt-3 text-4xl font-semibold text-white md:text-5xl", key: "title" }, "AI Cybersecurity Orchestrator"),
            h("p", { className: "mt-4 max-w-3xl text-base text-slate-300", key: "body" },
              "Monitor reconnaissance, scanning, analysis, validation, and reporting in one local control surface with live workspace-backed updates."),
          ]),
          h("div", { className: "flex flex-col gap-3 sm:flex-row", key: "controls" }, [
            h("select", {
              className: "rounded-full border border-slate-700 bg-slate-950/90 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400",
              key: "target",
              onChange: (event) => onSelectTarget(event.target.value),
              value: selectedTarget || "",
            }, [
              h("option", { value: "", key: "placeholder" }, "Select target"),
              ...targets.map((target) => h("option", { value: target, key: target }, target)),
            ]),
            h("input", {
              className: "rounded-full border border-slate-700 bg-slate-950/90 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400",
              key: "search",
              onInput: (event) => onFilterChange(event.target.value),
              placeholder: "Filter vulnerabilities",
              value: filterText,
            }),
          ]),
        ]),
      ]),
      h("div", { className: "grid gap-6 xl:grid-cols-[1.35fr_0.95fr]", key: "hero" }, [
        h("div", { className: "space-y-6", key: "left" }, [
          h(ProgressBoard, {
            currentPhase: selectedSnapshot?.currentPhase,
            key: "progress",
            progress: selectedSnapshot?.progress || [],
            status: selectedSnapshot?.system?.executionStatus || "idle",
          }),
          h(TargetView, {
            key: "target-view",
            snapshot: selectedSnapshot,
            target: selectedTarget,
          }),
        ]),
        h("div", { className: "space-y-6", key: "right" }, [
          h(SystemStatusCard, {
            key: "system",
            system,
          }),
          h(LiveLogPanel, {
            key: "logs",
            logs: liveLogs,
          }),
        ]),
      ]),
      h("div", { className: "grid gap-6 xl:grid-cols-[1.15fr_0.85fr]", key: "lower" }, [
        h(VulnerabilityPanel, {
          filterText,
          key: "vulnerabilities",
          vulnerabilities: selectedTarget ? selectedVulnerabilities : vulnerabilities,
        }),
        h("div", { className: "space-y-6", key: "report-col" }, [
          h("div", { className: "glass-card rounded-3xl p-4", key: "report-tag" }, [
            h("div", { className: "text-xs uppercase tracking-[0.28em] text-slate-400", key: "label" }, "Selected Report"),
            h("div", { className: classNames("mt-2 text-lg font-semibold", selectedTarget ? "text-white" : "text-slate-500"), key: "value" }, selectedTarget || "No target selected"),
          ]),
          h(ReportViewer, {
            key: "report-viewer",
            markdown: selectedSnapshot?.report?.markdown,
            onCopy: onCopyReport,
            target: selectedTarget,
          }),
        ]),
      ]),
    ]),
  ]);
}

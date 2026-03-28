import { h } from "../lib/ui.js";

export function ReportViewer({ target, markdown = "", onCopy }) {
  const safeMarkdown = markdown || "# ANADEUS Report\n\nNo final report has been generated yet.\n";

  return h("section", { className: "glass-card rounded-3xl p-6" }, [
    h("div", { className: "flex flex-col gap-3 md:flex-row md:items-center md:justify-between", key: "header" }, [
      h("div", { key: "copy" }, [
        h("div", { className: "text-xs uppercase tracking-[0.28em] text-cyan-300/80", key: "eyebrow" }, "Report Viewer"),
        h("h2", { className: "mt-2 text-2xl font-semibold text-white", key: "title" }, "Final Report"),
      ]),
      h("div", { className: "flex gap-3", key: "actions" }, [
        h("button", {
          className: "rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400",
          key: "copy",
          onClick: () => onCopy?.(safeMarkdown),
          type: "button",
        }, "Copy"),
        h("a", {
          className: "rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-400 hover:text-white",
          href: `/api/report/${encodeURIComponent(target || "")}/download`,
          key: "download",
        }, "Download"),
      ]),
    ]),
    h("pre", { className: "report-markdown mt-6 overflow-x-auto rounded-3xl bg-slate-950/80 p-6 text-sm whitespace-pre-wrap text-slate-200", key: "report" }, safeMarkdown),
  ]);
}

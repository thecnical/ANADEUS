import { h, metricCard } from "../lib/ui.js";

function listBlock(title, values = [], emptyMessage) {
  return h("div", { className: "glass-card rounded-3xl p-5" }, [
    h("div", { className: "text-xs uppercase tracking-[0.28em] text-slate-400", key: "title" }, title),
    values.length > 0
      ? h("div", { className: "mt-4 flex flex-wrap gap-2", key: "items" },
        values.slice(0, 18).map((value) => h("span", {
          className: "rounded-full bg-slate-800/90 px-3 py-1 text-sm text-slate-200 ring-1 ring-cyan-500/20",
          key: String(value),
        }, String(value))))
      : h("div", { className: "mt-4 text-sm text-slate-500", key: "empty" }, emptyMessage),
  ]);
}

export function TargetView({ target, snapshot }) {
  const recon = snapshot?.recon || {};
  const scan = snapshot?.scan || {};

  return h("section", { className: "space-y-5" }, [
    h("div", { className: "flex items-end justify-between", key: "header" }, [
      h("div", { key: "copy" }, [
        h("div", { className: "text-xs uppercase tracking-[0.28em] text-cyan-300/80", key: "eyebrow" }, "Target View"),
        h("h2", { className: "mt-2 text-2xl font-semibold text-white", key: "title" }, target || "No target selected"),
      ]),
    ]),
    h("div", { className: "grid gap-4 md:grid-cols-4", key: "metrics" }, [
      metricCard("Subdomains", recon.subdomains?.length || 0, "border-cyan-500/10", "Discovered during reconnaissance."),
      metricCard("Alive Hosts", recon.alive_hosts?.length || 0, "border-emerald-500/10", "HTTP probing confirmed reachability."),
      metricCard("Open Ports", scan.open_ports?.length || 0, "border-orange-500/10", "Service exposure from nmap and scan telemetry."),
      metricCard("Technologies", new Set([...(recon.technologies || []), ...(scan.technologies || [])]).size, "border-fuchsia-500/10", "Combined stack visibility across phases."),
    ]),
    h("div", { className: "grid gap-4 lg:grid-cols-2", key: "gridA" }, [
      listBlock("Subdomains", recon.subdomains || [], "No subdomains captured yet."),
      listBlock("Technologies", [...new Set([...(recon.technologies || []), ...(scan.technologies || [])])], "Technology fingerprinting is still pending."),
    ]),
    h("div", { className: "grid gap-4 lg:grid-cols-2", key: "gridB" }, [
      listBlock("Endpoints", scan.endpoints || recon.endpoints || [], "No endpoints discovered yet."),
      listBlock("Directories", scan.directories || [], "Directory enumeration has not produced results yet."),
    ]),
  ]);
}

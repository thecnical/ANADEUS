import express from "express";
import { getReportMarkdown, getReports } from "../services/dashboard-data.js";

export function createReportsRouter(options = {}) {
  const router = express.Router();

  router.get("/api/reports", async (_request, response, next) => {
    try {
      const reports = await getReports(options);
      response.json({
        ok: true,
        reports,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/report/:id/download", async (request, response, next) => {
    try {
      const target = decodeURIComponent(request.params.id);
      const markdown = await getReportMarkdown(target, options);
      response.setHeader("Content-Type", "text/markdown; charset=utf-8");
      response.setHeader("Content-Disposition", `attachment; filename="${target}-final-report.md"`);
      response.send(markdown || `# ANADEUS Report\n\nNo report was generated for ${target}.\n`);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

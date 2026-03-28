import express from "express";
import { getVulnerabilities } from "../services/dashboard-data.js";

export function createVulnerabilitiesRouter(options = {}) {
  const router = express.Router();

  router.get("/api/vulnerabilities", async (_request, response, next) => {
    try {
      const vulnerabilities = await getVulnerabilities(options);
      response.json({
        ok: true,
        vulnerabilities,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

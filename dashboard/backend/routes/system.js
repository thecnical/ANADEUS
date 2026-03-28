import express from "express";
import { getSystemStatus } from "../services/dashboard-data.js";

export function createSystemRouter(options = {}) {
  const router = express.Router();

  router.get("/api/system/status", async (_request, response, next) => {
    try {
      const status = await getSystemStatus(options);
      response.json({
        ok: true,
        system: status,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

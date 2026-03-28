import express from "express";
import { getTargetSnapshot, listTargets } from "../services/dashboard-data.js";

export function createTargetsRouter(options = {}) {
  const router = express.Router();

  router.get("/api/targets", async (_request, response, next) => {
    try {
      const targets = await listTargets(options);
      response.json({
        ok: true,
        targets,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/target/:id", async (request, response, next) => {
    try {
      const target = decodeURIComponent(request.params.id);
      const snapshot = await getTargetSnapshot(target, options);
      response.json({
        ok: true,
        target,
        data: snapshot,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

import { startDashboardServer } from "../../../dashboard/backend/server.js";

export async function runDashboardMode(options = {}) {
  await startDashboardServer({
    host: options.host,
    port: options.port,
  });
}

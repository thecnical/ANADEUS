import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createServer } from "node:http";
import { Server as SocketServer } from "socket.io";
import { createTargetsRouter } from "./routes/targets.js";
import { createReportsRouter } from "./routes/reports.js";
import { createVulnerabilitiesRouter } from "./routes/vulnerabilities.js";
import { createSystemRouter } from "./routes/system.js";
import { createDashboardSocket } from "./socket.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const FRONTEND_ROOT = path.resolve(REPO_ROOT, "dashboard", "frontend");

export async function startDashboardServer(options = {}) {
  const app = express();
  const server = createServer(app);
  const io = new SocketServer(server, {
    cors: {
      origin: "*",
    },
  });
  const port = Number(options.port || process.env.ANADEUS_DASHBOARD_PORT || 4173);

  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  app.use(createTargetsRouter(options));
  app.use(createReportsRouter(options));
  app.use(createVulnerabilitiesRouter(options));
  app.use(createSystemRouter(options));

  app.get("/vendor/react.production.min.js", (_request, response) => {
    response.sendFile(path.resolve(REPO_ROOT, "node_modules", "react", "umd", "react.production.min.js"));
  });

  app.get("/vendor/react-dom.production.min.js", (_request, response) => {
    response.sendFile(path.resolve(REPO_ROOT, "node_modules", "react-dom", "umd", "react-dom.production.min.js"));
  });

  app.use(express.static(FRONTEND_ROOT));

  app.get("/{*splat}", (_request, response) => {
    response.sendFile(path.join(FRONTEND_ROOT, "index.html"));
  });

  app.use((error, _request, response, _next) => {
    response.status(500).json({
      ok: false,
      error: error.message,
    });
  });

  const dashboardSocket = createDashboardSocket(io, options);

  await new Promise((resolve) => {
    server.listen(port, options.host || "127.0.0.1", resolve);
  });

  const address = `http://${options.host || "127.0.0.1"}:${port}`;
  if (!options.quiet) {
    process.stdout.write(`ANADEUS dashboard running at ${address}\n`);
  }

  return {
    app,
    server,
    io,
    address,
    close() {
      dashboardSocket.stop();
      return new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  startDashboardServer().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}

import { getDashboardSnapshot } from "./services/dashboard-data.js";

const DEFAULT_REFRESH_MS = 2_000;

export function createDashboardSocket(io, options = {}) {
  let previousSerialized = "";

  async function broadcastSnapshot(force = false) {
    const snapshot = await getDashboardSnapshot(options);
    const serialized = JSON.stringify(snapshot);

    if (!force && serialized === previousSerialized) {
      return;
    }

    previousSerialized = serialized;
    io.emit("dashboard:update", snapshot);
  }

  const timer = setInterval(() => {
    broadcastSnapshot().catch((error) => {
      io.emit("dashboard:error", {
        message: error.message,
      });
    });
  }, options.refreshIntervalMs || DEFAULT_REFRESH_MS);

  io.on("connection", (socket) => {
    broadcastSnapshot(true).catch((error) => {
      socket.emit("dashboard:error", {
        message: error.message,
      });
    });

    socket.on("dashboard:refresh", async () => {
      await broadcastSnapshot(true);
    });
  });

  io.on("close", () => {
    clearInterval(timer);
  });

  return {
    stop() {
      clearInterval(timer);
    },
  };
}

import { APP_NAME } from "../config/defaults.js";
import { interpretAutoGoal } from "../services/auto-mode-service.js";
import { routeUserInput } from "../services/input-router.js";
import { formatCliResponse } from "../ui/formatters.js";

export function createCliRuntime({ mode, json }) {
  return {
    mode,
    json,
    async handleInput(input) {
      return routeUserInput({ mode, input });
    },
    async handleAutoGoal(goal) {
      const response = await interpretAutoGoal(goal);
      return {
        app: APP_NAME,
        mode,
        ...response,
      };
    },
    output(result) {
      process.stdout.write(`${formatCliResponse(result, { json })}\n`);
    },
  };
}

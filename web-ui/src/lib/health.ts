import { createServerFn } from "@tanstack/react-start";

import { requireUnlocked } from "./auth.ts";
import { loadStationHealth } from "./health.server.ts";

export const getStationHealth = createServerFn({ method: "GET" })
	.middleware([requireUnlocked])
	.handler(() => loadStationHealth());

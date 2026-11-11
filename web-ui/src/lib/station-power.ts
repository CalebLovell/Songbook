import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireUnlocked } from "./auth.ts";
import { powerStationFromRequest } from "./station-power.server.ts";

export const powerStationFn = createServerFn({ method: "POST" })
	.middleware([requireUnlocked])
	.validator(z.object({ action: z.enum(["reboot", "poweroff"]) }))
	.handler(({ data }) => powerStationFromRequest(data.action));

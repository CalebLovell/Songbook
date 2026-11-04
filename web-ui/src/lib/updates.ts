import { createServerFn } from "@tanstack/react-start";

import { requireUnlocked } from "./auth.ts";
import {
	checkForUpdates,
	loadUpdateState,
	startUpdater,
} from "./updates.server.ts";

export const getUpdateState = createServerFn({ method: "GET" })
	.middleware([requireUnlocked])
	.handler(() => loadUpdateState());

export const checkForUpdatesFn = createServerFn({ method: "POST" })
	.middleware([requireUnlocked])
	.handler(() => checkForUpdates());

export const installUpdateFn = createServerFn({ method: "POST" })
	.middleware([requireUnlocked])
	.handler(() => startUpdater("install"));

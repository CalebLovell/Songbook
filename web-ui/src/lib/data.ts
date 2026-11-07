import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireUnlocked } from "./auth.ts";
import { stationDataPaths } from "./data-backup.server.ts";
import {
	applyStagedRestore,
	deleteSafetyCopy,
	discardStagedBackup,
	RestoreRefused,
	readDataSummary,
	undoLastRestore,
} from "./data-restore.server.ts";

function withUserMessage<T>(work: () => Promise<T>, fallback: string) {
	return work().catch((error: unknown) => {
		console.error("[data]", error);
		throw new Error(error instanceof RestoreRefused ? error.message : fallback);
	});
}

export const getDataSummaryFn = createServerFn({ method: "GET" })
	.middleware([requireUnlocked])
	.handler(() =>
		withUserMessage(
			() => readDataSummary(stationDataPaths()),
			"The station's data couldn't be read.",
		),
	);

export const applyRestoreFn = createServerFn({ method: "POST" })
	.middleware([requireUnlocked])
	.validator(z.object({ id: z.uuid() }))
	.handler(({ data }) =>
		withUserMessage(
			() => applyStagedRestore(data.id, stationDataPaths()),
			"The restore failed. The station's data has not been deleted.",
		),
	);

export const undoRestoreFn = createServerFn({ method: "POST" })
	.middleware([requireUnlocked])
	.handler(() =>
		withUserMessage(
			() => undoLastRestore(stationDataPaths()),
			"The undo didn't finish. The safety copy was kept.",
		),
	);

export const deleteSafetyCopyFn = createServerFn({ method: "POST" })
	.middleware([requireUnlocked])
	.handler(() =>
		withUserMessage(
			() => deleteSafetyCopy(stationDataPaths()),
			"The safety copy couldn't be deleted.",
		),
	);

export const discardStagedBackupFn = createServerFn({ method: "POST" })
	.middleware([requireUnlocked])
	.handler(() =>
		withUserMessage(
			() => discardStagedBackup(stationDataPaths()),
			"The uploaded backup couldn't be discarded.",
		),
	);

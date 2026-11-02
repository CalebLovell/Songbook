import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { openWritableDetectionsDb, sqlite } from "~/db/index.ts";
import { extractedDir } from "~/lib/audio.server.ts";
import { requireUnlocked } from "~/lib/auth.ts";
import {
	correctDetection,
	deleteDetectionDirectly,
	loadReviewPage,
	loadSpeciesCatalog,
	recategorizeDetection,
} from "~/lib/review.server.ts";
import {
	normalizeReviewSearch,
	type SpeciesOption,
} from "~/lib/review-data.ts";
import { readReviewRareSpeciesMax } from "~/lib/settings.server.ts";

/** A detections row, as every Review action names the one it acts on. */
const rowIdSchema = z.object({ rowId: z.number().int().positive() });

export const getReviewPage = createServerFn({ method: "GET" })
	.middleware([requireUnlocked])
	.validator((input: Record<string, unknown>) => normalizeReviewSearch(input))
	.handler(async ({ data }) =>
		loadReviewPage(
			sqlite,
			extractedDir(),
			data,
			await readReviewRareSpeciesMax(),
		),
	);
export const getReviewSpecies = createServerFn({ method: "GET" })
	.middleware([requireUnlocked])
	.handler(() => loadSpeciesCatalog());
export const confirmReviewDetection = createServerFn({ method: "POST" })
	.middleware([requireUnlocked])
	.validator(rowIdSchema)
	.handler(({ data }) => {
		const writable = openWritableDetectionsDb();
		try {
			correctDetection(writable, data.rowId);
			return { ok: true };
		} finally {
			writable.close();
		}
	});
export const recategorizeReviewDetection = createServerFn({ method: "POST" })
	.middleware([requireUnlocked])
	.validator(
		rowIdSchema.extend({
			sciName: z.string().max(200),
			comName: z.string().max(200),
		}),
	)
	.handler(async ({ data }) => {
		const writable = openWritableDetectionsDb();
		try {
			return await recategorizeDetection(
				writable,
				extractedDir(),
				data.rowId,
				data as SpeciesOption,
				loadSpeciesCatalog(),
			);
		} finally {
			writable.close();
		}
	});
export const deleteReviewDetection = createServerFn({ method: "POST" })
	.middleware([requireUnlocked])
	.validator(rowIdSchema)
	.handler(async ({ data }) => {
		const writable = openWritableDetectionsDb();
		try {
			return await deleteDetectionDirectly(
				writable,
				extractedDir(),
				data.rowId,
			);
		} finally {
			writable.close();
		}
	});

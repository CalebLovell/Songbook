import { Readable } from "node:stream";
import { createFileRoute } from "@tanstack/react-router";

import { isSignedIn } from "~/lib/auth.server.ts";
import { stationDataPaths } from "~/lib/data-backup.server.ts";
import { detectionExportQuerySchema } from "~/lib/data-backup-format.ts";
import {
	detectionCsvChunks,
	detectionCsvFileName,
} from "~/lib/data-export.server.ts";
import { detectionSearchMatch } from "~/lib/detection-search.server.ts";

export const Route = createFileRoute("/api/data/export")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				if (!(await isSignedIn()))
					return new Response("Locked", { status: 401 });
				const params = new URL(request.url).searchParams;
				const query = detectionExportQuerySchema.parse({
					from: params.get("from") ?? undefined,
					to: params.get("to") ?? undefined,
					q: params.get("q") ?? undefined,
				});
				const filter = {
					from: query.from,
					to: query.to,
					match: query.q ? await detectionSearchMatch(query.q) : undefined,
				};
				const stream = Readable.from(
					detectionCsvChunks(stationDataPaths().databasePath, filter),
				);
				return new Response(Readable.toWeb(stream) as ReadableStream, {
					headers: {
						"Content-Type": "text/csv; charset=utf-8",
						"Content-Disposition": `attachment; filename="${detectionCsvFileName(filter)}"`,
						"Cache-Control": "private, no-store",
					},
				});
			},
		},
	},
});

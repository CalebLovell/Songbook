import { Readable } from "node:stream";
import { createFileRoute } from "@tanstack/react-router";

import { isSignedIn } from "~/lib/auth.server.ts";
import { recordBackup } from "~/lib/backup-log.server.ts";
import {
	createBackupStream,
	stationDataPaths,
} from "~/lib/data-backup.server.ts";

export const Route = createFileRoute("/api/data/backup")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				if (!(await isSignedIn()))
					return new Response("Locked", { status: 401 });
				const includeClips =
					new URL(request.url).searchParams.get("clips") !== "0";
				const day = new Date().toISOString().slice(0, 10);
				const name = `songbook-backup-${day}${includeClips ? "" : "-no-clips"}.tar`;
				const paths = stationDataPaths();
				const stream = createBackupStream(paths, includeClips);
				request.signal.addEventListener("abort", () => stream.destroy());
				stream.once("end", () => {
					recordBackup(paths).catch(() => {});
				});
				return new Response(Readable.toWeb(stream) as ReadableStream, {
					headers: {
						"Content-Type": "application/x-tar",
						"Content-Disposition": `attachment; filename="${name}"`,
						"Cache-Control": "private, no-store",
					},
				});
			},
		},
	},
});

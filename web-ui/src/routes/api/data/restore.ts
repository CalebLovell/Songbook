import { Readable } from "node:stream";
import type { ReadableStream as NodeWebStream } from "node:stream/web";
import { createFileRoute } from "@tanstack/react-router";

import { isSignedIn } from "~/lib/auth.server.ts";
import { stationDataPaths } from "~/lib/data-backup.server.ts";
import { RestoreRefused, stageBackup } from "~/lib/data-restore.server.ts";

function refused(message: string, status: number) {
	return Response.json({ message }, { status });
}

export const Route = createFileRoute("/api/data/restore")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				if (!(await isSignedIn())) return refused("Sign in to restore.", 401);
				if (!request.body) return refused("Choose a backup file.", 400);
				const length = Number(request.headers.get("content-length"));
				const source = Readable.fromWeb(request.body as NodeWebStream);
				request.signal.addEventListener("abort", () => source.destroy());
				try {
					const preview = await stageBackup(
						source,
						Number.isFinite(length) && length > 0 ? length : null,
						stationDataPaths(),
					);
					return Response.json(preview);
				} catch (error) {
					source.destroy();
					if (error instanceof RestoreRefused)
						return refused(error.message, error.status);
					console.error("[data] receiving a backup failed:", error);
					return refused("The backup couldn't be received.", 500);
				}
			},
		},
	},
});

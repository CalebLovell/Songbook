import { readFile, stat } from "node:fs/promises";
import { createFileRoute } from "@tanstack/react-router";

import { sqlite } from "~/db/index.ts";
import {
	extractedDir,
	mimeTypeFor,
	resolveExtractedFile,
} from "~/lib/audio.server.ts";
import { splitSpeciesAndFile } from "~/lib/audio.ts";
import { isPublicRecording } from "~/lib/best-recording.server.ts";
import { canHearEveryClip } from "~/lib/clip-access.server.ts";

export const Route = createFileRoute("/api/audio/$date/$speciesAndFile")({
	server: {
		handlers: {
			GET: async ({ params, request }) => {
				const [species, file] = splitSpeciesAndFile(params.speciesAndFile);
				const relativePath = `By_Date/${params.date}/${species}/${file}`;
				const resolved = resolveExtractedFile(relativePath);
				if (!resolved) {
					return new Response("Not found", { status: 404 });
				}

				const signedIn = await canHearEveryClip();
				const allowed =
					signedIn ||
					isPublicRecording(sqlite, extractedDir(), {
						date: params.date,
						speciesDir: species,
						fileName: file,
					});
				if (!allowed) return new Response("Locked", { status: 401 });

				try {
					const info = await stat(resolved);
					const etag = `"${info.size.toString(36)}-${Math.floor(info.mtimeMs).toString(36)}"`;
					const headers = {
						"Content-Type": mimeTypeFor(resolved),
						ETag: etag,
						"Cache-Control": "private, no-cache",
					};
					if (request.headers.get("if-none-match") === etag) {
						return new Response(null, { status: 304, headers });
					}
					const data = await readFile(resolved);
					return new Response(data, { headers });
				} catch {
					return new Response("Not found", { status: 404 });
				}
			},
		},
	},
});

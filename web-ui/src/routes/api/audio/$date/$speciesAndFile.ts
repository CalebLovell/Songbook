import { readFile, stat } from "node:fs/promises";
import { createFileRoute } from "@tanstack/react-router";

import { sqlite } from "~/db/index.ts";
import {
	extractedDir,
	mimeTypeFor,
	resolveExtractedFile,
} from "~/lib/audio.server.ts";
import { splitSpeciesAndFile } from "~/lib/audio.ts";
import { isBestRecording } from "~/lib/best-recording.server.ts";
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

				// Signed out, only each species' best recording plays -- the bird
				// page, the life list and Learn. Every other clip may have caught
				// someone talking near the station.
				const signedIn = await canHearEveryClip();
				const best =
					signedIn ||
					isBestRecording(sqlite, extractedDir(), {
						date: params.date,
						speciesDir: species,
						fileName: file,
					});
				if (!best) return new Response("Locked", { status: 401 });

				try {
					// Named by the file as it is on disk now, so a browser asks again
					// every time and only skips the download while it still holds
					// exactly this recording.
					const info = await stat(resolved);
					const etag = `"${info.size.toString(36)}-${Math.floor(info.mtimeMs).toString(36)}"`;
					const headers = {
						"Content-Type": mimeTypeFor(resolved),
						ETag: etag,
						// Never in a shared cache, and never played from the browser's
						// own without asking first: a signed-in visitor's clip must not
						// be served on to someone else, the gate above must run again
						// after signing out, and a best recording that gets replaced or
						// deleted must stop playing for everyone.
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

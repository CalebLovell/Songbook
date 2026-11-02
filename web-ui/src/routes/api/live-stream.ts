import { createFileRoute } from "@tanstack/react-router";

import { readUnlockStatus } from "~/lib/auth.server.ts";
import { resolveLiveStreamUrl } from "~/lib/live-stream.server.ts";

export const Route = createFileRoute("/api/live-stream")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				// The real gate: refuse before opening any upstream connection. A
				// missing/corrupt auth file reads as locked (readUnlockStatus never
				// throws "open"), same promise every gated endpoint makes.
				let unlocked = false;
				try {
					({ unlocked } = await readUnlockStatus());
				} catch {
					unlocked = false;
				}
				if (!unlocked) return new Response("Locked", { status: 401 });

				let upstream: Response;
				try {
					// Tied to the listener's request, so closing the tab (or the
					// player) closes the Icecast connection too, instead of leaving
					// it open behind a stream nobody is reading.
					upstream = await fetch(resolveLiveStreamUrl(), {
						signal: request.signal,
					});
				} catch {
					// Icecast down / host unreachable reads as offline, never a crash.
					return new Response("Live stream unavailable", { status: 503 });
				}
				if (!upstream.ok || !upstream.body) {
					return new Response("Live stream unavailable", { status: 503 });
				}

				// Pipe the MP3 body straight through -- never buffer a live stream.
				return new Response(upstream.body, {
					headers: {
						"Content-Type": "audio/mpeg",
						"Cache-Control": "no-store",
					},
				});
			},
		},
	},
});

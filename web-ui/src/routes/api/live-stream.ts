import { createFileRoute } from "@tanstack/react-router";

import { readUnlockStatus } from "~/lib/auth.server.ts";
import { resolveLiveStreamUrl } from "~/lib/live-stream.server.ts";

export const Route = createFileRoute("/api/live-stream")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				let unlocked = false;
				try {
					({ unlocked } = await readUnlockStatus());
				} catch {
					unlocked = false;
				}
				if (!unlocked) return new Response("Locked", { status: 401 });

				let upstream: Response;
				try {
					upstream = await fetch(resolveLiveStreamUrl(), {
						signal: request.signal,
					});
				} catch {
					return new Response("Live stream unavailable", { status: 503 });
				}
				if (!upstream.ok || !upstream.body) {
					return new Response("Live stream unavailable", { status: 503 });
				}

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

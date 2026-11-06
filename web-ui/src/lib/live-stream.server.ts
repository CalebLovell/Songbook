import "@tanstack/react-start/server-only";

const DEFAULT_LIVE_STREAM_URL = "http://localhost:8000/stream";

export function resolveLiveStreamUrl(
	env: NodeJS.ProcessEnv = process.env,
): string {
	const configured = env.LIVE_STREAM_URL?.trim();
	return configured ? configured : DEFAULT_LIVE_STREAM_URL;
}

import "@tanstack/react-start/server-only";

import path from "node:path";

export function extractedDir(): string {
	return path.resolve(
		process.env.BIRDNET_EXTRACTED_DIR ?? "../../BirdSongs/Extracted",
	);
}

const EXTENSION_MIME: Record<string, string> = {
	".mp3": "audio/mpeg",
	".wav": "audio/wav",
	".flac": "audio/flac",
	".ogg": "audio/ogg",
};

export function resolveExtractedFile(relativePath: string): string | null {
	const root = extractedDir();
	const resolved = path.resolve(root, relativePath);
	if (resolved !== root && !resolved.startsWith(root + path.sep)) {
		return null;
	}
	return resolved;
}

export function mimeTypeFor(filePath: string): string {
	return (
		EXTENSION_MIME[path.extname(filePath).toLowerCase()] ??
		"application/octet-stream"
	);
}

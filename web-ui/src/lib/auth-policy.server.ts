import "@tanstack/react-start/server-only";

function normalize(ip: string) {
	const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
	return mapped ? mapped[1] : ip.toLowerCase();
}

export function isPrivateAddress(ip: string | undefined) {
	if (!ip) return false;
	const address = normalize(ip);

	if (address === "::1") return true;
	if (/^f[cd][0-9a-f]{2}:/.test(address)) return true;

	const octets = address.split(".");
	if (octets.length !== 4) return false;
	if (!octets.every((part) => /^\d{1,3}$/.test(part))) return false;
	const values = octets.map(Number);
	if (values.some((value) => Number.isNaN(value) || value > 255)) return false;
	const [a, b] = values;

	if (a === 127 || a === 10) return true;
	if (a === 172 && b >= 16 && b <= 31) return true;
	if (a === 192 && b === 168) return true;
	return false;
}

type HeaderReader = { get(name: string): string | null | undefined };

function isLoopbackAddress(ip: string | undefined) {
	if (!ip) return false;
	const address = normalize(ip);
	return address === "::1" || /^127\.\d+\.\d+\.\d+$/.test(address);
}

export function clientAddress(
	peer: string | undefined,
	headers: HeaderReader,
	trustedProxy: boolean,
) {
	if (!trustedProxy || !isLoopbackAddress(peer)) return peer;
	return forwardedClientAddress(headers) ?? peer;
}

export function forwardedClientAddress(headers: HeaderReader) {
	const cloudflare = headers.get("cf-connecting-ip")?.trim();
	if (cloudflare) return cloudflare;
	const hops = (headers.get("x-forwarded-for") ?? "")
		.split(",")
		.map((hop) => hop.trim())
		.filter(Boolean);
	return hops.at(-1);
}

export function isStationOrigin(
	origin: string,
	request: Request,
	trustedProxy: boolean,
) {
	const url = new URL(request.url);
	if (origin === url.origin) return true;
	if (!trustedProxy) return false;
	const forwarded = (name: string) =>
		request.headers.get(name)?.split(",")[0]?.trim() || undefined;
	const proto = forwarded("x-forwarded-proto") ?? url.protocol.slice(0, -1);
	const host = forwarded("x-forwarded-host") ?? url.host;
	return origin === `${proto}://${host}`;
}

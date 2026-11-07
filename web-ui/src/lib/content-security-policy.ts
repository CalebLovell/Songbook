const REFERENCE_PHOTO_ORIGIN = "https://inaturalist-open-data.s3.amazonaws.com";

const ALWAYS = [
	"object-src 'none'",
	"base-uri 'self'",
	"form-action 'self'",
	"frame-ancestors 'none'",
];

export function contentSecurityPolicy({
	nonce,
	dev,
}: {
	nonce: string;
	dev: boolean;
}) {
	if (dev) return ALWAYS.join("; ");
	return [
		"default-src 'self'",
		`script-src 'self' 'nonce-${nonce}'`,
		"style-src 'self' 'unsafe-inline'",
		`img-src 'self' data: blob: ${REFERENCE_PHOTO_ORIGIN}`,
		"media-src 'self' blob:",
		"connect-src 'self'",
		...ALWAYS,
	].join("; ");
}

export const PERMISSIONS_POLICY =
	"camera=(), microphone=(), payment=(), usb=(), geolocation=(self)";

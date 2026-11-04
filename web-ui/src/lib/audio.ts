export function commonNameSafe(commonName: string): string {
	return commonName.replaceAll("'", "").replaceAll(" ", "_");
}

const SEGMENT_SEPARATOR = "::";

function base64UrlEncode(value: string): string {
	return btoa(value)
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replaceAll("=", "");
}

function base64UrlDecode(value: string): string {
	const padded = value.replaceAll("-", "+").replaceAll("_", "/");
	const padding =
		padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
	return atob(padded + padding);
}

export function audioUrlFor(
	date: string,
	commonName: string,
	fileName: string,
): string {
	const speciesAndFile = `${commonNameSafe(commonName)}${SEGMENT_SEPARATOR}${fileName}`;
	return `/api/audio/${encodeURIComponent(date)}/${base64UrlEncode(speciesAndFile)}`;
}

export function splitSpeciesAndFile(
	encoded: string,
): [species: string, file: string] {
	const [species, file] = base64UrlDecode(encoded).split(SEGMENT_SEPARATOR);
	return [species ?? "", file ?? ""];
}

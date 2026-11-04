export function comNameToSlug(comName: string): string {
	const slug = comName
		.trim()
		.toLowerCase()
		.replaceAll(/['’.]/g, "")
		.replaceAll(/[^a-z0-9]+/g, "-")
		.replace(/^-+/, "")
		.replace(/-+$/, "");
	if (typeof window !== "undefined") seenNames.set(slug, comName.trim());
	return slug;
}

const seenNames = new Map<string, string>();

export function comNameForSlug(slug: string): string | null {
	return seenNames.get(slug) ?? null;
}

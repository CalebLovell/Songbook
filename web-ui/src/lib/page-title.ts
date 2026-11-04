export const SITE_NAME = "Songbook";

export function pageTitle(page?: string | null): string {
	return page ? `${SITE_NAME} – ${page}` : SITE_NAME;
}

export const MAIN_CONTENT_ID = "app-scroll";

export function focusMainContent() {
	document.getElementById(MAIN_CONTENT_ID)?.focus({ preventScroll: true });
}

const STORAGE_KEY = "timeline-view:v1";

export function loadTimelineView<View extends string>(
	views: readonly View[],
): View | null {
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		return views.find((view) => view === saved) ?? null;
	} catch {
		return null;
	}
}

export function saveTimelineView(view: string) {
	try {
		localStorage.setItem(STORAGE_KEY, view);
	} catch {}
}

import { useEffect, useLayoutEffect, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";
export type ThemePreference = Theme | "system";

const THEME_STORAGE_KEY = "songbook-theme";

const BROWSER_BAR_COLOR: Record<Theme, string> = {
	light: "#fbfdf6",
	dark: "#1a1a19",
};

export const LIGHT_BROWSER_BAR_COLOR = BROWSER_BAR_COLOR.light;

export function themeScript() {
	return `(() => {
	let saved = null;
	try { saved = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)}); } catch {}
	const theme = saved === "light" || saved === "dark"
		? saved
		: matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
	document.documentElement.dataset.theme = theme;
	const bar = ${JSON.stringify(BROWSER_BAR_COLOR)}[theme];
	document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bar);
})()`;
}

function readTheme(): Theme {
	return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function subscribe(onChange: () => void) {
	const observer = new MutationObserver(onChange);
	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["data-theme"],
	});
	return () => observer.disconnect();
}

function applyTheme(theme: Theme) {
	document.documentElement.dataset.theme = theme;
	document
		.querySelector('meta[name="theme-color"]')
		?.setAttribute("content", BROWSER_BAR_COLOR[theme]);
}

const SYSTEM_DARK = "(prefers-color-scheme: dark)";
const preferenceListeners = new Set<() => void>();

function readPreference(): ThemePreference {
	let saved: string | null = null;
	try {
		saved = localStorage.getItem(THEME_STORAGE_KEY);
	} catch {}
	return saved === "light" || saved === "dark" ? saved : "system";
}

function resolveTheme(preference: ThemePreference): Theme {
	if (preference !== "system") return preference;
	return matchMedia(SYSTEM_DARK).matches ? "dark" : "light";
}

export function setThemePreference(preference: ThemePreference) {
	try {
		if (preference === "system") localStorage.removeItem(THEME_STORAGE_KEY);
		else localStorage.setItem(THEME_STORAGE_KEY, preference);
	} catch {}
	applyTheme(resolveTheme(preference));
	for (const listener of preferenceListeners) listener();
}

function subscribePreference(onChange: () => void) {
	preferenceListeners.add(onChange);
	window.addEventListener("storage", onChange);
	return () => {
		preferenceListeners.delete(onChange);
		window.removeEventListener("storage", onChange);
	};
}

export function useThemePreference(): ThemePreference {
	return useSyncExternalStore(
		subscribePreference,
		readPreference,
		() => "system",
	);
}

export function useKeepTheme() {
	useLayoutEffect(() => {
		if (!document.documentElement.dataset.theme)
			applyTheme(resolveTheme(readPreference()));
	});
	useEffect(() => {
		const system = matchMedia(SYSTEM_DARK);
		const follow = () => applyTheme(resolveTheme(readPreference()));
		system.addEventListener("change", follow);
		window.addEventListener("storage", follow);
		return () => {
			system.removeEventListener("change", follow);
			window.removeEventListener("storage", follow);
		};
	}, []);
}

export function useTheme(): Theme {
	return useSyncExternalStore(subscribe, readTheme, () => "light");
}

import { type ParsedLocation, redirect } from "@tanstack/react-router";

export function requireUnlocked(
	auth: { unlocked: boolean },
	location: ParsedLocation,
): void {
	if (auth.unlocked) return;
	throw redirect({ to: "/account", search: { next: location.href } });
}

export function safeNext(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	if (!value.startsWith("/") || value.startsWith("//")) return undefined;
	if (value.startsWith("/\\")) return undefined;
	return value;
}

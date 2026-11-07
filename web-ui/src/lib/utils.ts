import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
	extend: {
		theme: {
			spacing: [
				"page",
				"cell",
				"card-edge",
				"masthead",
				"row-checkbox",
				"page-end",
			],
		},
	},
});

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function errorMessage(error: unknown, fallback: string): string {
	return error instanceof Error ? error.message : fallback;
}

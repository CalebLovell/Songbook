import { z } from "zod";

import { DAY_PATTERN } from "~/lib/day.ts";

export const pageParam = z.number().int().min(1).default(1).catch(1);

export const textParam = z.coerce
	.string()
	.trim()
	.transform((text) => text || undefined)
	.optional()
	.catch(undefined);

export const dayParam = z
	.string()
	.regex(DAY_PATTERN)
	.optional()
	.catch(undefined);

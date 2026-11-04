import { createServerFn } from "@tanstack/react-start";
import { count, desc } from "drizzle-orm";

import { db } from "~/db/index.ts";
import { detections } from "~/db/schema.ts";
import type { SearchSpecies } from "~/lib/site-search.ts";

export const getSearchSpecies = createServerFn({ method: "GET" }).handler(
	async (): Promise<SearchSpecies[]> =>
		db
			.select({
				comName: detections.Com_Name,
				sciName: detections.Sci_Name,
				count: count(),
			})
			.from(detections)
			.groupBy(detections.Com_Name, detections.Sci_Name)
			.orderBy(desc(count())),
);

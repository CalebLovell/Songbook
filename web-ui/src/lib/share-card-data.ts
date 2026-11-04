import { createServerFn } from "@tanstack/react-start";
import { count, countDistinct, desc, sql } from "drizzle-orm";

import { db } from "~/db/index.ts";
import { detections } from "~/db/schema.ts";
import { isLast24h } from "~/lib/now.ts";
import type { ShareCard } from "~/lib/share-card.ts";

// Inline in .handler(): a named function stays a live reference the client build
// can't erase, which pulls this module's database import into the browser.
export const getShareCard = createServerFn({ method: "GET" }).handler(
	async (): Promise<ShareCard> => {
		const generatedAt = new Date();

		const [[totals], [{ speciesCount }], topRows, [busiest]] =
			await Promise.all([
				db
					.select({ detectionCount: count() })
					.from(detections)
					.where(isLast24h),
				db
					.select({ speciesCount: countDistinct(detections.Com_Name) })
					.from(detections)
					.where(isLast24h),
				db
					.select({ comName: detections.Com_Name, count: count() })
					.from(detections)
					.where(isLast24h)
					.groupBy(detections.Com_Name)
					.orderBy(desc(count()))
					.limit(3),
				db
					.select({
						hour: sql<string>`strftime('%H', ${detections.Time})`,
						count: count(),
					})
					.from(detections)
					.where(isLast24h)
					.groupBy(sql`strftime('%H', ${detections.Time})`)
					.orderBy(desc(count()))
					.limit(1),
			]);

		return {
			date: `${generatedAt.getFullYear()}-${String(
				generatedAt.getMonth() + 1,
			).padStart(2, "0")}-${String(generatedAt.getDate()).padStart(2, "0")}`,
			window: "rolling",
			species: speciesCount,
			detections: totals.detectionCount,
			topSpecies: topRows,
			busiestHour: busiest
				? { hour: Number(busiest.hour), count: busiest.count }
				: null,
		};
	},
);

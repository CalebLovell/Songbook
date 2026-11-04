import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/stats")({
	validateSearch: z.object({
		year: z.coerce.number().int().optional().catch(undefined),
	}),
	beforeLoad: ({ search }) => {
		throw redirect({
			to: "/timeline",
			search:
				search.year === undefined
					? { period: "all" as const }
					: { period: "year" as const, date: String(search.year) },
			replace: true,
		});
	},
});

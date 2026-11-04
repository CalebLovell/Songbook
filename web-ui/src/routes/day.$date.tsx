import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/day/$date")({
	beforeLoad: ({ params }) => {
		throw redirect({
			to: "/timeline",
			search: { period: "day" as const, date: params.date },
			replace: true,
		});
	},
});

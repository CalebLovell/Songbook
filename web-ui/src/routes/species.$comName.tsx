import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/species/$comName")({
	beforeLoad: ({ params }) => {
		throw redirect({
			to: "/birds/$comName",
			params: { comName: params.comName },
			replace: true,
		});
	},
});

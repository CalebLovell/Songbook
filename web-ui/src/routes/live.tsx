import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/live")({
	beforeLoad: () => {
		throw redirect({ to: "/today", statusCode: 301 });
	},
});

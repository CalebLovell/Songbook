import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/species/")({
	beforeLoad: ({ search }) => {
		throw redirect({ to: "/birds", search, replace: true });
	},
});

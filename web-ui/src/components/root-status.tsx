import { useQueryClient } from "@tanstack/react-query";
import {
	type ErrorComponentProps,
	useNavigate,
	useRouter,
	useRouterState,
} from "@tanstack/react-router";
import { Activity, CircleAlert, Compass, Copy, RotateCcw } from "lucide-react";
import { type MouseEvent, useEffect } from "react";

import { StatusPage } from "~/components/status-page.tsx";
import { Button } from "~/components/ui/button.tsx";
import { ButtonLink } from "~/components/ui/button-link.tsx";
import { toast } from "~/components/ui/toaster.tsx";
import { announce } from "~/lib/announce.ts";
import { isUnauthorizedError } from "~/lib/auth.ts";
import { copyText } from "~/lib/copy-text.ts";
import { pageTitle } from "~/lib/page-title.ts";
import { refreshAllData } from "~/lib/query-client.ts";
import { closestSitePage, sitePageFor } from "~/lib/site-pages.ts";
import { forgetUnlockStatus } from "~/lib/unlock-status.ts";

function useStatusTitle(title: string) {
	useEffect(() => {
		const previous = document.title;
		document.title = pageTitle(title);
		announce(title);
		return () => {
			document.title = previous;
		};
	}, [title]);
}

export function RouteNotFound() {
	useStatusTitle("Page not found");
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const suggestion = closestSitePage(pathname);

	return (
		<StatusPage
			icon={Compass}
			section="Page not found"
			sectionDescription="This address doesn't match a page."
			tone="missing"
			title="Not found"
			actions={
				<>
					{suggestion ? (
						<ButtonLink to={suggestion.to} size="sm" icon={suggestion.icon}>
							Go to {suggestion.label}
						</ButtonLink>
					) : null}
					<ButtonLink
						to="/live"
						variant={suggestion ? "outline" : "default"}
						size="sm"
						icon={Activity}
					>
						Go to Live
					</ButtonLink>
				</>
			}
		>
			Nothing is at <code>{pathname}</code>.
		</StatusPage>
	);
}

const UNKNOWN_SECTION = {
	icon: CircleAlert,
	header: {
		title: "Page error",
		description: "This page isn't available right now.",
	},
};

function errorDetails(error: unknown, pathname: string): string | null {
	const message = error instanceof Error ? error.message : String(error ?? "");
	return message
		? `${message}
${pathname}`
		: null;
}

function ErrorDetails({ text }: { text: string }) {
	async function copy(event: MouseEvent<HTMLButtonElement>) {
		const copied = await copyText(text, event.currentTarget);
		if (copied) toast.success("Copied to clipboard");
		else toast.error("Copying was blocked by the browser.");
	}

	return (
		<details className="text-sm">
			<summary className="cursor-pointer text-muted-foreground">
				Details
			</summary>
			<pre className="mt-2 whitespace-pre-wrap break-words rounded-md bg-meadow p-3 text-xs">
				{text}
			</pre>
			<Button
				variant="outline"
				size="sm"
				icon={Copy}
				className="mt-page"
				onClick={copy}
			>
				Copy details
			</Button>
		</details>
	);
}

export function RouteError({ error }: ErrorComponentProps) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const signedOut = isUnauthorizedError(error);
	useStatusTitle(signedOut ? "Sign in" : "Error");

	useEffect(() => {
		if (!signedOut) return;
		const { href: next, pathname } = router.state.location;
		if (pathname === "/sign-in") return;
		forgetUnlockStatus();
		void navigate({ to: "/sign-in", search: { next }, replace: true });
	}, [signedOut, navigate, router]);

	if (signedOut) return null;

	const { icon, header } = sitePageFor(pathname) ?? UNKNOWN_SECTION;
	const details = errorDetails(error, pathname);

	return (
		<StatusPage
			icon={icon}
			section={header.title}
			sectionDescription={header.description}
			tone="unavailable"
			title="Error"
			actions={
				<>
					<Button
						size="sm"
						icon={RotateCcw}
						onClick={() => refreshAllData(router, queryClient)}
					>
						Try again
					</Button>
					<ButtonLink to="/live" variant="outline" size="sm" icon={Activity}>
						Go to Live
					</ButtonLink>
				</>
			}
			footer={details ? <ErrorDetails text={details} /> : null}
		>
			Something went wrong loading this page.
		</StatusPage>
	);
}

import { useQueryClient } from "@tanstack/react-query";
import {
	type ErrorComponentProps,
	useNavigate,
	useRouter,
	useRouterState,
} from "@tanstack/react-router";
import { Activity, RotateCcw } from "lucide-react";
import { useEffect } from "react";

import { PageStatus } from "~/components/page-status.tsx";
import { Button } from "~/components/ui/button.tsx";
import { ButtonLink } from "~/components/ui/button-link.tsx";
import { PageWrap } from "~/components/ui/page-wrap.tsx";
import { announce } from "~/lib/announce.ts";
import { isUnauthorizedError } from "~/lib/auth.ts";
import { pageTitle } from "~/lib/page-title.ts";
import { refreshAllData } from "~/lib/query-client.ts";
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

	return (
		<PageWrap>
			<PageStatus
				tone="missing"
				title="Page not found"
				actions={
					<ButtonLink to="/live" variant="outline" size="sm" icon={Activity}>
						Go to Live
					</ButtonLink>
				}
			>
				There is nothing at <code>{pathname}</code>. The address may be
				mistyped, or the page may have moved.
			</PageStatus>
		</PageWrap>
	);
}

export function RouteError({ error }: ErrorComponentProps) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const signedOut = isUnauthorizedError(error);
	useStatusTitle(signedOut ? "Sign in" : "This page couldn't load");

	useEffect(() => {
		if (!signedOut) return;
		const { href: next, pathname } = router.state.location;
		if (pathname === "/sign-in") return;
		forgetUnlockStatus();
		void navigate({ to: "/sign-in", search: { next }, replace: true });
	}, [signedOut, navigate, router]);

	if (signedOut) return null;

	return (
		<PageWrap>
			<PageStatus
				tone="unavailable"
				title="This page couldn't load"
				actions={
					<>
						<Button
							variant="outline"
							size="sm"
							icon={RotateCcw}
							onClick={() => refreshAllData(router, queryClient)}
						>
							Try again
						</Button>
						<ButtonLink to="/live" variant="ghost" size="sm" icon={Activity}>
							Go to Live
						</ButtonLink>
					</>
				}
			>
				Something went wrong on the station. Try again in a minute. If it keeps
				happening, restarting the station usually fixes it.
			</PageStatus>
		</PageWrap>
	);
}

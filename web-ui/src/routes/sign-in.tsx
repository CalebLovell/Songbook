import {
	createFileRoute,
	redirect,
	useNavigate,
	useRouteContext,
} from "@tanstack/react-router";
import { KeyRound } from "lucide-react";
import { z } from "zod";

import { StationNotReadyCard } from "~/components/auth/station-not-ready-card.tsx";
import { UnlockGate } from "~/components/auth/unlock-gate.tsx";
import { PageHeaderCard } from "~/components/page-header-card.tsx";
import { PageWrap } from "~/components/ui/page-wrap.tsx";
import { pageHead } from "~/lib/link-preview.ts";
import { PAGE_HEADERS } from "~/lib/page-headers.ts";
import { safeNext } from "~/lib/require-unlocked.ts";

const AFTER_SIGN_IN = "/live";

export const Route = createFileRoute("/sign-in")({
	head: () => pageHead("Sign in"),
	validateSearch: z.object({
		next: z.unknown().transform(safeNext).optional(),
	}),
	beforeLoad: ({ context, search }) => {
		if (context.auth.unlocked) {
			throw redirect({ href: search.next ?? AFTER_SIGN_IN, replace: true });
		}
	},
	component: SignIn,
});

function SignIn() {
	const { auth } = useRouteContext({ from: "__root__" });
	const { next } = Route.useSearch();
	const navigate = useNavigate();

	return (
		<PageWrap className="space-y-page">
			<PageHeaderCard
				icon={KeyRound}
				title={PAGE_HEADERS.signIn.title}
				description={PAGE_HEADERS.signIn.description}
			/>
			{auth.state !== "ready" ? (
				<StationNotReadyCard state={auth.state} />
			) : (
				<UnlockGate
					onUnlock={() =>
						navigate({ href: next ?? AFTER_SIGN_IN, replace: true })
					}
				/>
			)}
		</PageWrap>
	);
}

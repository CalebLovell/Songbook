import {
	createFileRoute,
	useNavigate,
	useRouteContext,
} from "@tanstack/react-router";
import { UserRound } from "lucide-react";
import { z } from "zod";

import { SessionCard } from "~/components/auth/session-card.tsx";
import { StationNotReadyCard } from "~/components/auth/station-not-ready-card.tsx";
import { UnlockGate } from "~/components/auth/unlock-gate.tsx";
import { PageHeaderCard } from "~/components/page-header-card.tsx";
import { PageWrap } from "~/components/ui/page-wrap.tsx";
import { pageHead } from "~/lib/link-preview.ts";
import { PAGE_HEADERS } from "~/lib/page-headers.ts";
import { safeNext } from "~/lib/require-unlocked.ts";

export const Route = createFileRoute("/account")({
	head: () => pageHead("Account"),
	validateSearch: z.object({
		next: z.unknown().transform(safeNext).optional(),
	}),
	component: Account,
});

function Account() {
	const { auth } = useRouteContext({ from: "__root__" });
	const { next } = Route.useSearch();
	const navigate = useNavigate();

	return (
		<PageWrap className="space-y-page">
			<PageHeaderCard
				icon={UserRound}
				title={PAGE_HEADERS.account.title}
				description={PAGE_HEADERS.account.description}
			/>
			{auth.unlocked ? (
				<SessionCard />
			) : auth.state !== "ready" ? (
				<StationNotReadyCard state={auth.state} />
			) : (
				<UnlockGate
					onUnlock={() => {
						if (next) navigate({ href: next, replace: true });
					}}
				/>
			)}
		</PageWrap>
	);
}

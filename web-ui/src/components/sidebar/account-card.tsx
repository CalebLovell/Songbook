import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	Link,
	useRouteContext,
	useRouter,
	useRouterState,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
	AlertTriangle,
	ChevronRight,
	LogIn,
	LogOut,
	type LucideIcon,
	ShieldCheck,
	UserRound,
} from "lucide-react";
import type { ReactNode } from "react";

import { toast } from "~/components/ui/toaster.tsx";
import { lockFn } from "~/lib/auth.ts";
import { forgetUnlockStatus } from "~/lib/unlock-status.ts";
import { forgetFetchedClips } from "~/lib/use-playable-audio.ts";

const ACTION_CLASS =
	"flex size-8.5 pointer-coarse:size-9 items-center justify-center rounded-md text-[color-mix(in_oklab,var(--ink)_70%,var(--moss)_30%)] hover:bg-meadow hover:text-ink disabled:opacity-50";

export function AccountCard({ onNavigate }: { onNavigate?: () => void }) {
	const { auth } = useRouteContext({ from: "__root__" });
	const here = useRouterState({ select: (state) => state.location.href });

	if (auth.unlocked) return <SignedInCard />;

	if (auth.state !== "ready") {
		return (
			<CardShell
				icon={AlertTriangle}
				tone="warning"
				title="Guest"
				detail={
					auth.state === "not-set-up"
						? "No password yet"
						: "Password unreadable"
				}
			>
				<Link
					to="/sign-in"
					className={ACTION_CLASS}
					aria-label="How to turn sign-in on"
					title="How to turn sign-in on"
					onClick={onNavigate}
				>
					<ChevronRight aria-hidden="true" className="size-4.5" />
				</Link>
			</CardShell>
		);
	}

	return (
		<CardShell icon={UserRound} tone="moss" title="Guest" detail="View only">
			<Link
				to="/sign-in"
				search={here.startsWith("/sign-in") ? {} : { next: here }}
				className={ACTION_CLASS}
				aria-label="Sign in"
				title="Sign in"
				onClick={onNavigate}
			>
				<LogIn aria-hidden="true" className="size-4.5" />
			</Link>
		</CardShell>
	);
}

function SignedInCard() {
	const lock = useServerFn(lockFn);
	const router = useRouter();
	const queryClient = useQueryClient();
	const signOut = useMutation({
		mutationFn: () => lock({ data: undefined }),
		onSuccess: async () => {
			forgetUnlockStatus();
			forgetFetchedClips();
			queryClient.removeQueries();
			await router.invalidate();
		},
		onError: (cause) => {
			console.error(cause);
			toast.error("Couldn't sign out. Try again.");
		},
	});
	const label = signOut.isPending ? "Signing out…" : "Sign out";

	return (
		<CardShell
			icon={ShieldCheck}
			tone="moss"
			title="Owner"
			detail="Full access"
		>
			<button
				type="button"
				className={ACTION_CLASS}
				aria-label={label}
				title={label}
				disabled={signOut.isPending}
				onClick={() => signOut.mutate()}
			>
				<LogOut aria-hidden="true" className="size-4.5" />
			</button>
		</CardShell>
	);
}

const TONES = {
	moss: { well: "bg-icon-well text-moss", title: "text-ink" },
	warning: {
		well: "bg-[color-mix(in_oklab,var(--bark)_10%,var(--paper-raised))] text-bark",
		title: "text-bark",
	},
} as const;

function CardShell({
	icon: Icon,
	tone,
	title,
	detail,
	children,
}: {
	icon: LucideIcon;
	tone: keyof typeof TONES;
	title: string;
	detail: string;
	children: ReactNode;
}) {
	const colors = TONES[tone];
	return (
		<section
			aria-label="Account"
			className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 rounded-md border bg-card py-2.5 pr-2 pl-2.5"
		>
			<div
				className={`flex size-9 items-center justify-center rounded-full ${colors.well}`}
			>
				<Icon aria-hidden="true" className="size-4.5" />
			</div>
			<div className="flex min-w-0 flex-col gap-0.5">
				<p
					className={`m-0 truncate font-semibold text-[0.875rem] leading-tight ${colors.title}`}
				>
					{title}
				</p>
				<p className="m-0 truncate text-muted-foreground text-xs leading-snug">
					{detail}
				</p>
			</div>
			{children}
		</section>
	);
}

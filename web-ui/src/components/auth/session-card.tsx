import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { LogOut, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { CardHeader } from "~/components/card-header.tsx";
import { Button } from "~/components/ui/button.tsx";
import { toast } from "~/components/ui/toaster.tsx";
import { lockFn } from "~/lib/auth.ts";
import { SESSION_IDLE_DAYS } from "~/lib/auth-limits.ts";
import { forgetUnlockStatus } from "~/lib/unlock-status.ts";
import { forgetFetchedClips } from "~/lib/use-playable-audio.ts";

export const SIGN_IN_CARD_TITLE = "Sign-in";

export function SessionCard() {
	const lock = useServerFn(lockFn);
	const router = useRouter();
	const [pending, setPending] = useState(false);

	async function onSignOut() {
		setPending(true);
		try {
			await lock({ data: undefined });
			forgetUnlockStatus();
			forgetFetchedClips();
			await router.invalidate();
		} catch (cause) {
			console.error(cause);
			toast.error("This browser could not be signed out.");
		} finally {
			setPending(false);
		}
	}

	return (
		<section
			aria-labelledby="account-sign-in"
			className="feature-card flex flex-col gap-page rounded-md p-page"
		>
			<CardHeader
				as="h2"
				titleId="account-sign-in"
				title={SIGN_IN_CARD_TITLE}
			/>
			<div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
				<div className="flex min-w-0 items-center gap-3">
					<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-icon-well text-moss">
						<ShieldCheck aria-hidden="true" className="size-5" />
					</div>
					<div className="min-w-0">
						<p className="font-semibold">Signed in</p>
						<p className="text-muted-foreground text-sm">
							Signs out on its own after {SESSION_IDLE_DAYS} days without a
							visit.
						</p>
					</div>
				</div>
				<Button
					type="button"
					size="default"
					variant="outline"
					icon={LogOut}
					disabled={pending}
					onClick={onSignOut}
				>
					{pending ? "Signing out…" : "Sign out"}
				</Button>
			</div>
		</section>
	);
}

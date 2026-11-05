import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, FlaskConical, KeyRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SIGN_IN_CARD_TITLE } from "~/components/auth/session-card.tsx";
import { CardHeader } from "~/components/card-header.tsx";
import { Button } from "~/components/ui/button.tsx";
import { Input } from "~/components/ui/input.tsx";
import { unlockFn } from "~/lib/auth.ts";
import { DEV_PASSWORD } from "~/lib/dev-password.ts";
import { SITE_NAME } from "~/lib/page-title.ts";
import { messageForThrown, UNLOCK_MESSAGES } from "~/lib/unlock-messages.ts";
import { forgetUnlockStatus } from "~/lib/unlock-status.ts";

export function UnlockGate({ onUnlock }: { onUnlock?: () => void }) {
	const unlock = useServerFn(unlockFn);
	const router = useRouter();
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | undefined>();
	const [pending, setPending] = useState(false);
	const field = useRef<HTMLInputElement>(null);

	// An effect, not `autoFocus`: React doesn't apply that attribute when hydrating.
	useEffect(() => {
		field.current?.focus();
	}, []);

	async function onSubmit(event: React.FormEvent) {
		event.preventDefault();
		await signIn(password);
	}

	async function signIn(attempt: string) {
		setPending(true);
		setError(undefined);
		try {
			const result = await unlock({ data: { password: attempt } });
			if (result.ok) {
				setPassword("");
				forgetUnlockStatus();
				await router.invalidate();
				onUnlock?.();
				return;
			}
			setError(UNLOCK_MESSAGES[result.reason]);
			if (result.reason === "not-set-up" || result.reason === "misconfigured") {
				forgetUnlockStatus();
				await router.invalidate();
			}
		} catch (cause) {
			console.error(cause);
			setError(messageForThrown(cause));
		} finally {
			setPending(false);
		}
	}

	return (
		<form
			aria-labelledby="unlock-title"
			className="feature-card flex flex-col gap-4 rounded-md p-page"
			onSubmit={onSubmit}
		>
			<CardHeader as="h2" titleId="unlock-title" title={SIGN_IN_CARD_TITLE} />
			<div className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-1.5 sm:col-start-1">
					<label
						htmlFor="station-username"
						className="block font-medium text-sm"
					>
						Username
					</label>
					<Input
						id="station-username"
						name="username"
						type="text"
						autoComplete="username"
						value={SITE_NAME}
						readOnly
						className="bg-meadow text-muted-foreground hover:bg-meadow hover:text-muted-foreground"
					/>
				</div>
				<div className="space-y-1.5 sm:col-start-1">
					<label
						htmlFor="station-password"
						className="block font-medium text-sm"
					>
						Station password
					</label>
					<Input
						ref={field}
						id="station-password"
						aria-describedby="station-password-hint"
						name="password"
						type="password"
						autoComplete="current-password"
						value={password}
						onChange={(event) => setPassword(event.target.value)}
					/>
					<p
						id="station-password-hint"
						className="text-muted-foreground text-xs leading-relaxed"
					>
						Set on the Pi with{" "}
						<code className="font-sans tabular-nums">
							scripts/set_web_ui_password.sh
						</code>
						.
					</p>
				</div>
			</div>

			<div className="flex flex-wrap items-center gap-3">
				<Button
					type="submit"
					size="default"
					icon={KeyRound}
					disabled={pending || password.length === 0}
				>
					{pending ? "Signing in…" : "Sign in"}
				</Button>
				{import.meta.env.DEV ? (
					<Button
						type="button"
						size="default"
						variant="outline"
						icon={FlaskConical}
						disabled={pending}
						onClick={() => void signIn(DEV_PASSWORD)}
					>
						Dev sign-in
					</Button>
				) : null}
				<p
					aria-live="polite"
					role="alert"
					className="flex min-w-0 items-start gap-2 text-destructive text-xs"
				>
					{error ? (
						<>
							<AlertTriangle
								aria-hidden="true"
								className="mt-px size-3.5 shrink-0"
							/>
							<span>{error}</span>
						</>
					) : null}
				</p>
			</div>
		</form>
	);
}

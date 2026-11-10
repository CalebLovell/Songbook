import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, FlaskConical, KeyRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CardHeader } from "~/components/card-header.tsx";
import { Button } from "~/components/ui/button.tsx";
import { Card } from "~/components/ui/card.tsx";
import { Input } from "~/components/ui/input.tsx";
import { unlockFn } from "~/lib/auth.ts";
import { DEV_PASSWORD } from "~/lib/dev-password.ts";
import { SITE_NAME } from "~/lib/page-title.ts";
import { messageForThrown, UNLOCK_MESSAGES } from "~/lib/unlock-messages.ts";
import { forgetUnlockStatus } from "~/lib/unlock-status.ts";

export const SIGN_IN_CARD_TITLE = "Sign-in";

export function UnlockGate({ onUnlock }: { onUnlock?: () => void }) {
	const unlock = useServerFn(unlockFn);
	const router = useRouter();
	const queryClient = useQueryClient();
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | undefined>();
	const signIn = useMutation({
		mutationFn: (attempt: string) => unlock({ data: { password: attempt } }),
		onMutate: () => setError(undefined),
		onSuccess: async (result) => {
			if (result.ok) {
				setPassword("");
				forgetUnlockStatus();
				queryClient.removeQueries();
				await router.invalidate();
				onUnlock?.();
				return;
			}
			setError(UNLOCK_MESSAGES[result.reason]);
			if (result.reason === "not-set-up" || result.reason === "misconfigured") {
				forgetUnlockStatus();
				await router.invalidate();
			}
		},
		onError: (cause) => {
			console.error(cause);
			setError(messageForThrown(cause));
		},
	});
	const pending = signIn.isPending;
	const field = useRef<HTMLInputElement>(null);

	// An effect, not `autoFocus`: React doesn't apply that attribute when hydrating.
	useEffect(() => {
		field.current?.focus();
	}, []);

	function onSubmit(event: React.FormEvent) {
		event.preventDefault();
		signIn.mutate(password);
	}

	return (
		<Card
			as="form"
			aria-labelledby="unlock-title"
			className="flex flex-col gap-4"
			onSubmit={onSubmit}
		>
			<CardHeader as="h2" titleId="unlock-title" title={SIGN_IN_CARD_TITLE} />
			<input
				type="text"
				name="username"
				autoComplete="username"
				value={SITE_NAME}
				readOnly
				tabIndex={-1}
				aria-hidden="true"
				className="sr-only"
			/>
			<div className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-1.5 sm:col-start-1">
					<label
						htmlFor="station-password"
						className="block font-medium text-sm"
					>
						Password
					</label>
					<Input
						ref={field}
						id="station-password"
						aria-invalid={error ? true : undefined}
						aria-describedby="station-password-error"
						name="password"
						type="password"
						autoComplete="current-password"
						value={password}
						onChange={(event) => setPassword(event.target.value)}
					/>
					<p
						id="station-password-error"
						aria-live="polite"
						role="alert"
						className="m-0 flex min-w-0 items-start gap-1.5 text-destructive text-xs"
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
						onClick={() => signIn.mutate(DEV_PASSWORD)}
					>
						Dev sign-in
					</Button>
				) : null}
			</div>
		</Card>
	);
}

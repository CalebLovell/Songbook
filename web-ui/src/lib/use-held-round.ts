import { useState } from "react";

import type { LearnPool } from "~/lib/learn-pools.ts";
import type { LearnRound } from "~/lib/learn-round.ts";

type HeldRound = { round: LearnRound; pool: LearnPool };

export function shouldAdoptRound(
	held: HeldRound,
	incoming: HeldRound,
	wantsNextRound: boolean,
): boolean {
	if (incoming.round.id === held.round.id) return false;
	return incoming.pool !== held.pool || wantsNextRound;
}

export function useHeldRound(
	round: LearnRound,
	pool: LearnPool,
	savedRound?: LearnRound,
) {
	const [held, setHeld] = useState<HeldRound>({
		round: savedRound ?? round,
		pool,
	});
	const [wantsNextRound, setWantsNextRound] = useState(false);
	const requestNextRound = () => setWantsNextRound(true);

	if (shouldAdoptRound(held, { round, pool }, wantsNextRound)) {
		setHeld({ round, pool });
		setWantsNextRound(false);
		return { round, requestNextRound };
	}

	return { round: held.round, requestNextRound };
}

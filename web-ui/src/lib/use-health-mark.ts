import { useQuery } from "@tanstack/react-query";

import { stationHealthQuery } from "./health.ts";
import {
	type HealthAttention,
	healthAttention,
	healthCards,
} from "./health-cards.ts";
import { updateStateQuery } from "./updates.ts";

const INTERVAL_MS = 60_000;

export function useHealthMark(enabled: boolean): HealthAttention | null {
	const { data: health } = useQuery({
		...stationHealthQuery,
		enabled,
		refetchInterval: INTERVAL_MS,
	});
	const { data: updates } = useQuery({
		...updateStateQuery,
		enabled,
		refetchInterval: INTERVAL_MS,
	});
	if (!enabled || !health) return null;
	return healthAttention(healthCards(health, updates ?? null));
}

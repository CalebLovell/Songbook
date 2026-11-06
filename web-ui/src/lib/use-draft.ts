import { useState } from "react";

export function useDraft<T>(source: T) {
	const [draft, setDraft] = useState(source);
	const [seenSource, setSeenSource] = useState(source);
	if (source !== seenSource) {
		setSeenSource(source);
		setDraft(source);
	}
	return [draft, setDraft] as const;
}

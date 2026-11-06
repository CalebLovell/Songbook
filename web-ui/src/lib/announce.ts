type AnnounceListener = (message: string) => void;

const listeners = new Set<AnnounceListener>();

export function announce(message: string) {
	for (const listener of listeners) listener(message);
}

export function onAnnounce(listener: AnnounceListener) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

type ClipLoaderOptions = {
	fetchClip: (audioUrl: string) => Promise<Blob>;
	toObjectUrl: (blob: Blob) => string;
	revokeObjectUrl: (objectUrl: string) => void;
	onLoadingChange: (isLoading: boolean) => void;
};

export function createClipLoader({
	fetchClip,
	toObjectUrl,
	revokeObjectUrl,
	onLoadingChange,
}: ClipLoaderOptions) {
	let latest: { audioUrl: string; loaded: Promise<boolean> } | null = null;
	let objectUrl: string | null = null;

	function load(audio: { src: string }, audioUrl: string): Promise<boolean> {
		if (latest?.audioUrl === audioUrl) return latest.loaded;

		onLoadingChange(true);
		const request: NonNullable<typeof latest> = {
			audioUrl,
			loaded: fetchClip(audioUrl)
				.then((blob) => {
					if (latest !== request) return false;
					if (objectUrl) revokeObjectUrl(objectUrl);
					objectUrl = toObjectUrl(blob);
					audio.src = objectUrl;
					return true;
				})
				.catch(() => {
					if (latest === request) latest = null;
					return false;
				})
				.finally(() => {
					if (latest === request || latest === null) onLoadingChange(false);
				}),
		};
		latest = request;
		return request.loaded;
	}

	function dispose() {
		if (objectUrl) revokeObjectUrl(objectUrl);
		objectUrl = null;
		latest = null;
	}

	return { load, dispose };
}

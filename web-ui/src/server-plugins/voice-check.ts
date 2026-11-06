import { definePlugin } from "nitro";

import { keepCheckingNewBestClips } from "~/lib/voice-check.server.ts";

export default definePlugin(() => {
	keepCheckingNewBestClips();
});

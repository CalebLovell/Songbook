import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { BestRecordingCard } from "~/components/best-recording-card.tsx";
import { EMPTY } from "~/lib/empty-messages.ts";

test("with no recording the card shows the message and no player", () => {
	const html = renderToStaticMarkup(<BestRecordingCard recording={null} />);
	assert.ok(html.includes(EMPTY.window.birdRecording));
	assert.ok(html.includes("Best recording"));
	assert.doesNotMatch(html, /role="slider"/);
	assert.doesNotMatch(html, /<audio/);
	assert.doesNotMatch(html, /<button/);
});

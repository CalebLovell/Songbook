import assert from "node:assert/strict";
import { test } from "node:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";

import type { StationToDo } from "~/lib/health-data.ts";

import { StationToDos } from "./station-to-dos.tsx";

function render(toDos: StationToDo[]) {
	return renderToStaticMarkup(
		<QueryClientProvider client={new QueryClient()}>
			<StationToDos
				toDos={toDos}
				onShowSetting={() => {}}
				onRestart={async () => {}}
			/>
		</QueryClientProvider>,
	);
}

test("nothing renders when all is well", () => {
	assert.equal(render([]), "");
});

test("each to-do renders its words and its one action", () => {
	const markup = render([
		{ kind: "location" },
		{ kind: "audio" },
		{ kind: "analyzer" },
		{ kind: "disk", usedPercent: 98, threshold: 95, action: "purge" },
		{ kind: "name" },
	]);
	assert.match(markup, /To do/);
	assert.match(markup, /Give the station a name/);
	assert.match(markup, /Set name/);
	assert.match(markup, /location isn(&#x27;|')t set/);
	assert.match(markup, /Set location/);
	assert.match(markup, /No audio is arriving/);
	assert.match(markup, /Check audio input/);
	assert.match(markup, /Bird analysis has stopped/);
	assert.match(markup, /Restart BirdNET/);
	assert.match(markup, /The disk is nearly full/);
	assert.match(markup, /Storage settings/);
	assert.equal(markup.match(/<button/g)?.length, 5);
});

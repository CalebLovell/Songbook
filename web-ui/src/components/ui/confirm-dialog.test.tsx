import assert from "node:assert/strict";
import { test } from "node:test";

import { Check } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";

import { ConfirmDialog } from "~/components/ui/confirm-dialog.tsx";

test("neither button can submit a form the dialog sits inside", () => {
	const html = renderToStaticMarkup(
		<form>
			<ConfirmDialog
				title="Save?"
				description="Recording stops for a moment."
				confirmLabel="Save"
				confirmIcon={Check}
				onCancel={() => {}}
				onConfirm={() => {}}
			/>
		</form>,
	);
	const buttons = html.match(/<button\b[^>]*>/g) ?? [];
	assert.equal(buttons.length, 2);
	for (const button of buttons) assert.match(button, /\btype="button"/);
});

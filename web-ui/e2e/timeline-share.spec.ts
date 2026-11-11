import { expect, type Page, test } from "@playwright/test";

/**
 * The Timeline's Share button opens a preview of the summary for the window on
 * screen, whatever the period and window were changed to just before, and copies
 * it only when asked. The summary is prepared as soon as the window changes: it
 * once got built before that window's figures had arrived, and said "All time ·
 * Nothing heard" for a busy week.
 *
 * Needs a seeded station (`npm run db:reset`).
 */

declare global {
	interface Window {
		copiedSummary?: string;
	}
}

const PERIODS = ["Weekly", "Monthly", "Yearly", "Daily", "Weekly"] as const;

/**
 * The species figure in the body card's kicker, once the window has loaded.
 * An empty window drops the figures for a "No detections recorded" card.
 */
async function speciesOnScreen(page: Page): Promise<number> {
	const figure = page
		.locator("span.whitespace-nowrap", { hasText: /species$/ })
		.locator('[data-slot="count"]');
	const empty = page.getByText("No detections recorded").first();
	await expect(figure.or(empty)).toBeVisible();
	if (await empty.isVisible()) return 0;
	return Number((await figure.innerText()).replace(/,/g, ""));
}

async function copySummary(page: Page): Promise<string> {
	await page.evaluate(() => {
		window.copiedSummary = undefined;
	});
	await page.getByRole("button", { name: "Share" }).click();
	const dialog = page.getByRole("dialog", { name: "Share Summary" });
	const copy = dialog.getByRole("button", { name: "Copy" });
	await expect(copy).toBeEnabled();
	expect(
		await page.evaluate(() => window.copiedSummary),
		"opening the dialog copies nothing",
	).toBeUndefined();
	const preview = await dialog.getByTestId("share-preview").innerText();

	await copy.click();
	await expect(dialog.getByRole("button", { name: "Copied" })).toBeVisible();
	const copied = await page.evaluate(() => window.copiedSummary ?? "");
	expect(copied.replace(/\s+/g, " "), "copies what it shows").toEqual(
		preview.replace(/\s+/g, " ").trim(),
	);

	await page.keyboard.press("Escape");
	await expect(dialog).toBeHidden();
	return copied;
}

async function changeWindow(page: Page, action: () => Promise<void>) {
	const heading = page.getByRole("heading", { level: 1 });
	const before = await heading.innerText();
	await action();
	await expect(heading).not.toHaveText(before);
}

async function expectShareMatchesPage(page: Page, period: string) {
	// The last window's figures stay up until this one's arrive, along with Share.
	await expect(page.getByRole("button", { name: "Share" })).toBeEnabled();
	const species = await speciesOnScreen(page);
	const summary = await copySummary(page);

	expect(summary, "names its period").toContain(`${period} Summary`);
	// Only the All Time view may describe itself as all time.
	expect(summary).not.toMatch(/all time/i);
	if (species === 0) {
		expect(summary).toContain("Nothing heard");
	} else {
		expect(summary).toContain(`🐦  ${species.toLocaleString()} species · `);
		expect(summary).not.toContain("Nothing heard");
	}
	return summary;
}

test("a data refresh leaves the open dialog and its text in place", async ({
	page,
}) => {
	await page.goto("/timeline?period=week");
	await page.waitForLoadState("networkidle");
	const share = page.getByRole("button", { name: "Share" });
	test.skip((await share.count()) === 0, "station has no detections yet");

	await share.click();
	const dialog = page.getByRole("dialog", { name: "Share Summary" });
	const preview = dialog.getByTestId("share-preview");
	await expect(preview).toHaveAttribute("aria-busy", "false");
	const before = await preview.innerText();

	const sawInterruption = await page.evaluate(async () => {
		const shown = () =>
			document.querySelector('[data-testid="share-preview"]')?.getAttribute(
				"aria-busy",
			) === "false";
		let interrupted = false;
		const watch = setInterval(() => {
			if (!shown()) interrupted = true;
		}, 5);
		const { __TSR_ROUTER__: router } = window as unknown as {
			__TSR_ROUTER__: { invalidate: () => Promise<void> };
		};
		await router.invalidate();
		await new Promise((resolve) => setTimeout(resolve, 1_000));
		clearInterval(watch);
		return interrupted;
	});

	expect(sawInterruption, "never closes or falls back to a shell").toBe(false);
	await expect(preview).toHaveText(before);
});

test("the copied summary follows every period and window change", async ({
	page,
}) => {
	// Captured rather than written to the real clipboard, which is the machine's own.
	await page.addInitScript(() => {
		Object.defineProperty(navigator, "clipboard", {
			value: {
				writeText: async (text: string) => {
					window.copiedSummary = text;
				},
			},
		});
	});
	await page.goto("/timeline?period=day");
	await page.waitForLoadState("networkidle");
	const share = page.getByRole("button", { name: "Share" });
	test.skip((await share.count()) === 0, "station has no detections yet");

	await expectShareMatchesPage(page, "Daily");

	for (const period of PERIODS) {
		await changeWindow(page, () =>
			page.getByRole("radio", { name: period, exact: true }).click(),
		);
		await expectShareMatchesPage(page, period);
	}

	// Paging within a period, not just switching between them.
	let summary = await copySummary(page);
	for (const direction of ["Previous", "Next"]) {
		const arrow = page.getByRole("button", {
			name: new RegExp(`^${direction}`),
		});
		if (!(await arrow.isEnabled())) continue;
		await changeWindow(page, () => arrow.click());
		const paged = await expectShareMatchesPage(page, "Weekly");
		expect(paged, `${direction} moves the window`).not.toEqual(summary);
		summary = paged;
	}
});

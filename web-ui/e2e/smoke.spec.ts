import { expect, type Page, test } from "@playwright/test";

import { DEV_PASSWORD } from "../src/lib/dev-password.ts";

/**
 * Every page loads in a real browser: no error boundary, no uncaught
 * exception, no console error, and a heading on screen. Run it after
 * `npm run db:reset` and again after `npm run db:reset:empty` -- the empty
 * station is where most past breakages hid.
 */

const PUBLIC_PAGES = ["/live", "/timeline", "/detections", "/birds", "/learn"];
const GATED_PAGES = ["/review", "/settings", "/species-filter"];
// The dev server's own password; set SMOKE_PASSWORD to test any other station.
const PASSWORD = process.env.SMOKE_PASSWORD ?? DEV_PASSWORD;

function collectErrors(page: Page) {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
	page.on("console", (message) => {
		// Failed requests are judged by the response handler below instead.
		if (message.type() !== "error") return;
		if (message.text().startsWith("Failed to load resource")) return;
		errors.push(`console: ${message.text()}`);
	});
	page.on("response", (response) => {
		// A clip that is no longer on disk is normal: BirdNET-Pi purges old
		// recordings, and the seed only writes one clip per species.
		if (response.status() < 400) return;
		if (new URL(response.url()).pathname.startsWith("/api/audio/")) return;
		errors.push(`${response.status()}: ${response.url()}`);
	});
	return errors;
}

async function expectPageLoads(page: Page, path: string) {
	const errors = collectErrors(page);
	const response = await page.goto(path);
	expect(response?.status(), `${path} status`).toBeLessThan(400);
	await page.waitForLoadState("networkidle");

	await expect(page.getByRole("heading").first()).toBeVisible();
	await expect(page.getByText("This page couldn't load")).toHaveCount(0);
	await expect(page.getByText("Page not found")).toHaveCount(0);
	expect(errors, `${path} errors`).toEqual([]);
}

for (const path of PUBLIC_PAGES) {
	test(`${path} loads`, async ({ page }) => {
		await expectPageLoads(page, path);
	});
}

test("a bird profile loads", async ({ page }) => {
	await page.goto("/birds");
	await page.waitForLoadState("networkidle");
	const profile = page.locator('main a[href^="/birds/"]').first();
	test.skip((await profile.count()) === 0, "station has no birds yet");
	const href = await profile.getAttribute("href");
	await expectPageLoads(page, href ?? "/birds");
});

test("the root address redirects to the live page", async ({ page }) => {
	await expectPageLoads(page, "/");
	await expect(page).toHaveURL(/\/live/);
});

test("an unknown address gets the not-found card", async ({ page }) => {
	await page.goto("/no-such-page");
	await expect(page.getByText("Page not found")).toBeVisible();
});

test.describe("gated pages", () => {
	test("redirect to /sign-in while locked", async ({ page }) => {
		for (const path of GATED_PAGES) {
			await page.goto(path);
			await expect(page).toHaveURL(/\/sign-in/);
		}
	});

	test("load once unlocked", async ({ page }) => {
		await page.goto("/sign-in");
		// Typing before hydration leaves the form's state empty.
		await page.waitForLoadState("networkidle");
		await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
		await page.getByRole("button", { name: "Sign in", exact: true }).click();
		await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);

		for (const path of GATED_PAGES) {
			await expectPageLoads(page, path);
		}
	});
});

import { isNotFound, isRedirect } from "@tanstack/react-router";
import {
	createCsrfMiddleware,
	createMiddleware,
	createStart,
} from "@tanstack/react-start";

import { isUnauthorizedError } from "~/lib/auth.ts";
import {
	contentSecurityPolicy,
	PERMISSIONS_POLICY,
} from "~/lib/content-security-policy.ts";
import { isStationOrigin } from "~/lib/csrf-origin.ts";

const securityHeaders = createMiddleware({ type: "request" }).server(
	async ({ request, next }) => {
		const cspNonce = crypto.randomUUID();
		const result = await next({ context: { cspNonce } });
		const headers = new Headers(result.response.headers);
		headers.set("X-Frame-Options", "DENY");
		headers.set(
			"Content-Security-Policy",
			contentSecurityPolicy({ nonce: cspNonce, dev: import.meta.env.DEV }),
		);
		headers.set("Permissions-Policy", PERMISSIONS_POLICY);
		headers.set("X-Content-Type-Options", "nosniff");
		headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
		const https =
			request.headers.get("x-forwarded-proto") === "https" ||
			new URL(request.url).protocol === "https:";
		if (https) {
			headers.set("Strict-Transport-Security", "max-age=31536000");
		}
		return {
			...result,
			response: new Response(result.response.body, {
				status: result.response.status,
				statusText: result.response.statusText,
				headers,
			}),
		};
	},
);

const csrf = createCsrfMiddleware({
	filter: (ctx) => ctx.handlerType === "serverFn",
	origin: (origin, { request }) =>
		isStationOrigin(origin, request, Boolean(process.env.WEB_UI_TRUSTED_PROXY)),
});

const logFailures = createMiddleware({ type: "function" }).server(
	async ({ next }) => {
		try {
			return await next();
		} catch (error) {
			if (
				!isUnauthorizedError(error) &&
				!isRedirect(error) &&
				!isNotFound(error)
			) {
				console.error("[server] a server function failed:", error);
			}
			throw error;
		}
	},
);

export const startInstance = createStart(() => ({
	requestMiddleware: [securityHeaders, csrf],
	functionMiddleware: [logFailures],
}));

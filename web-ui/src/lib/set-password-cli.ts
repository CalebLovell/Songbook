import { changePassword } from "./auth-file.server.ts";

function readPasswordFromStdin() {
	return new Promise<string>((resolve, reject) => {
		if (process.stdin.isTTY) {
			reject(
				new Error(
					"No password on stdin. Run scripts/set_web_ui_password.sh instead.",
				),
			);
			return;
		}
		let buffer = "";
		process.stdin.setEncoding("utf8");
		process.stdin.on("data", (chunk) => {
			buffer += chunk;
		});
		process.stdin.on("end", () => resolve(buffer.replace(/\r?\n$/, "")));
		process.stdin.on("error", reject);
	});
}

try {
	await changePassword(await readPasswordFromStdin());
	console.log("Password updated. All devices have been signed out.");
} catch (error) {
	console.error((error as Error).message);
	process.exit(1);
}

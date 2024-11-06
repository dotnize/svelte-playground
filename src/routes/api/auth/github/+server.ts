import { redirect, type RequestEvent } from "@sveltejs/kit";
import { generateState } from "arctic";

import { github } from "$lib/server/auth";

export async function GET(event: RequestEvent): Promise<Response> {
	const state = generateState();

	const url = github.createAuthorizationURL(state, ["user:email"]);

	event.cookies.set("github_oauth_state", state, {
		path: "/",
		secure: import.meta.env.PROD,
		httpOnly: true,
		maxAge: 60 * 10,
		sameSite: "lax",
	});

	redirect(302, url.toString());
}

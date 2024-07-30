import { error, redirect, type RequestEvent } from "@sveltejs/kit";

import { lucia } from "$lib/server/auth";

export async function POST(event: RequestEvent): Promise<Response> {
	if (!event.locals.session) {
		return error(401);
	}

	await lucia.invalidateSession(event.locals.session.id);
	const sessionCookie = lucia.createBlankSessionCookie();
	event.cookies.set(sessionCookie.name, sessionCookie.value, {
		path: ".",
		...sessionCookie.attributes,
	});

	redirect(302, "/");
}

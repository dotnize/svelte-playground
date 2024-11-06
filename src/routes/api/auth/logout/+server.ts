import { error, redirect, type RequestEvent } from "@sveltejs/kit";

import { deleteSessionTokenCookie, invalidateSession } from "$lib/server/auth";

export async function POST(event: RequestEvent): Promise<Response> {
	if (!event.locals.session) {
		error(401);
	}
	await invalidateSession(event.locals.session.id);
	deleteSessionTokenCookie(event);

	return redirect(302, "/signin");
}

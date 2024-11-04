import { auth } from "$lib/server/auth";
import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ request }) => {
	const session = await auth.api.getSession({
		headers: request.headers,
	});

	if (!session || !session.user) {
		redirect(302, "/signin");
	}

	return {
		user: session.user,
	};
};

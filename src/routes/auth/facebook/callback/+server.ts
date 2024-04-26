import type { RequestEvent } from "@sveltejs/kit";
import { OAuth2RequestError } from "arctic";
import { and, eq } from "drizzle-orm";
import { generateId } from "lucia";

import { facebook, lucia } from "$lib/server/auth";
import { db } from "$lib/server/db";
import { oauthAccounts, users } from "$lib/server/schema";

interface FacebookUser {
	id: string;
	name: string;
	first_name: string;
	last_name: string;
	picture: {
		data: { height: number; width: number; is_silhouette: boolean; url: string };
	};
	email: string;
}

export async function GET(event: RequestEvent): Promise<Response> {
	const code = event.url.searchParams.get("code");
	const state = event.url.searchParams.get("state");

	const storedState = event.cookies.get("facebook_oauth_state") ?? null;

	if (!code || !state || !storedState || state !== storedState) {
		return new Response(null, {
			status: 400,
		});
	}

	try {
		const tokens = await facebook.validateAuthorizationCode(code);
		const url = new URL("https://graph.facebook.com/me");
		url.searchParams.set("access_token", tokens.accessToken);
		url.searchParams.set(
			"fields",
			["id", "name", "first_name", "last_name", "picture", "email"].join(",")
		);
		const response = await fetch(url);
		const facebookUser: FacebookUser = await response.json();

		const existingUser = await db.query.oauthAccounts.findFirst({
			where: and(
				eq(oauthAccounts.providerId, "facebook"),
				eq(oauthAccounts.providerUserId, facebookUser.id)
			),
		});

		if (existingUser) {
			const session = await lucia.createSession(existingUser.userId, {});
			const sessionCookie = lucia.createSessionCookie(session.id);
			event.cookies.set(sessionCookie.name, sessionCookie.value, {
				path: ".",
				...sessionCookie.attributes,
			});
		} else {
			const userId = generateId(15);

			await db.transaction(async (tx) => {
				await tx.insert(users).values({
					id: userId,
					email: facebookUser.email,
					name: facebookUser.name,
					firstName: facebookUser.first_name,
					lastName: facebookUser.last_name,
					avatarUrl: facebookUser.picture.data.url,
				});
				await tx
					.insert(oauthAccounts)
					.values({ providerId: "facebook", providerUserId: facebookUser.id, userId });
			});

			const session = await lucia.createSession(userId, {});
			const sessionCookie = lucia.createSessionCookie(session.id);
			event.cookies.set(sessionCookie.name, sessionCookie.value, {
				path: ".",
				...sessionCookie.attributes,
			});
		}
		return new Response(null, {
			status: 302,
			headers: {
				Location: "/",
			},
		});
	} catch (e) {
		// the specific error message depends on the provider
		if (e instanceof OAuth2RequestError) {
			// invalid code
			return new Response(null, {
				status: 400,
			});
		}
		return new Response(null, {
			status: 500,
		});
	}
}

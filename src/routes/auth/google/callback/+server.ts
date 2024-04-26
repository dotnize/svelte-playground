import type { RequestEvent } from "@sveltejs/kit";
import { OAuth2RequestError } from "arctic";
import { and, eq } from "drizzle-orm";
import { generateId } from "lucia";

import { google, lucia } from "$lib/server/auth";
import { db } from "$lib/server/db";
import { oauthAccounts, users } from "$lib/server/schema";

interface GoogleUser {
	sub: string;
	name: string;
	given_name: string;
	family_name: string;
	email: string;
	picture: string;
	email_verified: boolean;
	locale: string;
}

export async function GET(event: RequestEvent): Promise<Response> {
	const code = event.url.searchParams.get("code");
	const state = event.url.searchParams.get("state");

	const storedState = event.cookies.get("google_oauth_state") ?? null;
	const storedCodeVerifier = event.cookies.get("google_code_verifier") ?? null;

	if (!code || !state || !storedState || !storedCodeVerifier || state !== storedState) {
		return new Response(null, {
			status: 400,
		});
	}

	try {
		const tokens = await google.validateAuthorizationCode(code, storedCodeVerifier);
		const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
			headers: {
				Authorization: `Bearer ${tokens.accessToken}`,
			},
		});
		const googleUser: GoogleUser = await response.json();

		const existingUser = await db.query.oauthAccounts.findFirst({
			where: and(
				eq(oauthAccounts.providerId, "google"),
				eq(oauthAccounts.providerUserId, googleUser.sub)
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
					email: googleUser.email,
					name: googleUser.name,
					firstName: googleUser.given_name,
					lastName: googleUser.family_name,
					avatarUrl: googleUser.picture,
				});
				await tx
					.insert(oauthAccounts)
					.values({ providerId: "google", providerUserId: googleUser.sub, userId });
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

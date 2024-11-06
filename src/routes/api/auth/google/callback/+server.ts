import type { RequestEvent } from "@sveltejs/kit";
import { OAuth2RequestError } from "arctic";
import { and, eq } from "drizzle-orm";

import {
	createSession,
	generateSessionToken,
	google,
	setSessionTokenCookie,
} from "$lib/server/auth";
import { db, table } from "$lib/server/db";

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

	const PROVIDER_ID = "google";

	try {
		const tokens = await google.validateAuthorizationCode(code, storedCodeVerifier);
		const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
			headers: {
				Authorization: `Bearer ${tokens.accessToken()}`,
			},
		});
		const providerUser: GoogleUser = await response.json();

		const existingUser = await db.query.oauthAccount.findFirst({
			where: and(
				eq(table.oauthAccount.provider_id, PROVIDER_ID),
				eq(table.oauthAccount.provider_user_id, providerUser.sub)
			),
		});

		if (existingUser) {
			const token = generateSessionToken();
			const session = await createSession(token, existingUser.user_id);
			setSessionTokenCookie(event, token, session.expires_at);
			return new Response(null, {
				status: 302,
				headers: {
					Location: "/",
				},
			});
		} else {
			const existingUserEmail = await db.query.user.findFirst({
				where: eq(table.user.email, providerUser.email),
			});
			if (existingUserEmail) {
				await db.insert(table.oauthAccount).values({
					provider_id: PROVIDER_ID,
					provider_user_id: providerUser.sub,
					user_id: existingUserEmail.id,
				});
				const token = generateSessionToken();
				const session = await createSession(token, existingUserEmail.id);
				setSessionTokenCookie(event, token, session.expires_at);
				return new Response(null, {
					status: 302,
					headers: {
						Location: "/",
					},
				});
			}
		}

		const userId = await db.transaction(async (tx) => {
			const [{ newId }] = await tx
				.insert(table.user)
				.values({
					email: providerUser.email,
					name: providerUser.name,
					// first_name: providerUser.given_name,
					// last_name: providerUser.family_name,
					avatar_url: providerUser.picture,
				})
				.returning({ newId: table.user.id });
			await tx.insert(table.oauthAccount).values({
				provider_id: PROVIDER_ID,
				provider_user_id: providerUser.sub,
				user_id: newId,
			});
			return newId;
		});

		const token = generateSessionToken();
		const session = await createSession(token, userId);
		setSessionTokenCookie(event, token, session.expires_at);
		return new Response(null, {
			status: 302,
			headers: {
				Location: "/",
			},
		});
	} catch (e) {
		console.log(e);
		if (e instanceof OAuth2RequestError) {
			return new Response(null, {
				status: 400,
			});
		}
		return new Response(null, {
			status: 500,
		});
	}
}

import type { RequestEvent } from "@sveltejs/kit";
import { OAuth2RequestError } from "arctic";
import { and, eq } from "drizzle-orm";

import {
	createSession,
	generateSessionToken,
	github,
	setSessionTokenCookie,
} from "$lib/server/auth";
import { db, table } from "$lib/server/db";

interface GitHubUser {
	id: string;
	name: string | null;
	email: string;
	avatar_url: string;
	location: string | null;
	login: string;
}

export async function GET(event: RequestEvent): Promise<Response> {
	const code = event.url.searchParams.get("code");
	const state = event.url.searchParams.get("state");

	const storedState = event.cookies.get("github_oauth_state") ?? null;

	if (!code || !state || !storedState || state !== storedState) {
		return new Response(null, {
			status: 400,
		});
	}

	const PROVIDER_ID = "github";

	try {
		const tokens = await github.validateAuthorizationCode(code);
		const response = await fetch("https://api.github.com/user", {
			headers: {
				Authorization: `Bearer ${tokens.accessToken()}`,
			},
		});
		const providerUser: GitHubUser = await response.json();

		const existingUser = await db.query.oauthAccount.findFirst({
			where: and(
				eq(table.oauthAccount.provider_id, PROVIDER_ID),
				eq(table.oauthAccount.provider_user_id, providerUser.id)
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
					provider_user_id: providerUser.id,
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
					name: providerUser.name || providerUser.login,
					avatar_url: providerUser.avatar_url,
				})
				.returning({ newId: table.user.id });
			await tx.insert(table.oauthAccount).values({
				provider_id: PROVIDER_ID,
				provider_user_id: providerUser.id,
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

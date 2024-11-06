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

interface DiscordUser {
	id: string;
	username: string;
	global_name?: string;
	avatar?: string;
	email: string;
	verified: boolean;
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

	const PROVIDER_ID = "discord";

	try {
		const tokens = await github.validateAuthorizationCode(code);
		const response = await fetch("https://discord.com/api/v10/users/@me", {
			headers: {
				Authorization: `Bearer ${tokens.accessToken()}`,
			},
		});
		const providerUser: DiscordUser = await response.json();

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
					name: providerUser.global_name || providerUser.username,
					avatar_url: providerUser.avatar
						? `https://cdn.discordapp.com/avatars/${providerUser.id}/${providerUser.avatar}.png`
						: null,
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

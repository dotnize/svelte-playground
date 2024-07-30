import type { RequestEvent } from "@sveltejs/kit";
import { OAuth2RequestError } from "arctic";
import { and, eq } from "drizzle-orm";
import { generateId } from "lucia";

import { github, lucia } from "$lib/server/auth";
import { db } from "$lib/server/db";
import { oauthAccounts, users } from "$lib/server/schema";

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

	try {
		const tokens = await github.validateAuthorizationCode(code);
		const githubUserResponse = await fetch("https://api.github.com/user", {
			headers: {
				Authorization: `Bearer ${tokens.accessToken()}`,
			},
		});
		const githubUser: GitHubUser = await githubUserResponse.json();

		const existingUser = await db.query.oauthAccounts.findFirst({
			where: and(
				eq(oauthAccounts.providerId, "github"),
				eq(oauthAccounts.providerUserId, githubUser.id)
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
					email: githubUser.email,
					name: githubUser.name || githubUser.login,
					avatarUrl: githubUser.avatar_url,
				});
				await tx
					.insert(oauthAccounts)
					.values({ providerId: "github", providerUserId: githubUser.id, userId });
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

import { db, table } from "$lib/server/db";
import type { Session } from "$lib/server/db/schema";
import { sha256 } from "@oslojs/crypto/sha2";
import { encodeBase32LowerCase, encodeHexLowerCase } from "@oslojs/encoding";
import type { RequestEvent } from "@sveltejs/kit";
import { Discord, GitHub, Google } from "arctic";
import { eq } from "drizzle-orm";

import { env } from "$env/dynamic/private";

const DAY_IN_MS = 1000 * 60 * 60 * 24;

export const sessionCookieName = "auth-session";

export function generateSessionToken() {
	const bytes = crypto.getRandomValues(new Uint8Array(20));
	const token = encodeBase32LowerCase(bytes);
	return token;
}

export async function createSession(token: string, userId: number) {
	const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
	const session: Session = {
		id: sessionId,
		user_id: userId,
		expires_at: new Date(Date.now() + DAY_IN_MS * 30),
	};
	await db.insert(table.session).values(session);
	return session;
}

export async function validateSessionToken(token: string) {
	const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
	const [result] = await db
		.select({
			user: {
				// Only return the necessary user data for the client
				id: table.user.id,
				name: table.user.name,
				// first_name: table.user.first_name,
				// last_name: table.user.last_name,
				avatar_url: table.user.avatar_url,
				email: table.user.email,
				setup_at: table.user.setup_at,
			},
			session: table.session,
		})
		.from(table.session)
		.innerJoin(table.user, eq(table.session.user_id, table.user.id))
		.where(eq(table.session.id, sessionId));

	if (!result) {
		return { session: null, user: null };
	}
	const { session, user } = result;

	const sessionExpired = Date.now() >= session.expires_at.getTime();
	if (sessionExpired) {
		await db.delete(table.session).where(eq(table.session.id, session.id));
		return { session: null, user: null };
	}

	const renewSession = Date.now() >= session.expires_at.getTime() - DAY_IN_MS * 15;
	if (renewSession) {
		session.expires_at = new Date(Date.now() + DAY_IN_MS * 30);
		await db
			.update(table.session)
			.set({ expires_at: session.expires_at })
			.where(eq(table.session.id, session.id));
	}

	return { session, user };
}

export type SessionValidationResult = Awaited<ReturnType<typeof validateSessionToken>>;
export type SessionUser = SessionValidationResult["user"];

export async function invalidateSession(sessionId: string) {
	await db.delete(table.session).where(eq(table.session.id, sessionId));
}

export function setSessionTokenCookie(event: RequestEvent, token: string, expiresAt: Date) {
	event.cookies.set(sessionCookieName, token, {
		expires: expiresAt,
		path: "/",
	});
}

export function deleteSessionTokenCookie(event: RequestEvent) {
	event.cookies.delete(sessionCookieName, {
		path: "/",
	});
}

// OAuth2 Providers
export const discord = new Discord(
	env.DISCORD_CLIENT_ID as string,
	env.DISCORD_CLIENT_SECRET as string,
	env.DISCORD_REDIRECT_URI as string
);
export const github = new GitHub(
	env.GITHUB_CLIENT_ID as string,
	env.GITHUB_CLIENT_SECRET as string,
	env.GITHUB_REDIRECT_URI || null
);
export const google = new Google(
	env.GOOGLE_CLIENT_ID as string,
	env.GOOGLE_CLIENT_SECRET as string,
	env.GOOGLE_REDIRECT_URI as string
);

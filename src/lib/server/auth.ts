import { DrizzlePostgreSQLAdapter } from "@lucia-auth/adapter-drizzle";
import { Facebook, GitHub, Google } from "arctic";
import { Lucia } from "lucia";

import { dev } from "$app/environment";
import {
	FACEBOOK_CLIENT_ID,
	FACEBOOK_CLIENT_SECRET,
	FACEBOOK_REDIRECT_URI,
	GITHUB_CLIENT_ID,
	GITHUB_CLIENT_SECRET,
	GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET,
	GOOGLE_REDIRECT_URI,
} from "$env/static/private";

import { db } from "./db";
import { sessions, users, type User as DatabaseUser } from "./schema";

const adapter = new DrizzlePostgreSQLAdapter(db, sessions, users);

export const lucia = new Lucia(adapter, {
	sessionCookie: {
		attributes: {
			secure: !dev,
		},
	},
	getUserAttributes: (attr) => ({
		id: attr.id,
		name: attr.name,
		firstName: attr.firstName,
		lastName: attr.lastName,
		avatarUrl: attr.avatarUrl,
		email: attr.email,
	}),
});

declare module "lucia" {
	interface Register {
		Lucia: typeof lucia;
		DatabaseUserAttributes: DatabaseUser;
	}
}

// OAuth2 Providers
export const facebook = new Facebook(
	FACEBOOK_CLIENT_ID,
	FACEBOOK_CLIENT_SECRET,
	FACEBOOK_REDIRECT_URI
);
export const github = new GitHub(GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET);
export const google = new Google(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);

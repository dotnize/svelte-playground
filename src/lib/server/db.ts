import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { DATABASE_URL } from "$env/static/private";

import * as schema from "./schema";

const connection = postgres(DATABASE_URL);

export const db = drizzle(connection, { schema });

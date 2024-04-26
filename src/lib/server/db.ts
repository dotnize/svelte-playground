import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { DATABASE_URL } from "$env/static/private";

import * as schema from "./schema";

const connection = new Pool({ connectionString: DATABASE_URL });

export const db = drizzle(connection, { schema });

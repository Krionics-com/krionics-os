import postgres from "postgres";
import { getEnv } from "./env.js";

const { databaseUrl } = getEnv();

export const sql = postgres(databaseUrl, {
  ssl: "require",
  max: 5,
  onnotice: () => {}
});

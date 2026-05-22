import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("Missing DATABASE_URL");
}

export const sql = postgres(DATABASE_URL, {
  ssl: "require",
  max: 5,
  onnotice: () => {}
});

import { pool } from "../lib/db";
import { ensureMigrated } from "../lib/setup";

ensureMigrated(pool)
  .then((ran) => console.log(ran === 0 ? "Database is up to date." : `Applied ${ran} migration(s).`))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

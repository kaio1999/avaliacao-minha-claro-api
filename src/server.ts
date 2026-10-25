import { buildApp } from "./app";
import { config } from "./config";
import { openDatabase } from "./db/connection";
import { migrate } from "./db/migrate";
import { countTeams } from "./modules/shared/repository";
import { applySeed } from "./db/seed";

const db = openDatabase(config.databasePath);
migrate(db);

if (countTeams(db) === 0) {
  applySeed(db);
}

const app = await buildApp(db, { logger: true });

await app.listen({ port: config.port, host: "0.0.0.0" });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void app.close().finally(() => {
      db.close();
      process.exit(0);
    });
  });
}

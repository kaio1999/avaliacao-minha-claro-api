import type { DatabaseSync } from "node:sqlite";

import { seedTasks, seedTeams } from "./seed-data";
import { inTransaction, insertTask, insertTeam, replaceTaskTeams } from "../modules/shared/repository";
import { openDatabase } from "./connection";
import { config } from "../config";
import { migrate } from "./migrate";

export function resetData(db: DatabaseSync): void {
  db.exec("DELETE FROM task_teams; DELETE FROM tasks; DELETE FROM teams;");
}

export function applySeed(db: DatabaseSync): void {
  inTransaction(db, () => {
    for (const team of seedTeams) {
      insertTeam(db, team);
    }

    for (const task of seedTasks) {
      insertTask(db, task);
      replaceTaskTeams(db, task.id, task.teamIds);
    }
  });
}

const isCli = process.argv[1]?.includes("seed");

if (isCli) {
  const db = openDatabase(config.databasePath);
  migrate(db);
  resetData(db);
  applySeed(db);
  db.close();
  console.log("Seed aplicado: 3 times e 10 tarefas.");
}

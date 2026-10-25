import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { openDatabase } from "../src/db/connection";
import { migrate } from "../src/db/migrate";
import { createTaskSchema, listTasksQuerySchema } from "../src/modules/shared/schemas";
import {
  deleteTeamRow,
  findTask,
  insertTask,
  insertTeam,
  listTasks,
  replaceTaskTeams,
} from "../src/modules/shared/repository";
import { isIsoDate } from "../src/shared/date";
import { toLikePattern } from "../src/shared/like";

const stamp = "2026-03-01T12:00:00.000Z";

describe("regras puras", () => {
  test("aceita só data de calendário", () => {
    assert.equal(isIsoDate("2026-11-02"), true);
    assert.equal(isIsoDate("2026-02-31"), false);
    assert.equal(isIsoDate("02/11/2026"), false);
  });

  test("escapa curingas do LIKE", () => {
    assert.equal(toLikePattern("100%"), "%100\\%%");
    assert.equal(toLikePattern("a_b"), "%a\\_b%");
  });

  test("rejeita título curto e ordenação fora da lista", () => {
    const title = createTaskSchema.safeParse({ title: "ab" });
    assert.equal(title.success, false);

    const sort = listTasksQuerySchema.safeParse({ sort: "drop" });
    assert.equal(sort.success, false);

    const allowed = listTasksQuerySchema.parse({ sort: "title:asc", limit: "2", offset: "0" });
    assert.equal(allowed.sort, "title:asc");
    assert.equal(allowed.limit, 2);
  });
});

describe("repositório", () => {
  test("filtra por time e mantém a tarefa quando o time some", () => {
    const db = openDatabase(":memory:");
    migrate(db);
    const design = "8f1c2a10-6b4e-4c3a-9d21-0a1b2c3d4e01";
    const produto = "8f1c2a10-6b4e-4c3a-9d21-0a1b2c3d4e02";
    const taskId = "a1000000-0000-4000-8000-000000000099";

    insertTeam(db, {
      id: design,
      name: "Design",
      colorHex: "#50B182",
      description: null,
      createdAt: stamp,
      updatedAt: stamp,
    });
    insertTeam(db, {
      id: produto,
      name: "Produto",
      colorHex: "#B0A233",
      description: null,
      createdAt: stamp,
      updatedAt: stamp,
    });
    insertTask(db, {
      id: taskId,
      title: "Planejar release",
      description: null,
      status: "pendente",
      dueDate: null,
      teamIds: [],
      createdAt: stamp,
      updatedAt: stamp,
    });
    replaceTaskTeams(db, taskId, [design, produto]);

    const listed = listTasks(db, {
      teamId: design,
      sort: "title:asc",
      limit: 10,
      offset: 0,
    });
    assert.equal(listed.total, 1);
    assert.equal(listed.items[0]?.teams.length, 2);

    deleteTeamRow(db, design);
    const kept = findTask(db, taskId);
    assert.equal(kept?.title, "Planejar release");
    assert.deepEqual(
      kept?.teams.map((team) => team.id),
      [produto],
    );

    db.close();
  });
});

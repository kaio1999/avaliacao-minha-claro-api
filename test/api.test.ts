import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { FastifyInstance } from "fastify";
import type { DatabaseSync } from "node:sqlite";

import { buildApp } from "../src/app";
import { openDatabase } from "../src/db/connection";
import { migrate } from "../src/db/migrate";
import { applySeed } from "../src/db/seed";
import { seedTaskIds, seedTeamIds } from "../src/db/seed-data";
import { isIsoDate } from "../src/shared/date";
import { toLikePattern } from "../src/shared/like";
import type { PageMeta, Task, Team } from "../src/domain";

type Page<T> = { data: T[]; meta: PageMeta };
type Item<T> = { data: T };
type ErrorBody = { error: { code: string; message: string; details?: unknown } };

async function withApp(seeded: boolean, run: (app: FastifyInstance) => Promise<void>) {
  const db: DatabaseSync = openDatabase(":memory:");
  migrate(db);
  if (seeded) applySeed(db);
  const app = await buildApp(db);
  try {
    await run(app);
  } finally {
    await app.close();
    db.close();
  }
}

function json<T>(response: { body: string }): T {
  return JSON.parse(response.body) as T;
}

describe("utilitários", () => {
  test("aceita só data de calendário", () => {
    assert.equal(isIsoDate("2026-11-02"), true);
    assert.equal(isIsoDate("2026-02-31"), false);
    assert.equal(isIsoDate("02/11/2026"), false);
  });

  test("escapa curingas do LIKE", () => {
    assert.equal(toLikePattern("100%"), "%100\\%%");
    assert.equal(toLikePattern("a_b"), "%a\\_b%");
  });
});

describe("times", () => {
  test("lista com metadata e busca", async () => {
    await withApp(true, async (app) => {
      const response = await app.inject({ method: "GET", url: "/api/teams?limit=2&offset=0" });
      assert.equal(response.statusCode, 200);
      const body = json<Page<Team>>(response);
      assert.equal(body.meta.total, 3);
      assert.equal(body.data.length, 2);
      assert.deepEqual(
        body.data.map((team) => team.name),
        ["Design", "Engenharia"],
      );

      const search = await app.inject({ method: "GET", url: "/api/teams?search=produto" });
      const found = json<Page<Team>>(search);
      assert.equal(found.meta.total, 1);
      assert.equal(found.data[0]?.name, "Produto");
    });
  });

  test("cria, atualiza e remove", async () => {
    await withApp(false, async (app) => {
      const created = await app.inject({
        method: "POST",
        url: "/api/teams",
        payload: { name: "Financeiro", colorHex: "#3B8562", description: "Fechamento" },
      });
      assert.equal(created.statusCode, 201);
      const team = json<Item<Team>>(created).data;
      assert.equal(team.name, "Financeiro");

      const updated = await app.inject({
        method: "PUT",
        url: `/api/teams/${team.id}`,
        payload: { name: "Finanças" },
      });
      assert.equal(json<Item<Team>>(updated).data.name, "Finanças");

      const removed = await app.inject({ method: "DELETE", url: `/api/teams/${team.id}` });
      assert.equal(removed.statusCode, 200);
      const missing = await app.inject({ method: "GET", url: `/api/teams/${team.id}` });
      assert.equal(missing.statusCode, 404);
      assert.equal(json<ErrorBody>(missing).error.code, "NOT_FOUND");
    });
  });

  test("rejeita nome curto e cor inválida", async () => {
    await withApp(false, async (app) => {
      const response = await app.inject({
        method: "POST",
        url: "/api/teams",
        payload: { name: "AB", colorHex: "verde" },
      });
      assert.equal(response.statusCode, 400);
      const body = json<ErrorBody>(response);
      assert.equal(body.error.code, "VALIDATION_ERROR");
      assert.ok(body.error.details);
    });
  });
});

describe("tarefas", () => {
  test("filtra por time, status e busca, e pagina", async () => {
    await withApp(true, async (app) => {
      const all = await app.inject({ method: "GET", url: "/api/tasks?limit=20" });
      assert.equal(json<Page<Task>>(all).meta.total, 10);

      const byTeam = await app.inject({
        method: "GET",
        url: `/api/tasks?teamId=${seedTeamIds.design}&status=pendente`,
      });
      const filtered = json<Page<Task>>(byTeam);
      assert.equal(filtered.meta.total, 2);
      assert.ok(filtered.data.every((task) => task.status === "pendente"));
      assert.ok(filtered.data.every((task) => task.teams.some((team) => team.id === seedTeamIds.design)));

      const search = await app.inject({ method: "GET", url: "/api/tasks?search=%25" });
      assert.equal(json<Page<Task>>(search).meta.total, 0);

      const chip = await app.inject({ method: "GET", url: "/api/tasks?search=Ajustar%20chip" });
      assert.equal(json<Page<Task>>(chip).data[0]?.id, seedTaskIds.chip);

      const page = await app.inject({
        method: "GET",
        url: "/api/tasks?limit=2&offset=0&sort=title:asc",
      });
      const first = json<Page<Task>>(page);
      assert.equal(first.meta.total, 10);
      assert.equal(first.data.length, 2);
      assert.equal(first.meta.offset, 0);

      const second = json<Page<Task>>(
        await app.inject({ method: "GET", url: "/api/tasks?limit=2&offset=2&sort=title:asc" }),
      );
      assert.notEqual(second.data[0]?.id, first.data[0]?.id);
    });
  });

  test("cria com vários times, muda o status e preserva a tarefa ao apagar o time", async () => {
    await withApp(true, async (app) => {
      const created = await app.inject({
        method: "POST",
        url: "/api/tasks",
        payload: {
          title: "Planejar release",
          status: "pendente",
          teamIds: [seedTeamIds.design, seedTeamIds.engenharia],
        },
      });
      assert.equal(created.statusCode, 201);
      const task = json<Item<Task>>(created).data;
      assert.equal(task.teams.length, 2);

      const updated = await app.inject({
        method: "PUT",
        url: `/api/tasks/${task.id}`,
        payload: { status: "concluida" },
      });
      assert.equal(json<Item<Task>>(updated).data.status, "concluida");
      assert.equal(json<Item<Task>>(updated).data.title, "Planejar release");

      const orphan = json<Item<Task>>(
        await app.inject({ method: "GET", url: `/api/tasks/${seedTaskIds.semTime}` }),
      ).data;
      assert.equal(orphan.teams.length, 0);

      const removedTeam = await app.inject({
        method: "DELETE",
        url: `/api/teams/${seedTeamIds.design}`,
      });
      assert.equal(removedTeam.statusCode, 200);

      const kept = json<Item<Task>>(
        await app.inject({ method: "GET", url: `/api/tasks/${seedTaskIds.layout}` }),
      ).data;
      assert.equal(kept.teams.length, 0);
      assert.equal(kept.title, "Revisar layout das tarefas");
    });
  });

  test("devolve o envelope de erro", async () => {
    await withApp(true, async (app) => {
      const shortTitle = await app.inject({
        method: "POST",
        url: "/api/tasks",
        payload: { title: "ab" },
      });
      assert.equal(shortTitle.statusCode, 400);
      assert.equal(json<ErrorBody>(shortTitle).error.code, "VALIDATION_ERROR");

      const missingTeam = await app.inject({
        method: "POST",
        url: "/api/tasks",
        payload: {
          title: "Tarefa órfã de time",
          teamIds: ["00000000-0000-4000-8000-000000000099"],
        },
      });
      assert.equal(missingTeam.statusCode, 400);

      const missing = await app.inject({
        method: "GET",
        url: "/api/tasks/00000000-0000-4000-8000-000000000099",
      });
      assert.equal(missing.statusCode, 404);
      assert.equal(json<ErrorBody>(missing).error.code, "NOT_FOUND");
      assert.equal(typeof json<ErrorBody>(missing).error.message, "string");

      const badSort = await app.inject({ method: "GET", url: "/api/tasks?sort=drop" });
      assert.equal(badSort.statusCode, 400);
    });
  });

  test("libera CORS para o app", async () => {
    await withApp(false, async (app) => {
      const response = await app.inject({
        method: "GET",
        url: "/health",
        headers: { origin: "http://localhost:8081" },
      });
      assert.equal(response.statusCode, 200);
      assert.equal(response.headers["access-control-allow-origin"], "http://localhost:8081");

      const preflight = await app.inject({
        method: "OPTIONS",
        url: "/api/tasks/00000000-0000-4000-8000-000000000099",
        headers: {
          origin: "http://localhost:8081",
          "access-control-request-method": "PUT",
        },
      });
      assert.equal(preflight.statusCode, 204);
      assert.match(String(preflight.headers["access-control-allow-methods"]), /PUT/);
      assert.match(String(preflight.headers["access-control-allow-methods"]), /DELETE/);
    });
  });
});

import type { FastifyInstance } from "fastify";
import type { DatabaseSync } from "node:sqlite";

import { parse } from "../../shared/parse";
import { createTeam, editTeam, getTeam, getTeams, removeTeam } from "./teams.service";
import {
  createTeamSchema,
  idParamsSchema,
  listTeamsQuerySchema,
  updateTeamSchema,
} from "../shared/schemas";

export function registerTeamRoutes(app: FastifyInstance, db: DatabaseSync): void {
  app.get("/api/teams", async (request) => {
    const query = parse(listTeamsQuerySchema, request.query);
    const result = getTeams(db, query);
    return {
      data: result.items,
      meta: { total: result.total, limit: query.limit, offset: query.offset },
    };
  });

  app.get("/api/teams/:id", async (request) => {
    const params = parse(idParamsSchema, request.params);
    return { data: getTeam(db, params.id) };
  });

  app.post("/api/teams", async (request, reply) => {
    const body = parse(createTeamSchema, request.body ?? {});
    reply.code(201);
    return { data: createTeam(db, body) };
  });

  app.put("/api/teams/:id", async (request) => {
    const params = parse(idParamsSchema, request.params);
    const body = parse(updateTeamSchema, request.body ?? {});
    return { data: editTeam(db, params.id, body) };
  });

  app.delete("/api/teams/:id", async (request) => {
    const params = parse(idParamsSchema, request.params);
    removeTeam(db, params.id);
    return { data: { id: params.id } };
  });
}

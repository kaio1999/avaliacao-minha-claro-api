import type { FastifyInstance } from "fastify";
import type { DatabaseSync } from "node:sqlite";

import { parse } from "../../shared/parse";
import { createTask, editTask, getTask, getTasks, removeTask } from "./tasks.service";
import {
  createTaskSchema,
  idParamsSchema,
  listTasksQuerySchema,
  updateTaskSchema,
} from "../shared/schemas";

export function registerTaskRoutes(app: FastifyInstance, db: DatabaseSync): void {
  app.get("/api/tasks", async (request) => {
    const query = parse(listTasksQuerySchema, request.query);
    const result = getTasks(db, query);
    return {
      data: result.items,
      meta: { total: result.total, limit: query.limit, offset: query.offset },
    };
  });

  app.get("/api/tasks/:id", async (request) => {
    const params = parse(idParamsSchema, request.params);
    return { data: getTask(db, params.id) };
  });

  app.post("/api/tasks", async (request, reply) => {
    const body = parse(createTaskSchema, request.body ?? {});
    reply.code(201);
    return { data: createTask(db, body) };
  });

  app.put("/api/tasks/:id", async (request) => {
    const params = parse(idParamsSchema, request.params);
    const body = parse(updateTaskSchema, request.body ?? {});
    return { data: editTask(db, params.id, body) };
  });

  app.delete("/api/tasks/:id", async (request) => {
    const params = parse(idParamsSchema, request.params);
    removeTask(db, params.id);
    return { data: { id: params.id } };
  });
}

import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import type { DatabaseSync } from "node:sqlite";

import { DomainError } from "./domain";
import { errorBody, HttpError } from "./shared/http-error";
import { registerTaskRoutes } from "./modules/tasks/tasks.routes";
import { registerTeamRoutes } from "./modules/teams/teams.routes";

type BuildOptions = {
  logger?: boolean;
};

export async function buildApp(db: DatabaseSync, options: BuildOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false });

  app.setErrorHandler((error: unknown, request, reply) => {
    if (error instanceof HttpError) {
      return reply.status(error.statusCode).send(errorBody(error));
    }

    if (error instanceof DomainError) {
      const statusCode = error.code === "NOT_FOUND" ? 404 : 400;
      return reply.status(statusCode).send(errorBody(error));
    }

    const statusCode =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : 500;

    if (statusCode >= 400 && statusCode < 500) {
      return reply.status(statusCode).send({
        error: { code: "BAD_REQUEST", message: "Requisição inválida" },
      });
    }

    request.log.error({ err: error }, "Erro interno");
    return reply.status(500).send({
      error: { code: "INTERNAL_ERROR", message: "Erro interno" },
    });
  });

  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      error: {
        code: "NOT_FOUND",
        message: `Rota não encontrada: ${request.method} ${request.url}`,
      },
    });
  });

  await app.register(cors, {
    origin: true,
    methods: ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS"],
  });

  app.get("/health", async () => ({ data: { status: "ok" } }));
  registerTeamRoutes(app, db);
  registerTaskRoutes(app, db);

  return app;
}

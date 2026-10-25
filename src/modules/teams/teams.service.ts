import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import type { z } from "zod";

import { DomainError, type Team } from "../../domain";
import { emptyToNull } from "../../shared/date";
import {
  deleteTeamRow,
  findExistingTeamIds,
  findTeam,
  inTransaction,
  insertTeam,
  listTeams,
  updateTeam,
} from "../shared/repository";
import type { createTeamSchema, listTeamsQuerySchema, updateTeamSchema } from "../shared/schemas";

type ListTeamsQuery = z.infer<typeof listTeamsQuerySchema>;
type CreateTeamInput = z.infer<typeof createTeamSchema>;
type UpdateTeamInput = z.infer<typeof updateTeamSchema>;

function requireTeam(db: DatabaseSync, id: string): Team {
  const team = findTeam(db, id);
  if (!team) {
    throw new DomainError("NOT_FOUND", "Time não encontrado");
  }
  return team;
}

export function getTeams(db: DatabaseSync, query: ListTeamsQuery) {
  return listTeams(db, query);
}

export function getTeam(db: DatabaseSync, id: string): Team {
  return requireTeam(db, id);
}

export function createTeam(db: DatabaseSync, input: CreateTeamInput): Team {
  const now = new Date().toISOString();
  const id = randomUUID();
  insertTeam(db, {
    id,
    name: input.name,
    colorHex: input.colorHex,
    description: emptyToNull(input.description),
    createdAt: now,
    updatedAt: now,
  });
  return requireTeam(db, id);
}

export function editTeam(db: DatabaseSync, id: string, input: UpdateTeamInput): Team {
  requireTeam(db, id);
  const now = new Date().toISOString();
  updateTeam(db, {
    id,
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.colorHex === undefined ? {} : { colorHex: input.colorHex }),
    ...(input.description === undefined ? {} : { description: emptyToNull(input.description) }),
    updatedAt: now,
  });
  return requireTeam(db, id);
}

export function removeTeam(db: DatabaseSync, id: string): void {
  requireTeam(db, id);
  inTransaction(db, () => {
    deleteTeamRow(db, id);
  });
}

export function assertTeamsExist(db: DatabaseSync, ids: readonly string[]): void {
  if (ids.length === 0) return;
  const found = new Set(findExistingTeamIds(db, ids));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length > 0) {
    throw new DomainError("VALIDATION_ERROR", "Um ou mais times não existem", {
      fieldErrors: { teamIds: ["Time não encontrado"] },
    });
  }
}

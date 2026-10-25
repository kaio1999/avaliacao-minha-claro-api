import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import type { z } from "zod";

import { DomainError, type Task } from "../../domain";
import { emptyToNull } from "../../shared/date";
import { assertTeamsExist } from "../teams/teams.service";
import {
  deleteTaskRow,
  findTask,
  inTransaction,
  insertTask,
  listTasks,
  replaceTaskTeams,
  updateTaskRow,
} from "../shared/repository";
import type { createTaskSchema, listTasksQuerySchema, updateTaskSchema } from "../shared/schemas";

type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
type CreateTaskInput = z.infer<typeof createTaskSchema>;
type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

function requireTask(db: DatabaseSync, id: string): Task {
  const task = findTask(db, id);
  if (!task) {
    throw new DomainError("NOT_FOUND", "Tarefa não encontrada");
  }
  return task;
}

export function getTasks(db: DatabaseSync, query: ListTasksQuery) {
  return listTasks(db, query);
}

export function getTask(db: DatabaseSync, id: string): Task {
  return requireTask(db, id);
}

export function createTask(db: DatabaseSync, input: CreateTaskInput): Task {
  assertTeamsExist(db, input.teamIds);
  const now = new Date().toISOString();
  const id = randomUUID();

  return inTransaction(db, () => {
    insertTask(db, {
      id,
      title: input.title,
      description: emptyToNull(input.description),
      status: input.status ?? "pendente",
      dueDate: emptyToNull(input.dueDate),
      teamIds: input.teamIds,
      createdAt: now,
      updatedAt: now,
    });
    replaceTaskTeams(db, id, input.teamIds);
    return requireTask(db, id);
  });
}

export function editTask(db: DatabaseSync, id: string, input: UpdateTaskInput): Task {
  requireTask(db, id);
  if (input.teamIds) {
    assertTeamsExist(db, input.teamIds);
  }

  return inTransaction(db, () => {
    updateTaskRow(db, {
      id,
      ...(input.title === undefined ? {} : { title: input.title }),
      ...(input.description === undefined ? {} : { description: emptyToNull(input.description) }),
      ...(input.status === undefined ? {} : { status: input.status }),
      ...(input.dueDate === undefined ? {} : { dueDate: emptyToNull(input.dueDate) }),
      ...(input.teamIds === undefined ? {} : { teamIds: input.teamIds }),
      updatedAt: new Date().toISOString(),
    });
    return requireTask(db, id);
  });
}

export function removeTask(db: DatabaseSync, id: string): void {
  requireTask(db, id);
  deleteTaskRow(db, id);
}

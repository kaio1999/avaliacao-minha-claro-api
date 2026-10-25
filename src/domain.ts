export const taskStatuses = ["pendente", "em_progresso", "concluida"] as const;

export type TaskStatus = (typeof taskStatuses)[number];

export const taskSorts = [
  "createdAt:desc",
  "createdAt:asc",
  "title:asc",
  "title:desc",
  "dueDate:asc",
  "dueDate:desc",
  "status:asc",
  "status:desc",
] as const;

export type TaskSort = (typeof taskSorts)[number];

export type Team = {
  id: string;
  name: string;
  colorHex: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskTeam = {
  id: string;
  name: string;
  colorHex: string;
};

export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueDate: string | null;
  teams: TaskTeam[];
  createdAt: string;
  updatedAt: string;
};

export type PageMeta = {
  total: number;
  limit: number;
  offset: number;
};

export function isTaskStatus(value: string): value is TaskStatus {
  return value === "pendente" || value === "em_progresso" || value === "concluida";
}

export class DomainError extends Error {
  readonly code: "NOT_FOUND" | "VALIDATION_ERROR";
  readonly details?: unknown;

  constructor(code: "NOT_FOUND" | "VALIDATION_ERROR", message: string, details?: unknown) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.details = details;
  }
}

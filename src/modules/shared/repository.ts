import type { DatabaseSync } from "node:sqlite";

import { isTaskStatus, type Task, type TaskSort, type TaskStatus, type TaskTeam, type Team } from "../../domain";
import { toLikePattern } from "../../shared/like";

type TeamRow = {
  id: string;
  name: string;
  color_hex: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

type TaskTeamRow = {
  task_id: string;
  id: string;
  name: string;
  color_hex: string;
};

export type NewTeam = {
  id: string;
  name: string;
  colorHex: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NewTask = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueDate: string | null;
  teamIds: readonly string[];
  createdAt: string;
  updatedAt: string;
};

export type TaskPatch = {
  id: string;
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  dueDate?: string | null;
  teamIds?: readonly string[];
  updatedAt: string;
};

const taskSortSql: Record<TaskSort, string> = {
  "createdAt:desc": "t.created_at DESC",
  "createdAt:asc": "t.created_at ASC",
  "title:asc": "t.title COLLATE NOCASE ASC",
  "title:desc": "t.title COLLATE NOCASE DESC",
  "dueDate:asc": "t.due_date IS NULL, t.due_date ASC",
  "dueDate:desc": "t.due_date IS NULL, t.due_date DESC",
  "status:asc":
    "CASE t.status WHEN 'pendente' THEN 1 WHEN 'em_progresso' THEN 2 WHEN 'concluida' THEN 3 ELSE 4 END ASC",
  "status:desc":
    "CASE t.status WHEN 'pendente' THEN 1 WHEN 'em_progresso' THEN 2 WHEN 'concluida' THEN 3 ELSE 4 END DESC",
};

export function inTransaction<T>(db: DatabaseSync, run: () => T): T {
  db.exec("BEGIN");
  try {
    const result = run();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function mapTeam(row: TeamRow): Team {
  return {
    id: row.id,
    name: row.name,
    colorHex: row.color_hex,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTask(row: TaskRow, teams: TaskTeam[]): Task {
  if (!isTaskStatus(row.status)) {
    throw new Error(`Status inválido no banco: ${row.status}`);
  }

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    dueDate: row.due_date,
    teams,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function countTeams(db: DatabaseSync): number {
  const row = db.prepare("SELECT COUNT(*) AS total FROM teams").get() as { total: number } | undefined;
  return Number(row?.total ?? 0);
}

export function insertTeam(db: DatabaseSync, team: NewTeam): void {
  db.prepare(
    `INSERT INTO teams (id, name, color_hex, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(team.id, team.name, team.colorHex, team.description, team.createdAt, team.updatedAt);
}

export function findTeam(db: DatabaseSync, id: string): Team | null {
  const row = db.prepare("SELECT * FROM teams WHERE id = ?").get(id) as TeamRow | undefined;
  return row ? mapTeam(row) : null;
}

export function findExistingTeamIds(db: DatabaseSync, ids: readonly string[]): string[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(", ");
  const rows = db
    .prepare(`SELECT id FROM teams WHERE id IN (${placeholders})`)
    .all(...ids) as Array<{ id: string }>;
  return rows.map((row) => row.id);
}

export function listTeams(
  db: DatabaseSync,
  query: { search?: string; limit: number; offset: number },
): { items: Team[]; total: number } {
  const filters: string[] = [];
  const params: string[] = [];

  if (query.search) {
    const pattern = toLikePattern(query.search);
    filters.push(`(name LIKE ? ESCAPE '\\' OR COALESCE(description, '') LIKE ? ESCAPE '\\')`);
    params.push(pattern, pattern);
  }

  const where = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
  const totalRow = db
    .prepare(`SELECT COUNT(*) AS total FROM teams ${where}`)
    .get(...params) as { total: number };
  const rows = db
    .prepare(
      `SELECT * FROM teams ${where} ORDER BY name COLLATE NOCASE ASC LIMIT ? OFFSET ?`,
    )
    .all(...params, query.limit, query.offset) as TeamRow[];

  return {
    total: Number(totalRow.total),
    items: rows.map(mapTeam),
  };
}

export function updateTeam(
  db: DatabaseSync,
  patch: {
    id: string;
    name?: string;
    colorHex?: string;
    description?: string | null;
    updatedAt: string;
  },
): void {
  const assignments = ["updated_at = ?"];
  const values: Array<string | null> = [patch.updatedAt];

  if (patch.name !== undefined) {
    assignments.push("name = ?");
    values.push(patch.name);
  }
  if (patch.colorHex !== undefined) {
    assignments.push("color_hex = ?");
    values.push(patch.colorHex);
  }
  if (patch.description !== undefined) {
    assignments.push("description = ?");
    values.push(patch.description);
  }

  values.push(patch.id);
  db.prepare(`UPDATE teams SET ${assignments.join(", ")} WHERE id = ?`).run(...values);
}

export function deleteTeamRow(db: DatabaseSync, id: string): number {
  return Number(db.prepare("DELETE FROM teams WHERE id = ?").run(id).changes);
}

export function insertTask(db: DatabaseSync, task: NewTask): void {
  db.prepare(
    `INSERT INTO tasks (id, title, description, status, due_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    task.id,
    task.title,
    task.description,
    task.status,
    task.dueDate,
    task.createdAt,
    task.updatedAt,
  );
}

export function replaceTaskTeams(db: DatabaseSync, taskId: string, teamIds: readonly string[]): void {
  db.prepare("DELETE FROM task_teams WHERE task_id = ?").run(taskId);
  const insert = db.prepare("INSERT INTO task_teams (task_id, team_id) VALUES (?, ?)");
  for (const teamId of teamIds) {
    insert.run(taskId, teamId);
  }
}

function teamsByTask(db: DatabaseSync, taskIds: readonly string[]): Map<string, TaskTeam[]> {
  const grouped = new Map<string, TaskTeam[]>();
  if (taskIds.length === 0) return grouped;

  const placeholders = taskIds.map(() => "?").join(", ");
  const rows = db
    .prepare(
      `SELECT tt.task_id, tm.id, tm.name, tm.color_hex
       FROM task_teams tt
       JOIN teams tm ON tm.id = tt.team_id
       WHERE tt.task_id IN (${placeholders})
       ORDER BY tm.name COLLATE NOCASE ASC`,
    )
    .all(...taskIds) as TaskTeamRow[];

  for (const row of rows) {
    const current = grouped.get(row.task_id) ?? [];
    current.push({ id: row.id, name: row.name, colorHex: row.color_hex });
    grouped.set(row.task_id, current);
  }

  return grouped;
}

export function findTask(db: DatabaseSync, id: string): Task | null {
  const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as TaskRow | undefined;
  if (!row) return null;
  const teams = teamsByTask(db, [id]).get(id) ?? [];
  return mapTask(row, teams);
}

export function listTasks(
  db: DatabaseSync,
  query: {
    teamId?: string;
    status?: TaskStatus;
    search?: string;
    sort: TaskSort;
    limit: number;
    offset: number;
  },
): { items: Task[]; total: number } {
  const filters: string[] = [];
  const params: string[] = [];

  if (query.status) {
    filters.push("t.status = ?");
    params.push(query.status);
  }
  if (query.teamId) {
    filters.push(
      "EXISTS (SELECT 1 FROM task_teams tt WHERE tt.task_id = t.id AND tt.team_id = ?)",
    );
    params.push(query.teamId);
  }
  if (query.search) {
    const pattern = toLikePattern(query.search);
    filters.push(
      `(t.title LIKE ? ESCAPE '\\'
        OR COALESCE(t.description, '') LIKE ? ESCAPE '\\'
        OR EXISTS (
          SELECT 1
          FROM task_teams tt
          JOIN teams tm ON tm.id = tt.team_id
          WHERE tt.task_id = t.id AND tm.name LIKE ? ESCAPE '\\'
        ))`,
    );
    params.push(pattern, pattern, pattern);
  }

  const where = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
  const orderBy = taskSortSql[query.sort];
  const totalRow = db
    .prepare(`SELECT COUNT(*) AS total FROM tasks t ${where}`)
    .get(...params) as { total: number };
  const rows = db
    .prepare(
      `SELECT t.*
       FROM tasks t
       ${where}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
    )
    .all(...params, query.limit, query.offset) as TaskRow[];
  const grouped = teamsByTask(
    db,
    rows.map((row) => row.id),
  );

  return {
    total: Number(totalRow.total),
    items: rows.map((row) => mapTask(row, grouped.get(row.id) ?? [])),
  };
}

export function updateTaskRow(db: DatabaseSync, patch: TaskPatch): void {
  const assignments = ["updated_at = ?"];
  const values: Array<string | null> = [patch.updatedAt];

  if (patch.title !== undefined) {
    assignments.push("title = ?");
    values.push(patch.title);
  }
  if (patch.description !== undefined) {
    assignments.push("description = ?");
    values.push(patch.description);
  }
  if (patch.status !== undefined) {
    assignments.push("status = ?");
    values.push(patch.status);
  }
  if (patch.dueDate !== undefined) {
    assignments.push("due_date = ?");
    values.push(patch.dueDate);
  }

  values.push(patch.id);
  db.prepare(`UPDATE tasks SET ${assignments.join(", ")} WHERE id = ?`).run(...values);
  if (patch.teamIds) {
    replaceTaskTeams(db, patch.id, patch.teamIds);
  }
}

export function deleteTaskRow(db: DatabaseSync, id: string): number {
  return Number(db.prepare("DELETE FROM tasks WHERE id = ?").run(id).changes);
}

export function countTasks(db: DatabaseSync): number {
  const row = db.prepare("SELECT COUNT(*) AS total FROM tasks").get() as { total: number } | undefined;
  return Number(row?.total ?? 0);
}

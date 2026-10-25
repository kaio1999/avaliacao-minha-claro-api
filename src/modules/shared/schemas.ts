import { z } from "zod";

import { taskSorts, taskStatuses } from "../../domain";
import { isIsoDate } from "../../shared/date";

const colorHexSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, "A cor precisa estar no formato #RRGGBB");

const descriptionSchema = z.string().trim().max(2000).nullable().optional();

const dueDateSchema = z
  .string()
  .trim()
  .refine((value) => value.length === 0 || isIsoDate(value), "Data inválida. Use AAAA-MM-DD")
  .nullable()
  .optional();

const teamIdsSchema = z
  .array(z.string().uuid("Time inválido"))
  .max(20)
  .transform((ids) => [...new Set(ids)]);

export const idParamsSchema = z.object({
  id: z.string().uuid("Identificador inválido"),
});

export const listTeamsQuerySchema = z.object({
  search: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const createTeamSchema = z.object({
  name: z.string().trim().min(3, "O nome precisa ter pelo menos 3 caracteres").max(80),
  colorHex: colorHexSchema,
  description: descriptionSchema,
});

export const updateTeamSchema = z
  .object({
    name: z.string().trim().min(3, "O nome precisa ter pelo menos 3 caracteres").max(80).optional(),
    colorHex: colorHexSchema.optional(),
    description: descriptionSchema,
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "Informe ao menos um campo",
  });

export const listTasksQuerySchema = z.object({
  teamId: z.string().uuid("Time inválido").optional(),
  status: z.enum(taskStatuses).optional(),
  search: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.enum(taskSorts).default("createdAt:desc"),
});

export const createTaskSchema = z.object({
  title: z.string().trim().min(3, "O título precisa ter pelo menos 3 caracteres").max(120),
  description: descriptionSchema,
  status: z.enum(taskStatuses).optional(),
  dueDate: dueDateSchema,
  teamIds: teamIdsSchema.optional().default([]),
});

export const updateTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, "O título precisa ter pelo menos 3 caracteres")
      .max(120)
      .optional(),
    description: descriptionSchema,
    status: z.enum(taskStatuses).optional(),
    dueDate: dueDateSchema,
    teamIds: teamIdsSchema.optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "Informe ao menos um campo",
  });

import type { ZodType } from "zod";
import { z } from "zod";

import { HttpError } from "./http-error";

export function parse<Schema extends ZodType>(schema: Schema, value: unknown): z.output<Schema> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new HttpError(400, "VALIDATION_ERROR", "Requisição inválida", result.error.flatten());
  }
  return result.data;
}

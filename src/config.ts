import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readPort(raw = process.env.PORT ?? "3333"): number {
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT inválida: ${raw}`);
  }
  return port;
}

export const config = {
  port: readPort(),
  databasePath: process.env.DATABASE_PATH
    ? resolve(process.env.DATABASE_PATH)
    : resolve(root, "data", "app.db"),
};

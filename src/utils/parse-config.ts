import fs from "fs-extra";
import { extname, join } from "node:path";
import { CLIError } from "@oclif/errors";
import { parseTransformer, Transformer } from "./parse-transformer";
import { Logger } from "./logger";

export interface Column {
  name: string;
  replacement?: string;
}

export interface Output {
  type: string;
  path?: string;
  stream: any // WriteStream
}

export interface Config {
  skip: string[],
  columns: Column[];
  transformer?: Transformer;
  output?: Output;
  preserveNull?: boolean,
  locale?: string;
}

const logger = new Logger();

export async function parseConfig(path?: string): Promise<Config> {
  if (!path) {
    return {
      skip: [],
      columns: [],
      output: { type: "unknown" } as Output,
    };
  }

  console.log("Loading configuration...");
  console.log("");

  if (!fs.existsSync(path)) {
    throw new CLIError(`No configuration file found at "${path}"`);
  }

  const contents = await loadConfig(path);

  if (!contents) {
    throw new CLIError(`Failed to load configuration at "${path}"`);
  }

  const columns = parseColumns(contents.columns);
  const transformer = await parseTransformer(contents.transformer);

  return {
    columns,
    transformer,
    skip: contents.skip ?? [],
    output: parseOutput(contents.output),
    locale: contents.fakerLocale,
  };
}

async function loadConfig(path: string): Promise<any> {
  const type = extname(path);

  if (type === ".js") {
    // eslint-disable-next-line unicorn/prefer-module
    return require(join(process.cwd(), path));
  }

  if (type === ".json") {
    return fs.readJson(path);
  }

  const contents = await fs.readFile(path, "utf-8");

  // This is here to support the legacy config
  return {
    columns: contents.split(/\r?\n/),
  };
}

export function parseColumns(columns: string[] | Record<string, string>): Column[] {
  if (Array.isArray(columns)) {
    return columns.map(column => parseColumn(column)).filter(Boolean) as Column[];
  }

  return Object.entries(columns).map(([name, value]) => parseColumn(`${name}:${value}`)).filter(Boolean) as Column[];
}

export function parseColumn(column: string): Column | null {
  if (!column || column.startsWith("#")) {
    return null;
  }

  const [name, replacement] = column.trim().split(":");

  return {
    name: name.trim().toLowerCase(),
    replacement: replacement?.trim(),
  };
}

export function parseOutput(output: string): Output | undefined {
  if (!output) {
    return undefined;
  }

  if (output === "-") {
    const stream = process.stdout;
    (stream as any)._handle.setBlocking(true);

    return {
      type: "stdout",
      stream,
    };
  }

  const stream = fs.createWriteStream(output);

  return {
    type: "file",
    path: output,
    stream,
  };
}

export function printConfig(config: Config): void {
  const { columns, skip, locale, output } = config;

  if (columns.length > 0) {
    logger.info("Columns:", columns.map(c => c.replacement ? `${c.name} [${c.replacement}]` : c.name).join(", "));
  }

  if (skip.length > 0) {
    logger.info("Skipping:", skip.join(", "));
  }

  if (locale) {
    logger.info(`Faker Locale: ${locale}`);
  }

  logger.info("Output:", output?.path ?? output?.type);
}

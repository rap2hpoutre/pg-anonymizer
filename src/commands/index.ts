import { Args, Command, Flags } from "@oclif/core";
import { CLIError } from "@oclif/errors";
import { spawn } from "node:child_process";
import readline from "node:readline";
import faker from "faker";
import chalk from "chalk";
import pluralize from "pluralize";

import { sanitizePgDumpArgs } from "../utils/sanitize-pg-dump-args";
import { Logger } from "../utils/logger";
import { Config, parseColumns, parseConfig, parseOutput, printConfig } from "../utils/parse-config";
import { parseTransformer } from "../utils/parse-transformer";
import { parseLine, parseTable, Table } from "../utils/parse-line";

function dieAndLog(message: string, error: any) {
  console.error(message);

  throw new CLIError(error);
}

const logger = new Logger();

export default class PgAnonymizer extends Command {
  static description = "dump anonymized database"

  static strict = false

  static usage = "[OPTIONS] [--] [PGARG]..."

  // Named args aren't actually used; this exists for documentation purposes
  static args = {
    PGARG: Args.string({
      description:
        "arguments to pass through to pg_dump, e.g. connection string (`postgresql://user:secret@localhost:1234/mybase`) or options (`--data-only`, `-n myschema`)",
      required: false,
    }),
  }

  static flags = {
    version: Flags.version({ char: "v" }),
    help: Flags.help({ char: "h" }),
    columns: Flags.string({
      char: "c",
      description: "list of columns to anonymize",
      default:
        "email,name,description,address,city,country,phone,comment,birthdate",
      aliases: ["list", "l"],
      deprecateAliases: true,
    }),
    skip: Flags.string({
      char: "s",
      description: "specify tables to skip",
      parse: async input => input.replace(/"/g, ""),
    }),
    config: Flags.string({
      description: "optional path to a config file with list of columns to anonymize",
      aliases: ["configFile"],
      deprecateAliases: true,
    }),
    transformer: Flags.string({
      char: "t",
      description: "the path to your transformer module",
      aliases: ["extension", "e"],
      deprecateAliases: true,
    }),
    output: Flags.string({
      char: "o",
      description: "output file",
      default: "output.sql",
    }),
    "faker-locale": Flags.string({
      char: "f",
      description: "faker locale (e.g: en, fr, de)",
      aliases: ["fakerLocale"],
      deprecateAliases: true,
    }),
    "preserve-null": Flags.boolean({
      char: "n",
      description: "preserve NULL values",
      default: false,
    }),
    pgDumpOutputMemory: Flags.string({
      char: "m",
      description:
        "Obsolete, not needed any more: max memory used to get output from pg_dump in MB",
      deprecated: true,
    }),
    verbose: Flags.boolean({
      char: "v",
      description: "output extra logging",
    }),
  }

  async run(): Promise<void> {
    const { argv, flags, args } = await this.parse(PgAnonymizer);

    if (flags.verbose) {
      console.trace({ args, flags, argv });
    }

    if (flags["faker-locale"]) {
      faker.locale = flags["faker-locale"];
    }

    const config: Config = await parseConfig(flags.config);

    if (flags.columns) {
      config.columns = parseColumns(flags.columns.split(","));
    }

    if (flags.transformer) {
      config.transformer = await parseTransformer(flags.transformer);
    }

    if (flags.skip) {
      config.skip = flags.skip.split(",").map(t => t.toLowerCase().trim());
    }

    if (flags.output) {
      config.output = parseOutput(flags.output);
    }

    if (flags["preserve-null"]) {
      config.preserveNull = flags["preserve-null"];
    }

    if (flags["faker-locale"]) {
      logger.info(`Faker Locale: ${flags["faker-locale"]}`);
    }

    if (!config.output) {
      throw new CLIError("No output configuration provided");
    }

    printConfig(config);

    sanitizePgDumpArgs(argv as string[]);

    logger.log("");
    logger.log("Launching pg_dump...");

    const pg = spawn("pg_dump", argv as string[]);

    pg.on("exit", function (code) {
      if (code !== 0) {
        throw new CLIError(`pg_dump command failed with exit code ${code}`, { exit: code ?? undefined });
      }
    });

    pg.stderr.on("data", function (data) {
      throw new CLIError(`pg_dump command error: ${data.toString()}`);
    });

    pg.stdout.setEncoding("utf8");

    logger.log("Command pg_dump started, running anonymization.");

    const inputLineResults = readline.createInterface({
      input: pg.stdout,
      crlfDelay: Number.POSITIVE_INFINITY,
    }) as any as Iterable<string>;

    let table: Table | null = null;

    function process(line: string): void | string {
      if (/^COPY .* FROM stdin;$/.test(line)) {
        logger.log("");

        table = parseTable(line, config);

        if (config.skip.includes(table.name.toLowerCase())) {
          logger.log("Skipping... excluded by user");
          return;
        }

        if (!table.transform) {
          logger.log("Skipping... no matching columns");
          return;
        }

        const { length } = table.columns.filter(c => c.transform);

        logger.log(`Anonymizing ${chalk.yellow(length)} ${pluralize("column", length)}...`);
        return;
      }

      if (table && table.transform && line.trim() && line !== "\\.") {
        return parseLine(line, table, config);
      }

      table = null;
    }

    for await (const line of inputLineResults) {
      const result = process(line) ?? line;

      try {
        config.output.stream.write(result + "\n");
      } catch (error) {
        dieAndLog("Failed to write file", error);
      }
    }
  }
}

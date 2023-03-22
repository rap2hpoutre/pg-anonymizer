import { Args, Command, Flags } from "@oclif/core";
import { CLIError } from "@oclif/errors";
import { spawn } from "node:child_process";
import fs from "fs-extra";
import path from "node:path";
import readline from "node:readline";
import faker from "faker";
import chalk from "chalk";
import pluralize from "pluralize";

import { sanitizePgDumpArgs } from "../utils/sanitize-pg-dump-args";
import { Logger } from "../utils/logger";
import { postgresSqlDate } from "../utils/postgres-sql-date";

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

    let transformer: any | null = null;

    if (flags.transformer) {
      const p = path.join(process.cwd(), flags.transformer);

      logger.info(`Transformer: ${p}`);

      if (!fs.existsSync(p)) {
        throw new CLIError(`Unable to find transformer module at ${p}`);
      }

      // eslint-disable-next-line unicorn/prefer-module
      transformer = require(p);
    }

    const useRowTransformer = transformer && typeof transformer.row === "function";

    let columns: { col: string; replacement: string | null }[] = [];

    if (flags.config) {
      if (!fs.existsSync(flags.config)) {
        throw new CLIError(`No configuration file found at "${flags.config}"`);
      }

      columns = fs
        .readFileSync(flags.config, "utf8")
        .split(/\r?\n/)
        .map(line => line.trim())
        .map(line => {
          if (line === "" || line.startsWith("#")) {
            return null as never; // casting to never, as they're filtered out below
          }

          return {
            col: line.replace(/:.*$/, "").toLowerCase(),
            replacement: line.includes(":") ? line.replace(/^.*:/, "") : null,
          };
        })
        .filter(Boolean);
    } else {
      columns = flags.columns.split(",").map((l: string) => {
        return {
          col: l.replace(/:.*$/, "").toLowerCase(),
          replacement: l.includes(":") ? l.replace(/^.*:/, "") : null,
        };
      });
    }

    logger.info("Columns:", columns.map(c => {
      if (c.replacement) {
        return `${c.col} [${c.replacement}]`;
      }

      return c.col;
    }).join(", "));

    const skip = [];

    if (flags.skip) {
      const tables = flags.skip
        .split(",")
        .map(t => t.toLowerCase().trim());

      skip.push(...tables);

      logger.info("Skipping:", tables.join(", "));
    }

    let table: string | null = null;
    let cols: { name: string; transform: boolean; replacement?: string | null; }[] = [];

    let out: any;

    if (flags["faker-locale"]) {
      logger.info(`Faker Locale: ${flags["faker-locale"]}`);
    }

    if (flags.output === "-") {
      out = process.stdout;
      out._handle.setBlocking(true);

      logger.info("Output to stdout");
    } else {
      out = fs.createWriteStream(flags.output);

      logger.info("Output file: " + flags.output);
    }

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

    for await (let line of inputLineResults) {
      if (/^COPY .* FROM stdin;$/.test(line)) {
        logger.log("");

        table = line.replace(/^COPY (.*?) .*$/, "$1").replace(/"/g, "");

        cols = line
          .replace(/^COPY .*? \((.*)\).*$/, "$1")
          .split(",")
          .map(name => name.trim())
          .map(name => name.replace(/"/g, ""))
          .map(name => name.toLowerCase())
          .map(name => {
            const transform = columns.find(c => c.col === name || c.col === `${table}.${name}`);

            return {
              name,
              transform: Boolean(transform),
              replacement: transform?.replacement,
            };
          });

        const print = cols
          .map(col => (col.transform ? chalk.yellow(`[${col.name}]`) : col.name))
          .join(", ");

        logger.log(chalk`{blueBright ${table}}: ${print}`);

        if (skip.includes(table.toLowerCase())) {
          logger.log("Skipping... excluded by user");
        } else if (cols.every(c => !c.transform)) {
          logger.log("Skipping... no matching columns");
        } else {
          const { length } = cols.filter(c => c.transform);
          logger.log(`Anonymizing ${chalk.yellow(length)} ${pluralize("column", length)}...`);
        }
      } else if (table && line.trim() && line !== "\\.") {
        // Skip if specified, or there's no columns to anonymize
        if (!skip.includes(table.toLowerCase()) && cols.some(c => c.transform)) {
          const values = line.split("\t");

          let overrides: any | undefined;

          if (useRowTransformer) {
            const entries = values.map((value, index) => [cols[index].name, value]);

            const data = Object.fromEntries(entries);

            overrides = transformer!.tables?.[table]?.(data);
          }

          line = values.map((value, index) => {
            const column = cols[index];

            if (!column) {
              return value;
            }

            const { name, replacement, transform } = column;

            if (overrides?.[name]) {
              return overrides[name];
            }

            if (!transform) {
              return value;
            }

            if (flags["preserve-null"] && value === "\\N") {
              return value;
            }

            if (!replacement) {
              switch (name) {
              case "email": return faker.internet.email();
              case "name": return faker.name.findName();
              case "firstName": return faker.name.firstName();
              case "lastName": return faker.name.lastName();
              case "address": return faker.address.streetAddress();
              case "city": return faker.address.city();
              case "country": return faker.address.country();
              case "phone": return faker.phone.phoneNumber();
              case "comment": return faker.random.words(3);
              case "birthdate": return postgresSqlDate(faker.date.past());
              default: return faker.random.word();
              }
            }

            const [type, method] = replacement.split(/\.(.*)/s);

            if (type === "faker") {
              const [two, three] = method.split(".") as [keyof Faker.FakerStatic,  string  ];

              if (!two || !three) {
                throw new CLIError(`No faker function found for ${replacement}`);
              }

              const fn = (faker[two] as any)?.[three];

              if (typeof fn !== "function") {
                throw new CLIError(`${replacement} is not a function`);
              }

              const v = fn();

              if (two === "date") {
                return postgresSqlDate(v);
              }

              return v;
            }

            if ((type === "transformer" || type === "extension") && transformer) {
              const fn = transformer[method];

              if (typeof fn === "function") {
                return fn(value, table);
              }
            }

            return replacement;
          })
            .join("\t");
        }
      } else {
        table = null;
        cols = [];
      }

      try {
        out.write(line + "\n");
      } catch (error) {
        dieAndLog("Failed to write file", error);
      }
    }
  }
}

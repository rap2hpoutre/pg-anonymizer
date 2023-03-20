import { Command, flags } from "@oclif/command";
import { spawn } from "child_process";
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { Input } from "@oclif/parser";
import faker from 'faker';
import chalk from 'chalk';
import pluralize from 'pluralize';

function dieAndLog(message: string, error: any) {
  console.error(message);
  console.error(error);
  process.exit(1);
}

function postgreSQLDate(date: Date) {
  return date.toISOString().replace(/T/, " ").replace(/\..+/, "");
}

// These arguments, if passed through to pg_dump, will break pg-anonymizer.
const pgDumpArgsBlacklist = ["-f", "--file", "-F", "--format", "-V", "--version", "-?", "--help"];

function sanitizePgDumpArgs(argv: string[]) {
  const isBlacklist = (arg: string) => {
    for (const blacklistArg of pgDumpArgsBlacklist) {
      if ((blacklistArg.startsWith("--") && arg.startsWith(blacklistArg)) || arg === blacklistArg) {
        return true;
      }
    }
    return false;
  }

  const invalidArgs = argv.filter(isBlacklist);
  if (invalidArgs && invalidArgs.length) {
    console.error("Illegal arguments to pg_dump: " + invalidArgs.join(", "));
    process.exit(1);
  }
}

const log = {
  info: (...args: unknown[]) => console.log(chalk.grey(...args)),
  status: console.log
}

class PgAnonymizer extends Command {
  static description = "dump anonymized database";

  static strict = false;

  static usage = "[OPTIONS] [--] [PGARG]...";

  // Named args aren't actually used; this exists for documentation purposes
  static args = [
    {
      name: "PGARG",
      description:
        "arguments to pass through to pg_dump, e.g. connection string (`postgresql://user:secret@localhost:1234/mybase`) or options (`--data-only`, `-n myschema`)",
      required: false,
    },
  ];

  static flags: flags.Input<any> = {
    version: flags.version({ char: "v" }),
    help: flags.help({ char: "h" }),
    list: flags.string({
      char: "l",
      description: "list of columns to anonymize",
      default: "email,name,description,address,city,country,phone,comment,birthdate"
    }),
    skip: flags.string({
      char: "s",
      description: "specify tables to skip",
    }),
    configFile: flags.string({
      char: "c",
      description: "config file with list of columns to anonymize",
    }),
    extension: flags.string({
      char: "e",
      description: "the path to your extension module",
    }),
    output: flags.string({
      char: "o",
      description: "output file",
      default: "output.sql",
    }),
    fakerLocale: flags.string({
      char: "f",
      description: "faker locale (e.g: en, fr, de)",
    }),
    'preserve-null': flags.boolean({
      char: "n",
      description: "preserve NULL values",
      default: false
    }),
    pgDumpOutputMemory: flags.string({
      char: "m",
      description:
        "Obsolete, not needed any more: max memory used to get output from pg_dump in MB",
    }),
  };

  async run() {
    const { argv, flags } = this.parse(<Input<any>>PgAnonymizer);

    if (flags.fakerLocale) {
      faker.locale = flags.fakerLocale;
    }

    const extension = flags.extension
      ? require(path.join(process.cwd(), flags.extension))
      : null;

    if (!(flags.list || flags.configFile)) {
      flags.list = "email,name,description,address,city,country,phone,comment,birthdate";
    }

    let list: { col: string; replacement: string | null; }[] = [];
    if (flags.configFile) {
      list = fs.readFileSync(flags.configFile, "utf8")
        .split(/\r?\n/)
        .map((l: string) => l.trim())
        .map((l: string) => {
          if (l === "") return null as never; // casting to never, as they're filtered out below
          if (l.startsWith("#")) return null as never; // casting to never, as they're filtered out below
          return {
            col: l.replace(/:(?:.*)$/, "").toLowerCase(),
            replacement: l.includes(":") ? l.replace(/^(?:.*):/, "") : null
          };
        })
        .filter(Boolean);
    } else if (flags.list) {
      list = flags.list.split(",").map((l: string) => {
        return {
          col: l.replace(/:(?:.*)$/, "").toLowerCase(),
          replacement: l.includes(":") ? l.replace(/^(?:.*):/, "") : null,
        };
      });
    }

    log.info("List:", list.map(c => c.col).join(", "))

    const skip = [];

    if (flags.skip) {
      const tables = flags.skip.split(",").map((t: string) => t.toLowerCase().trim())
      skip.push(...tables)

      log.info("Skipping:", tables.join(", "))
    }

    let table: string | null = null;
    let indices: Number[] = [];
    let cols: string[] = [];

    let out: any;

    if (flags.output === "-") {
      out = process.stdout;
      out._handle.setBlocking(true);
      log.info("Output to stdout");
    } else {
      out = fs.createWriteStream(flags.output);
      log.info("Output file: " + flags.output);
    }


    sanitizePgDumpArgs(argv);

    log.status()
    log.status("Launching pg_dump...");

    const pg = spawn("pg_dump", argv);

    pg.on("exit", function (code) {
      if (code != 0) {
        dieAndLog("pg_dump command failed with exit code", code);
      }
    });
    pg.stderr.on("data", function (data) {
      dieAndLog("pg_dump command error:", data.toString());
    });
    pg.stdout.setEncoding("utf8");

    log.status("Command pg_dump started, running anonymization.");

    const inputLineResults = readline.createInterface({
      input: pg.stdout,
      crlfDelay: Infinity,
    }) as any as Iterable<String>;

    for await (let line of inputLineResults) {
      if (line.match(/^COPY .* FROM stdin;$/)) {
        log.info()

        table = line.replace(/^COPY (.*?) .*$/, "$1");

        cols = line
          .replace(/^COPY (?:.*?) \((.*)\).*$/, "$1")
          .split(",")
          .map((e) => e.trim())
          .map((e) => e.replace(/"/g, ""))
          .map((e) => e.toLowerCase());

        indices = cols.reduce((acc: Number[], value, key) => {
          if (list.find((l: any) => l.col === value)) acc.push(key);
          else if (list.find((l: any) => l.col === table + "." + value))
            acc.push(key);
          return acc;
        }, []);

        log.status(chalk`{blueBright ${table}}:`, cols.map((c, i) => indices.includes(i) ? chalk.yellow(`[${c}]`) : c).join(", "))

        if (skip.includes(table.toLowerCase())) {
          log.status(`Skipping... excluded by user`);
        } else if (!indices.length) {
          log.status(`Skipping... no matching columns`)
        } else {
          log.status(`Anonymizing ${chalk.yellow(indices.length)} ${pluralize('column', indices.length)}...`);
        }
      } else if (table && line.trim() && (line !== "\\.")) {
        // Skip if specified, or there's no columns to anonymize
        if (!skip.includes(table.toLowerCase()) && indices.length) {
          line = line
            .split("\t")
            .map((v, k) => {
              if (indices.includes(k)) {
                if (flags['preserve-null'] && v === "\\N") {
                  return v
                }

                let replacement = list.find(
                  (l: any) => l.col === cols[k]
                )?.replacement;
                if (!replacement) {
                  replacement = list.find(
                    (l: any) => l.col === table + "." + cols[k]
                  )?.replacement;
                }
                if (replacement) {
                  if (replacement.startsWith("faker.")) {
                    const [, two, three] = replacement.split(".") as ["faker", keyof Faker.FakerStatic, string];
                    if (!(two && three)) return replacement;

                    const fn = (faker[two] as any)[three];

                    if (two === "date") return postgreSQLDate(fn())

                    return fn();
                  }
                  if (replacement.startsWith("extension.")) {
                    const functionPath = replacement.split(".");
                    return functionPath.reduce((acc: any, key: any) => {
                      if (acc[key]) {
                        return acc[key];
                      }
                      return acc;
                    }, extension)(v, table);
                  }
                  return replacement;
                }
                if (cols[k] === "email") return faker.internet.email();
                if (cols[k] === "name") return faker.name.findName();
                if (cols[k] === "description") return faker.random.words(3);
                if (cols[k] === "address") return faker.address.streetAddress();
                if (cols[k] === "city") return faker.address.city();
                if (cols[k] === "country") return faker.address.country();
                if (cols[k] === "phone") return faker.phone.phoneNumber();
                if (cols[k] === "comment") return faker.random.words(3);
                if (cols[k] === "birthdate")
                  return postgreSQLDate(faker.date.past());
                return faker.random.word();
              }

              return v;
            })
            .join("\t");
        }
      } else {
        table = null;
        indices = [];
        cols = [];
      }
      try {
        out.write(line + "\n");
      } catch (e) {
        dieAndLog("Failed to write file", e);
      }
    }
  }
}

export = PgAnonymizer;

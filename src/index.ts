import { Command, flags } from "@oclif/command";
import { spawn } from "child_process";
const faker = require("faker");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
import { Input } from "@oclif/parser";

function dieAndLog(message: string, error: any) {
  console.error(message);
  console.error(error);
  process.exit(1);
}

function postgreSQLDate(date: Date) {
  return date.toISOString().replace(/T/, " ").replace(/\..+/, "");
}

class PgAnonymizer extends Command {
  static description = "dump anonymized database";

  static args = [
    {
      name: "database",
      description:
        "database connection string, e.g: `postgresql://user:secret@localhost:1234/mybase`",
      required: true,
    },
  ];

  static flags: flags.Input<any> = {
    version: flags.version({ char: "v" }),
    help: flags.help({ char: "h" }),
    list: flags.string({
      char: "l",
      description: "[default: email,name,description,address,city,country,phone,comment,birthdate] list of columns to anonymize",
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
    pgDumpOutputMemory: flags.string({
      char: "m",
      description:
        "Obsolete, not needed any more: max memory used to get output from pg_dump in MB",
    }),
  };

  async run() {
    const { args, flags } = this.parse(<Input<any>>PgAnonymizer);

    if (flags.fakerLocale) {
      faker.locale = flags.fakerLocale;
    }

    const extension = flags.extension
      ? require(path.join(process.cwd(), flags.extension))
      : null;

    console.error("Launching pg_dump");
    const pg = spawn("pg_dump", [args.database]);
    pg.on("exit", function (code) {
      if (code != 0) {
        dieAndLog("pg_dump command failed with exit code", code);
      }
    });
    pg.stderr.on("data", function (data) {
      dieAndLog("pg_dump command error:", data);
    });
    pg.stdout.setEncoding("utf8");

    if (!(flags.list || flags.configFile)) {
      flags.list = "email,name,description,address,city,country,phone,comment,birthdate";
    }

    let list: { col: string; replacement: string | null; }[];
    if (flags.configFile) {
      list = fs.readFileSync(flags.configFile, "utf8")
        .split(/\r?\n/)
        .map((l: string) => l.trim())
        .map((l: string) => {
          if (l === "") return null;
          if (l.startsWith("#")) return null;
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

    let table: string | null = null;
    let indices: Number[] = [];
    let cols: string[] = [];

    console.error("Command pg_dump started, running anonymization.");

    let out: any;
    if (flags.output === "-") {
      out = process.stdout;
      console.error("Output to stdout");
    } else {
      out = fs.createWriteStream(flags.output);
      console.error("Output file: " + flags.output);
    }

    const inputLineResults = readline.createInterface({
      input: pg.stdout,
      crlfDelay: Infinity,
    }) as any as Iterable<String>;

    for await (let line of inputLineResults) {
      if (line.match(/^COPY .* FROM stdin;$/)) {
        table = line.replace(/^COPY (.*?) .*$/, "$1");
        console.error("Anonymizing table " + table);

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

        if (indices.length)
          console.error(
            "Columns to anonymize: " +
              cols.filter((v, k) => indices.includes(k)).join(", ")
          );
        else console.error("No columns to anonymize");
      } else if (table && line.trim() && (line !== "\\.")) {
        line = line
          .split("\t")
          .map((v, k) => {
            if (indices.includes(k)) {
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
                  const [_one, two, three] = replacement.split(".");
                  if (!(two && three)) return replacement;
                  if (two === "date")
                    return postgreSQLDate(faker.date[three]());
                  return faker[two][three]();
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

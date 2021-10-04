import { Command, flags } from "@oclif/command";
import { promisify } from "util";
import { exec } from "child_process";
import { appendFile, createReadStream, writeFile } from "fs-extra";
import * as readline from 'readline'
const faker = require("faker");
const path = require("path");

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

  static flags = {
    version: flags.version({ char: "v" }),
    help: flags.help({ char: "h" }),
    list: flags.string({
      char: "l",
      description: "list of columns to anonymize",
      default:
        "email,name,description,address,city,country,phone,comment,birthdate",
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
    inputFile: flags.string({
      char: "i",
      description: "input file (uses an input file instead of calling pg_dump)",
    }),
    pgDumpOutputMemory: flags.string({
      char: "m",
      description: "max memory used to get output from pg_dump in MB",
      default: "256",
    }),
  };

  async originalDump(db: string, memory: number): Promise<string> {
    const execPromisified = promisify(exec);
    try {
      console.log("Launching pg_dump");
      const { stdout, stderr } = await execPromisified(`pg_dump ${db}`, {
        maxBuffer: memory * 1024 * 1024,
      });
      if (stderr.trim()) {
        dieAndLog("pg_dump command failed.", stderr);
      }
      return stdout;
    } catch (e) {
      dieAndLog("pg_dump command failed. Are you sure it is installed?", e);
    }
    return "";
  }

  async run() {
    const { args, flags } = this.parse(PgAnonymizer);

    if (flags.fakerLocale) {
      faker.locale = flags.fakerLocale;
    }

    const extension = flags.extension
      ? require(path.join(process.cwd(), flags.extension))
      : null;

    let result = '';
    if (!flags.inputFile) {
      console.log('-i flag is required... OLD VERSION OF LOADING THE WHOLE DB INTO MEMORY IS NO LONGER SUPPORTED!!');
      process.exit(1);
      // result = await this.originalDump(
      //   args.database,
      //   Number(flags.pgDumpOutputMemory)
      // );
    }

    const list = flags.list.split(",").map((l) => {
      return {
        col: l.replace(/:(?:.*)$/, "").toLowerCase(),
        replacement: l.includes(":") ? l.replace(/^(?:.*):/, "") : null,
      };
    });

    let table = null;
    let indices: Number[] = [];
    let cols: string[] = [];

    console.log("Starting anonymization.");
    console.log("Output file: " + flags.output);
    await writeFile(flags.output, "");

    const fileStream = createReadStream(flags.inputFile);

    const inputLineResults = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    }) as any as Iterable<String>;

    for await (let line of inputLineResults) {
      // for (let line of result.split("\n")) {
      if (line.match(/^COPY .* FROM stdin;$/)) {
        table = line.replace(/^COPY (.*?) .*$/, "$1");
        console.log("Anonymizing table " + table);

        cols = line
          .replace(/^COPY (?:.*?) \((.*)\).*$/, "$1")
          .split(",")
          .map((e) => e.trim())
          .map((e) => e.replace(/"/g, ""))
          .map((e) => e.toLowerCase());

        indices = cols.reduce((acc: Number[], value, key) => {
          if (list.find((l) => l.col === value)) acc.push(key);
          return acc;
        }, []);

        if (indices.length) 
          console.log(
            "Columns to anonymize: " +
            cols.filter((v, k) => indices.includes(k)).join(", ")
          );
        else console.log("No columns to anonymize");
      } else if (table && line.trim()) {
        line = line
          .split("\t")
          .map((v, k) => {
            if (indices.includes(k)) {
              const replacement = list.find(
                (l) => l.col === cols[k]
              )?.replacement;
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
                  return functionPath.reduce((acc, key) => {
                    if (acc[key]) {
                      return acc[key];
                    }
                    return acc;
                  }, extension)(v);
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
        await appendFile(flags.output, line + "\n");
      } catch (e) {
        dieAndLog("Failed to write file", e);
      }
    }
  }
}

export = PgAnonymizer;

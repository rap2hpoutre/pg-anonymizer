import { CLIError } from "@oclif/errors";
import { Logger } from "./logger";
import { Config } from "./parse-config";
import chalk from "chalk";
import faker from "faker";
import { postgresSqlDate } from "./postgres-sql-date";

export interface Column {
  name: string;
  transform: boolean;
  replacement?: string;
}

export interface Table {
  name: string;
  columns: Column[];
  transform: boolean;
}

const logger = new Logger();

export function parseLine(line: string, table: Table, config: Config): string {
  const values = line.split("\t");

  let overrides: any | undefined;

  if (config.transformer?.supportsTables) {
    const entries = values.map((value, index) => [table.columns[index].name, value]);

    const data = Object.fromEntries(entries);

    overrides = config.transformer!.module.tables?.[table.name]?.(data);
  }

  return values.map((value, index) => {
    const column = table.columns[index];

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

    if (config.preserveNull && value === "\\N") {
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

    if ((type === "transformer" || type === "extension") && config.transformer) {
      const fn = config.transformer.module[method];

      if (typeof fn === "function") {
        return fn(value, table);
      }
    }

    return replacement;
  }).join("\t");
}

export function parseTable(line: string, config: Config): Table {
  const name = line.replace(/^COPY (.*?) .*$/, "$1").replace(/"/g, "");

  const columns = line
    .replace(/^COPY .*? \((.*)\).*$/, "$1")
    .split(",")
    .map(name => name.trim())
    .map(name => name.replace(/"/g, ""))
    .map(name => name.toLowerCase())
    .map(column => {
      const transform = config.columns.find(c => c.name === column || c.name === `${name}.${column}`);

      return {
        name: column,
        transform: Boolean(transform),
        replacement: transform?.replacement,
      };
    });

  const print = columns
    .map(col => (col.transform ? chalk.yellow(`[${col.name}]`) : col.name))
    .join(", ");

  logger.log(chalk`{blueBright ${name}}: ${print}`);

  const skip = config.skip.includes(name.toLowerCase());

  return {
    name,
    columns,
    transform: !skip && columns.some(c => c.transform),
  };
}

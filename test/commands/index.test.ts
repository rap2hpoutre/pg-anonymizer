import { expect, test } from "@oclif/test";
import "dotenv/config";

const url = process.env.DATABASE_URL!;

describe("flags", () => {
  describe("columns", () => {
    const t = test.stdout();

    t.command(args({ columns: ["name"] }))
      .it("anonymizes specified columns", ctx => {
        expect(ctx.stdout).to.contain("Columns: name");
        expect(ctx.stdout).to.match(user(1, "!Bob", "cats")); // name !== Bob
      });

    t.command(args({ columns: ["password"] }))
      .it("anonymizes specified columns", ctx => {
        expect(ctx.stdout).to.contain("Columns: password");
        expect(ctx.stdout).to.match(user(1, "Bob", "!cats")); // password !== cats
      });

    t.command(args())
      .it("supplies default columns", ctx => {
        expect(ctx.stdout).to.contain("Columns: email, name, description, address, city, country, phone, comment, birthdate");
      });

    t.command(args({ columns: ["password:faker.datatype.boolean"] }))
      .it("supports specified faker replacements", ctx => {
        expect(ctx.stdout).to.contain("Columns: password [faker.datatype.boolean]");
        expect(ctx.stdout).to.match(user(1, "Bob", "(true|false)"));
      });

    t.command(args({ columns: ["password:faker.not.a.function"] }))
      .catch("faker.not.a.function is not a function")
      .it("verifies faker replacement methods");
  });

  describe("skip", () => {
    const t = test.stdout();

    t.command(args({ skip: ["user"] }))
      .it("supports skipping tables", ctx => {
        expect(ctx.stdout).to.contain("Skipping: user");
      });

    t.command(args({ skip: ["public.user"] }))
      .it("supports tables with schema", ctx => {
        expect(ctx.stdout).to.contain("Skipping: public.user");
        expect(ctx.stdout).to.match(user(1, "Bob", "cats"));
      });

    t.command(args({ skip: ['public."user"'] }))
      .it("supports tables with quotes", ctx => {
        expect(ctx.stdout).to.contain("Skipping: public.user");
        expect(ctx.stdout).to.match(user(1, "Bob", "cats"));
      });

    t.command(args({ skip: ["public.user"], columns: ["name"] }))
      .it("will skip anonymization even if it contains a column that's specified", ctx => {
        expect(ctx.stdout).to.contain("Columns: name");
        expect(ctx.stdout).to.contain("Skipping: public.user");
        expect(ctx.stdout).to.match(user(1, "Bob", "cats"));
      });
  });

  describe("preserve-null", () => {
    const t = test.stdout();

    t.command(args({ columns: ["empty"] }))
      .it("should not preserve null by default", ctx => {
        expect(ctx.stdout).to.match(user(1, "Bob", "cats", "!" + NULL));
      });

    t.command(args({ columns: ["empty"], "preserve-null": true }))
      .it("should preserve null when specified", ctx => {
        expect(ctx.stdout).to.match(user(1, "Bob", "cats", NULL));
      });
  });

  describe("PGARGS", () => {
    const t = test.stdout();

    t.command([...args(), "--", "--schema-only"])
      .it("should support passing flags to pg_dump", ctx => {
        expect(ctx.stdout).to.contain("ALTER");
        expect(ctx.stdout).not.to.contain("COPY");
      });

    t.command([...args(), "--", "--data-only"])
      .it("should support passing flags to pg_dump", ctx => {
        expect(ctx.stdout).to.contain("COPY");
        expect(ctx.stdout).not.to.contain("ALTER");
      });
  });
});

/**
 * Converts a user into a regex
 * @param id id
 * @param name name
 * @param password password
 * @param empty null
 * @example /1\tBob\t(?!cats)\t\N
 * @return RegExp
 */
function user(id: number | string, name: string, password: string, empty: string = NULL): RegExp {
  const reg = [id, name, password, empty].map(i => {
    const value = String(i);

    if (value.startsWith("!")) {
      return `(?!${value.slice(1)}).*`;
    }

    return value;
  }).join("\t");

  return new RegExp(`^${reg}$`, "m");
}

const NULL = "\\\\N";

function args(args: Record<string, string | string[] | boolean> = {}) {
  const result = [".", url, "-o", "-"];

  for (const [arg, value] of Object.entries(args)) {
    const v = Array.isArray(value) ? value.join(",") : value;

    result.push(`--${arg}`);

    if (typeof v === "boolean") {
      continue;
    }

    result.push(v);
  }

  return result;
}

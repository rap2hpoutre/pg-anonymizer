import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { CLIError } from "@oclif/errors";

export function runPgDump(argv: string []): ChildProcessWithoutNullStreams {
  const pg = spawn("pg_dump", argv);

  pg.on("exit", function (code) {
    if (code !== 0) {
      throw new CLIError(`pg_dump command failed with exit code ${code}`, { exit: code ?? undefined });
    }
  });

  pg.stderr.on("data", function (data) {
    throw new CLIError(`pg_dump command error: ${data.toString()}`);
  });

  pg.stdout.setEncoding("utf8");

  return pg;
}

// These arguments, if passed through to pg_dump, will break pg-anonymizer.
export const pgDumpArgsBlacklist = [
  "-f",
  "--file",
  "-F",
  "--format",
  "-V",
  "--version",
  "-?",
  "--help",
];

const isBlacklisted = (arg: string) => {
  for (const blacklistArg of pgDumpArgsBlacklist) {
    if (
      (blacklistArg.startsWith("--") && arg.startsWith(blacklistArg)) ||
      arg === blacklistArg
    ) {
      return true;
    }
  }

  return false;
};

export function sanitizePgDumpArgs(argv: string[]): void {
  const invalidArgs = argv.filter(arg => isBlacklisted(arg));

  if (invalidArgs && invalidArgs.length > 0) {
    throw new CLIError("Illegal arguments to pg_dump: " + invalidArgs.join(", "));
  }
}

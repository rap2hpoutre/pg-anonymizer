// These arguments, if passed through to pg_dump, will break pg-anonymizer.
import { CLIError } from "@oclif/errors";

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

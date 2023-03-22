import { parseTransformer } from "./parse-transformer";
import { Config, parseColumns, parseConfig, parseOutput } from "./parse-config";
import { FlagOutput } from "../commands";

export async function parseFlags(flags: FlagOutput): Promise<Config> {
  const config = await parseConfig(flags.config);

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
    config.locale = flags["faker-locale"];
  }

  return config;
}

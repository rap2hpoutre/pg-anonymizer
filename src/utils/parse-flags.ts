import { parseTransformer } from "./parse-transformer";
import { Config, parseColumns, parseConfig, parseOutput } from "./parse-config";
import { FlagOutput } from "../commands";
import { Metadata } from "@oclif/core/lib/interfaces/parser";

export async function parseFlags(flags: FlagOutput, metadata: Metadata): Promise<Config> {
  const config = await parseConfig(flags.config);

  if (set("columns", flags.columns, metadata, config)) {
    config.columns = parseColumns(flags.columns.split(","));
  }

  if (set("transformer", flags.transformer, metadata, config)) {
    config.transformer = await parseTransformer(flags.transformer);
  }

  if (set("skip", flags.skip, metadata, config)) {
    config.skip = flags.skip.split(",").map(t => t.toLowerCase().trim());
  }

  if (set("output", flags.output, metadata, config)) {
    config.output = parseOutput(flags.output);
  }

  if (set("faker-locale", flags["faker-locale"], metadata, config)) {
    config.locale = flags["faker-locale"];
  }

  if (flags["preserve-null"]) {
    config.preserveNull = flags["preserve-null"];
  }

  return config;
}

// Determine whether to override the configuration set from the flags
function set<K extends keyof FlagOutput>(flag: K, value: string | undefined, metadata: Metadata, config: Config): value is string  {
  const isDefault = metadata.flags[flag]?.setFromDefault;

  // If it's set from default but already configuration in the config, don't override
  if (isDefault && config.keys.includes(flag)) {
    return false;
  }

  // If it's not set in the config
  return Boolean(value);
}

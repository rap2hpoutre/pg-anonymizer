import fs from "fs-extra";
import { join } from "node:path";
import { CLIError } from "@oclif/errors";

export interface Transformer {
  module: any;
  supportsTables: boolean
}

export async  function parseTransformer(path?: string): Promise<Transformer | undefined> {
  if (!path) {
    return undefined;
  }

  const p = join(process.cwd(), path);

  if (!fs.existsSync(p)) {
    throw new CLIError(`No transformer found at "${p}"`);
  }

  // eslint-disable-next-line unicorn/prefer-module
  const transformer = require(p);

  return {
    module: transformer,
    supportsTables: Boolean(transformer.tables),
  };
}

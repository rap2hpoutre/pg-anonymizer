import chalk from "chalk";

export class Logger {
  get enabled(): boolean {
    return process.env.LOGGING_LEVEL !== "none";
  }

  log(...args: any[]): void {
    if (!this.enabled) {
      return;
    }

    if (process.env.LOG_AS_COMMENTS === "true") {
      return console.log("--", ...args);
    }

    return console.log(...args);
  }

  print(text: TemplateStringsArray, ...placeholders: unknown[]): void {
    return this.log(chalk(text, placeholders));
  }

  info(message: string, ...args: any[]): void {
    return this.log(chalk.grey(message), ...args.map(a => chalk.grey(a)));
  }
}

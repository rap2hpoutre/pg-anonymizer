import chalk from "chalk";

export class Logger {
  log = console.log

  print(text: TemplateStringsArray, ...placeholders: unknown[]): void {
    return console.log(chalk(text, placeholders));
  }

  info(message: string, ...args: any[]): void {
    return console.log(chalk.grey(message), ...args.map(a => chalk.grey(a)));
  }
}

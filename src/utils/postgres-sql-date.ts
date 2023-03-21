export function postgresSqlDate(date: Date): string {
  return date.toISOString().replace(/T/, " ").replace(/\..+/, "");
}

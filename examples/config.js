/* eslint-disable unicorn/prefer-module */

module.exports = {
  skip: ["public.user"],
  columns: ["name", "password"],
  transformer: "./examples/transformer.js",
};

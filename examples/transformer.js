/* eslint-disable unicorn/prefer-module */
const faker = require("faker");

module.exports = {
  tables: {
    "public.user": value => {
      console.log({ value });

      return {
        name: faker.name.firstName(),
        password: faker.random.alphaNumeric(10),
      };
    },
  },
};

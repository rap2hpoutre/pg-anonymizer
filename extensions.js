// extensions.js
module.exports = {
  randomCountryID: () => {
    return Math.floor(Math.random() * (231 - 1 + 1) + 1);
  },
  randomHeight: () => {
    return Math.floor(Math.random() * (200 - 150 + 1) + 150);
  },
  randomWeight: () => {
    return Math.floor(Math.random() * (180 - 45 + 1) + 45);
  },
  randomBirthdate: () => {
    const start = new Date(1910, 0, 1);
    const end = new Date(2018, 11, 31);
    const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    return date.toISOString().replace(/T/, " ").replace(/\..+/, "");
  }
};

# [0.7.0](https://github.com/rap2hpoutre/pg-anonymizer/compare/v0.6.0...v0.7.0) (2023-03-20)


### Features

* add --skip and --preserve-null support, with chalk for logging ([ecc6818](https://github.com/rap2hpoutre/pg-anonymizer/commit/ecc6818a96a0bcaa4e5142a82735835fdae0a5ab))

# [0.6.0](https://github.com/rap2hpoutre/pg-anonymizer/compare/v0.5.1...v0.6.0) (2022-07-08)


### Features

* allow for passthrough of extra args to pg_dump ([#26](https://github.com/rap2hpoutre/pg-anonymizer/issues/26)) ([776b5be](https://github.com/rap2hpoutre/pg-anonymizer/commit/776b5be4efa8196b26d77b479329eb04033bc384))

## [0.5.1](https://github.com/rap2hpoutre/pg-anonymizer/compare/v0.5.0...v0.5.1) (2022-05-06)


### Bug Fixes

* **stdout:** wait for output to be processed instead of buffering ([#29](https://github.com/rap2hpoutre/pg-anonymizer/issues/29)) ([1146187](https://github.com/rap2hpoutre/pg-anonymizer/commit/11461870674b65be83f2a9b6ba07b9162c2c19b1))

# [0.5.0](https://github.com/rap2hpoutre/pg-anonymizer/compare/v0.4.0...v0.5.0) (2022-03-13)


### Features

* add support to specify tables in list of columns ([#13](https://github.com/rap2hpoutre/pg-anonymizer/issues/13)) ([bc6638d](https://github.com/rap2hpoutre/pg-anonymizer/commit/bc6638de24632cb0bee9059e25e688f19f9b2c6d))
* new option to read replacements from a file ([#18](https://github.com/rap2hpoutre/pg-anonymizer/issues/18)) ([a7c6441](https://github.com/rap2hpoutre/pg-anonymizer/commit/a7c644139f74616c0c4be79d06514e3b046f62ce))
* output can be stdout so you can pipe it to other commands ([#19](https://github.com/rap2hpoutre/pg-anonymizer/issues/19)) ([11e46ce](https://github.com/rap2hpoutre/pg-anonymizer/commit/11e46ce8ac8786d08401da2c27ef7089aa783905))
* table name to extension functions ([#8](https://github.com/rap2hpoutre/pg-anonymizer/issues/8)) ([9f0a8f8](https://github.com/rap2hpoutre/pg-anonymizer/commit/9f0a8f88ab443a1991136a475ea95e528799aff8))

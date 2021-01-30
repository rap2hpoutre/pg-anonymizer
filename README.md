pg-anonymizer
=============

Export your PostgreSQL database anonymized. Replace all sensitive data thanks to `faker`. Output to a file that you can easily import with `psql`.

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/pg-anonymizer.svg)](https://npmjs.org/package/pg-anonymizer)
[![Downloads/week](https://img.shields.io/npm/dw/pg-anonymizer.svg)](https://npmjs.org/package/pg-anonymizer)
[![License](https://img.shields.io/npm/l/pg-anonymizer.svg)](https://github.com/rap2hpoutre/pg-anonymizer/blob/master/package.json)
## Usage

Run this command by giving a connexion string and an output file name (no need to install first thanks to `npx`):

```bash
npx pg-anonymizer postgres://user:secret@localhost:1234/mydb -o dump.sql
```

☝️ This command requires `pg_dump`. It may already be installed as soon as PostgreSQL is installed.

### Specify list of columns to anonymize

Use `--list` option with a comma separated list of column name:

```bash
npx pg-anonymizer postgres://localhost/mydb \
  --list=email,firstName,lastName,phone
```

Specifying another list via `--list` replace the default automatically anonymized values:

```
email,name,description,address,city,country,phone,comment,bithdate
```

You can also choose which faker function you want to use to replace data (default is `faker.random.word`):

```bash
npx pg-anonymizer postgres://localhost/mydb \
  --list=firstName:faker.name.firstName,lastName:faker.name.lastName
```

You don't need to specify faker function since the command will try to find correct function via column name.

### Memory limit

Use `-m` to change `pg_dump` output memory limit (e.g: `512`)

### Locale (i18n)

Use `-l` to change the locale used by faker (default: `en`)

### Import the anonymized file

The anonymized output file is plain SQL text, you can import it with `psql`.

```
psql -d mylocaldb < output.sql
```

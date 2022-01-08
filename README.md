pg-anonymizer
=============

Export your PostgreSQL database anonymized. Replace all sensitive data thanks to `faker`. Output to a file that you can easily import with `psql`.

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/pg-anonymizer.svg)](https://npmjs.org/package/pg-anonymizer)
[![Downloads](https://img.shields.io/npm/dt/pg-anonymizer.svg)](https://npmjs.org/package/pg-anonymizer)
[![License](https://img.shields.io/npm/l/pg-anonymizer.svg)](https://github.com/rap2hpoutre/pg-anonymizer/blob/master/package.json)
## Usage

Run this command by giving a connexion string and an output file name (no need to install first thanks to `npx`):

```bash
npx pg-anonymizer postgres://user:secret@localhost:1234/mydb -o dump.sql
```

☝️ This command requires `pg_dump`. It may already be installed as soon as PostgreSQL is installed.

Output can also be stdout ('-') so you can pipe the output to zip, gz, or to psql:

```bash
npx pg-anonymizer postgres://user:secret@localhost:1234/mydb -o - | psql DATABASE_URL
```

### Specify list of columns to anonymize

Use `--list` option with a comma separated list of column name:

```bash
npx pg-anonymizer postgres://localhost/mydb \
  --list=email,firstName,lastName,phone
```

Specifying another list via `--list` replace the default automatically anonymized values:

```csv
email,name,description,address,city,country,phone,comment,birthdate
```

You can also specify the table for a column using the dot notation:

```csv
public.user.email,public.product.description,email,name
```

Alternatively use `--configFile` option to specify a file with a list of column names and optional replacements, one per line:

```bash
npx pg-anonymizer postgres://localhost/mydb \
  --configFile /path/to/file
```

#### Customize replacements 

You can also choose which faker function you want to use to replace data (default is `faker.random.word`):

```bash
npx pg-anonymizer postgres://localhost/mydb \
  --list=firstName:faker.name.firstName,lastName:faker.name.lastName
```

:point_right: You don't need to specify faker function since the command will try to find correct function via column name.

You can use plain text too for static replacements:
```bash
npx pg-anonymizer postgres://localhost/mydb \
  --list=textcol:hello,jsoncol:{},intcol:12
```

You can even use your custom replacements function from your own javascript module.
Here is a simple example to mask all the email.
```bash
npx pg-anonymizer postgres://localhost/mydb \
  --extension ./myExtension.js \
  --list=email:extension.maskEmail
```

```javascript
// myExtension.js
module.exports = {
  maskEmail: (email) => {
   const [name, domain] = email.split('@');
   const { length: len } = name;
   const maskedName = name[0] + '...' + name[len - 1];
   const maskedEmail = maskedName + '@' + domain;
   return maskedEmail;
  }
};
```

### Locale (i18n)

Use `-l` to change the locale used by faker (default: `en`)

### Import the anonymized file

The anonymized output file is plain SQL text, you can import it with `psql`.

```bash
psql -d mylocaldb < output.sql
```

## Why

There are a bunch of competitors, still I failed to use them:

 - [`postgresql_anonymizer`](https://postgresql-anonymizer.readthedocs.io/en/stable/) may be [hard to setup](https://postgresql-anonymizer.readthedocs.io/en/stable/INSTALL/#install-on-macos) and may be cumbersome for simple usage. Still, I guess it's the best solution.
 - [`pganonymize`](https://pypi.org/project/pganonymize/) fails when it does not use `public` schema or columns have uppercase characters
 - [`pganonymizer`](https://github.com/asgeirrr/pgantomizer) also fails with simple cases. Errors are not explicit and silent.

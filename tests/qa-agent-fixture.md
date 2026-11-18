# Disposable QA integration fixture - test only

Never run this fixture or its grants against production, Supabase, an existing
project, or any database containing real data. It creates roles and deliberately
uses BYPASSRLS in a new disposable loopback-only cluster. It is not a migration.

Requires PostgreSQL 17 tools, PostgREST 16, Node 22 and `npm ci` in this repo.
In a Linux sandbox, replace `PG_BIN` with the directory containing `initdb`,
`postgres` and `psql`, and `POSTGREST` with the PostgREST executable. These
commands require ports 55438 and 55433 to be unused. Run as an unprivileged
local account, never root. Use a fresh empty `WORK` directory each time.

```sh
export PG_BIN=/path/to/postgresql/bin
export POSTGREST=/path/to/postgrest
export WORK="$(mktemp -d)"
"$PG_BIN/initdb" -D "$WORK/data" --auth=trust --encoding=UTF8 --no-locale
"$PG_BIN/postgres" -D "$WORK/data" -p 55438 -k "$WORK" -h 127.0.0.1 >"$WORK/pg.log" 2>&1 &
# Wait until the local database is ready before continuing.
"$PG_BIN/psql" -h 127.0.0.1 -p 55438 -U "$(whoami)" -d postgres -v ON_ERROR_STOP=1 -f tests/qa-agent-local-fixture.sql
sed -e 's/public\./qa_test./g' -e 's/pg_catalog, public/pg_catalog, qa_test/g' supabase/migrations/010_qa_send_recovery.sql >"$WORK/migration.sql"
"$PG_BIN/psql" -h 127.0.0.1 -p 55438 -U "$(whoami)" -d postgres -v ON_ERROR_STOP=1 -f "$WORK/migration.sql"
"$PG_BIN/psql" -h 127.0.0.1 -p 55438 -U "$(whoami)" -d postgres -v ON_ERROR_STOP=1 -c 'grant all on all tables in schema qa_test to web_anon, service_role; grant usage,select on all sequences in schema qa_test to web_anon, service_role; grant execute on all functions in schema qa_test to web_anon, service_role;'
printf 'db-uri = "postgres://%s@127.0.0.1:55438/postgres"\ndb-schemas = "qa_test"\ndb-anon-role = "web_anon"\nserver-host = "127.0.0.1"\nserver-port = 55433\n' "$(whoami)" >"$WORK/postgrest.conf"
"$POSTGREST" "$WORK/postgrest.conf" >"$WORK/postgrest.log" 2>&1 &
# Wait for PostgREST to load its schema, then run each test once.
QA_TEST_POSTGREST_URL=http://127.0.0.1:55433 node tests/qa-agent-batch-integration.test.mjs
QA_TEST_POSTGREST_URL=http://127.0.0.1:55433 node tests/qa-agent-synthetic-integration.test.mjs
```

Stop both test processes and remove the disposable directory after testing.
The tests use fixed IDs and need a fresh fixture for a rerun. They simulate
provider responses and contain no real email send. They do not prove production
configuration or permissions. Other unit tests mock the website entirely.

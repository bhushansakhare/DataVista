// Postgres connector — stubbed.
//
// A working implementation requires the `pg` package (`npm install pg`) and
// a connection-pool strategy. Marked as "configurable, fetch not yet wired"
// so users can store the credentials but the dispatcher returns a clear
// error if they try to fetch until pg is installed.
//
// To enable:
//   1. cd server && npm install pg
//   2. Uncomment the import + body below
//   3. Configure a max-row LIMIT in the SELECT to avoid pulling millions

// import pg from 'pg';

export async function fetchPostgres({ /* connectionString, query */ }) {
  // const client = new pg.Client({ connectionString, statement_timeout: 15_000 });
  // try {
  //   await client.connect();
  //   const safeQuery = `SELECT * FROM (${query}) AS sub LIMIT 5000`;
  //   const res = await client.query(safeQuery);
  //   return res.rows;
  // } finally {
  //   await client.end().catch(() => {});
  // }
  const e = new Error('Postgres connector is not yet enabled. Install `pg` in server/ and uncomment the implementation in connectors/postgres.js.');
  e.code = 'connector_disabled';
  throw e;
}

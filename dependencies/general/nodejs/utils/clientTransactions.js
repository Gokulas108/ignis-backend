const db = require("/opt/nodejs/utils/db.js");

async function addclienttransaction(username, client_id, name) {
  const date_now = new Date().toISOString();

  await db.none(
    `INSERT into ${client_id}_transactions (name, username, timestamp) VALUES ($1, $2, $3)`,
    [name, username, date_now]
  );
}

module.exports = addclienttransaction;

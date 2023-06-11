const db = require("/opt/nodejs/utils/db.js");

async function addclienttransaction(user_id, client_id, name) {
  const date_now = new Date().toISOString();

  await db.none(
    `INSERT into ${client_id}_transactions (name, user_id, timestamp) VALUES ($1, $2, $3)`,
    [name, user_id, date_now]
  );
}

module.exports = addclienttransaction;

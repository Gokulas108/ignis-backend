const db = require("/opt/nodejs/utils/db.js");

exports.lambdaHandler = async (event, context) => {
  let data = await db.any(
    `SELECT client_id, timezone FROM client WHERE id != $1`,
    [1]
  );
  data.forEach(async ({ client_id, timezone }) => {
    let date_now = new Date().toISOString(
      new Date().toLocaleString("en-US", {
        timeZone: timezone,
      })
    );
    await db.none(
      `UPDATE ${client_id}_contracts SET status = $1 WHERE $2 BETWEEN from_date AND to_date AND status != $1`,
      ["ACTIVE", date_now]
    );
    await db.none(
      `UPDATE ${client_id}_contracts SET status = $1 WHERE to_date < $2 AND status != $1`,
      ["EXPIRED", date_now]
    );
    await db.none(
      `UPDATE ${client_id}_contracts SET status = $1 WHERE from_date > $2 AND status != $1`,
      ["INACTIVE", date_now]
    );
  });
};

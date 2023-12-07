const db = require("/opt/nodejs/utils/db.js");
const responseHandler = require("/opt/nodejs/utils/responseHandler.js");
const authorize = require("/opt/nodejs/utils/authorize.js");
const authcode = require("/opt/nodejs/utils/accessCodes.js");
const addclienttransaction = require("/opt/nodejs/utils/clientTransactions.js");

exports.lambdaHandler = async (event, context) => {
  let statusCode = 200;
  let data, body;
  let httpMethod = event.httpMethod;
  let token = event.headers["ignistoken"];
  let ip = event["requestContext"]["identity"]["sourceIp"];
  let useragent = event["requestContext"]["identity"]["userAgent"];

  try {
    switch (httpMethod) {
      case "OPTIONS":
        [data, statusCode] = ["Success", 200];
        break;
      case "GET":
        if (event.pathParameters && event.pathParameters.id) {
          [data, statusCode] = await authorize(
            authcode.GET_MESSAGE,
            ip,
            useragent,
            token,
            async (username, client_id) =>
              await getMessages(event.pathParameters.id, client_id, username)
          );
        } else {
          throw new Error("Missing ID");
        }
        break;
      case "POST":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          authcode.ADD_MESSAGE,
          ip,
          useragent,
          token,
          async (username, client_id) =>
            await addMessage(body, username, client_id)
        );
        break;
      case "DELETE":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          authcode.DELETE_MESSAGE,
          ip,
          useragent,
          token,
          async (username, client_id) =>
            await deleteMessage(body.id, username, client_id)
        );
        break;
      default:
        [data, statusCode] = ["Error: Invalid request", 400];
    }
  } catch (err) {
    statusCode = 400;
    data = err.message;
  }

  response = responseHandler(data, statusCode);
  return response;
};

async function getMessages(id, client_id, username) {
  let wo_id = parseInt(id);
  const data = await db.any(
    `SELECT msg.* , cu.name FROM ${client_id}_messages msg JOIN ${client_id}_users cu ON msg.createdby = cu.username  WHERE msg.wo_id = $1`,
    [wo_id]
  );
  await db.none(
    `UPDATE ${client_id}_messages SET seen = $1 WHERE wo_id = $2 AND createdby != $3`,
    [true, wo_id, username]
  );
  return [data, 200];
}

async function addMessage({ wo_id, type, message }, createdBy, client_id) {
  if (!message || !type || !wo_id) throw new Error("Missing required fields");

  const date_now = new Date().toISOString();

  await db.none(
    `INSERT into ${client_id}_messages (wo_id, type, message, createdby, createdat) VALUES ($1, $2, $3, $4, $5)`,
    [wo_id, type, message, createdBy, date_now]
  );
  await addclienttransaction(createdBy, client_id, "ADD_MESSAGE");
  return ["Message Successfully Added", 200];
}

async function deleteMessage(id, deletedby, client_id) {
  let message_id = parseInt(id);
  await db.none(`DELETE FROM ${client_id}_messages WHERE id = $1`, [
    message_id,
  ]);
  await addclienttransaction(deletedby, client_id, "DELETE_MESSAGE");
  return ["Message Successfully Deleted", 200];
}

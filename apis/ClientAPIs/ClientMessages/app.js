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
        if (event.pathParameters && event.pathParameters.wo_id) {
          [data, statusCode] = await authorize(
            authcode.GET_MESSAGE,
            ip,
            useragent,
            token,
            async (username, client_id) =>
              await getMessages(event.pathParameters.wo_id, client_id)
          );
        } else {
          throw new Error("Missing Work Order ID");
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

async function getMessages(id, client_id) {
  let wo_id = parseInt(id);
  const data = await db.any(
    `SELECT msg.*, user.name as name FROM ${client_id}_messages msg JOIN ${client_id}_users user ON msg.createdby = user.username  WHERE msg.wo_id = $1`,
    [wo_id]
  );
  return [data, 200];
}

async function addMessage({ type, message }, createdBy, client_id) {
  if (!message || !type) throw new Error("Missing required fields");

  const date_now = new Date().toISOString();

  await db.none(
    `INSERT into ${client_id}_messages (type, message, createdby, createdat) VALUES ($1, $2, $3, $4)`,
    [type, message, createdBy, date_now]
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

const db = require("/opt/nodejs/utils/db.js");
const responseHandler = require("/opt/nodejs/utils/responseHandler.js");
const authorize = require("/opt/nodejs/utils/authorize.js");
const authcode = require("/opt/nodejs/utils/accessCodes.js");
const addclienttransaction = require("/opt/nodejs/utils/clientTransactions.js");
const obdbmultiinsert = require("/opt/nodejs/utils/obdbMultiInsert.js");

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

      case "POST":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          authcode.ADD_ASSET,
          ip,
          useragent,
          token,
          async (username, client_id) =>
            await addAsset(body, username, client_id)
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

async function addAsset(data, createdBy, client_id) {
  const date_now = new Date().toISOString();
  let [sql_stmt, col_values] = obdbmultiinsert(data, client_id, "assets");
  const asset = await db.any(`${sql_stmt} RETURNING id`, [
    ...col_values,
    createdBy,
    createdBy,
    date_now,
    date_now,
  ]);
  await addclienttransaction(createdBy, client_id, "ADD_ASSET");
  return [asset, 200];
}

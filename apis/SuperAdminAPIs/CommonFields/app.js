const db = require("/opt/nodejs/utils/db.js");
const responseHandler = require("/opt/nodejs/utils/responseHandler.js");
const authorize = require("/opt/nodejs/utils/authorize.js");

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
        [data, statusCode] = await authorize(
          [],
          ip,
          useragent,
          token,
          async (id) => await getCommonField(),
          true
        );
        break;
      case "PUT":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          [],
          ip,
          useragent,
          token,
          async (id) => updateCommonField(body, id),
          true
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

async function getCommonField() {
  let data = await db.oneOrNone(
    `SELECT value FROM configurations WHERE name = $1`,
    ["device_common_fields"]
  );
  return [data, 200];
}

async function updateCommonField({ fields }, updatedby) {
  const date_now = new Date().toISOString();

  await db.none(
    "UPDATE configurations SET value =  $1::json[], updatedat = $2 , updatedby = $3 WHERE name = $4",
    [fields, date_now, updatedby, "device_common_fields"]
  );

  return ["Common Fields Successfully Updated", 200];
}

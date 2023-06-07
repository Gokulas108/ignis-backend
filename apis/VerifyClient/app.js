const db = require("/opt/nodejs/utils/db.js");
const responseHandler = require("/opt/nodejs/utils/responseHandler.js");

exports.lambdaHandler = async (event, context) => {
  let statusCode = 200;
  let data;
  let httpMethod = event.httpMethod;

  try {
    switch (httpMethod) {
      case "OPTIONS":
        [data, statusCode] = ["Success", 200];
        break;

      case "GET":
        if (event.queryStringParameters.client) {
          console.log(event.queryStringParameters.client);
          [data, statusCode] = await verifyClient(
            event.queryStringParameters.client
          );
        } else {
          throw new Error("Missing Client");
        }
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

async function verifyClient(client_id) {
  data = await db.any("SELECT * FROM client WHERE client_id = $1", [client_id]);

  if (data === undefined || data.length === 0)
    return ["Client does not exist", 400];
  else return [data, 200];
}

const db = require("/opt/nodejs/utils/db.js");
const responseHandler = require("/opt/nodejs/utils/responseHandler.js");
const jwt = require("jsonwebtoken");

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

function generateToken(client_id) {
  if (!client_id) return null;
  return jwt.sign(client_id, process.env.SECRET_KEY, {
    expiresIn: "8h",
  });
}

async function verifyClient(client_id) {
  data = await db.any("SELECT * FROM client WHERE client_id = $1", [client_id]);

  if (!data?.length) return ["Client does not exist", 400];
  else {
    client_token = generateToken({ client_id: data[0].client_id });
    return [{ data, client_token }, 200];
  }
}

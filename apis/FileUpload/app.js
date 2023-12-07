const AWS = require("aws-sdk");
const addclienttransaction = require("/opt/nodejs/utils/clientTransactions.js");
const authorize = require("/opt/nodejs/utils/authorize.js");
const authcode = require("/opt/nodejs/utils/accessCodes.js");
const responseHandler = require("/opt/nodejs/utils/responseHandler.js");
const { DeleteObjectCommand, S3Client } = require("@aws-sdk/client-s3");

exports.lambdaHandler = async (event, context) => {
  let statusCode = 200;
  let data = [];
  let httpMethod = event.httpMethod;
  let token = event.headers["ignistoken"];
  let ip = event["requestContext"]["identity"]["sourceIp"];
  let useragent = event["requestContext"]["identity"]["userAgent"];
  let body;

  try {
    switch (httpMethod) {
      case "OPTIONS":
        [data, statusCode] = ["Success", 200];
        break;

      case "POST":
        body = JSON.parse(event.body);
        if (event.queryStringParameters) {
          if (event.queryStringParameters.superadmin) {
            [data, statusCode] = await authorize(
              [],
              ip,
              useragent,
              token,
              async (id) => await getPresignedUrl(body),
              true
            );
          } else {
            throw new Error("Missing Superadmin");
          }
        } else {
          [data, statusCode] = await authorize(
            authcode.VIEW_FILE,
            ip,
            useragent,
            token,
            async (username, client_id) => await getPresignedUrl(body)
          );
        }
        break;

      case "PUT":
        body = JSON.parse(event.body);
        if (event.queryStringParameters) {
          if (event.queryStringParameters.superadmin) {
            [data, statusCode] = await authorize(
              [],
              ip,
              useragent,
              token,
              async (id) => await createPresignedUrl(body),
              true
            );
          } else {
            throw new Error("Missing Superadmin");
          }
        } else
          [data, statusCode] = await authorize(
            authcode.UPLOAD_FILE,
            ip,
            useragent,
            token,
            async (username, client_id) =>
              await createPresignedUrl(body, username, client_id)
          );
        break;

      case "DELETE":
        body = JSON.parse(event.body);
        if (event.queryStringParameters) {
          if (event.queryStringParameters.superadmin) {
            [data, statusCode] = await authorize(
              [],
              ip,
              useragent,
              token,
              async (id) => await deleteFile(body),
              true
            );
          } else {
            throw new Error("Missing Superadmin");
          }
        } else
          [data, statusCode] = await authorize(
            authcode.DELETE_FILE,
            ip,
            useragent,
            token,
            async (username, client_id) =>
              await deleteFile(body, username, client_id)
          );
        break;

      default:
        [data, statusCode] = ["Error: Invalid request", 400];
    }
  } catch (err) {
    statusCode = 400;
    data = err.stack;
  }

  response = responseHandler(data, statusCode);
  return response;
};

async function createPresignedUrl(
  { type, type_name, file_name, content_type },
  username = false,
  client_id = "admin"
) {
  AWS.config.update({ region: process.env.REGION });
  const s3 = new AWS.S3();
  const URL_EXPIRATION_SECONDS = 60 * 60;
  const filepath = `${client_id}/${type}/${type_name}/${file_name}`;
  const s3Params = {
    Bucket: process.env.BUCKET,
    Key: filepath,
    Expires: URL_EXPIRATION_SECONDS,
    ContentType: content_type,
  };
  let uploadURL = s3.getSignedUrl("putObject", s3Params);
  if (username && client_id)
    await addclienttransaction(username, client_id, "FILE_UPLOAD");
  return [{ uploadURL, filepath }, 200];
}
async function getPresignedUrl({ filepath }) {
  AWS.config.update({ region: process.env.REGION });
  const s3 = new AWS.S3();
  const URL_EXPIRATION_SECONDS = 60 * 60;

  const s3Params = {
    Bucket: process.env.BUCKET,
    Key: filepath,
    Expires: URL_EXPIRATION_SECONDS,
  };
  let viewURL = s3.getSignedUrl("getObject", s3Params);

  return [viewURL, 200];
}

async function deleteFile({ filepath }, username = false, client_id = "admin") {
  const client = new S3Client({ region: process.env.REGION });
  const command = new DeleteObjectCommand({
    Bucket: process.env.BUCKET,
    Key: filepath,
  });
  const response = await client.send(command);
  console.log(response);
  if (username && client_id)
    await addclienttransaction(username, client_id, "FILE_DELETE");
  return ["File deleted successfully", 200];
}

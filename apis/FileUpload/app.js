import { fromIni } from "@aws-sdk/credential-providers";
import { HttpRequest } from "@aws-sdk/protocol-http";
import { S3RequestPresigner } from "@aws-sdk/s3-request-presigner";
import { parseUrl } from "@aws-sdk/url-parser";
import { formatUrl } from "@aws-sdk/util-format-url";
import { Hash } from "@aws-sdk/hash-node";
const addclienttransaction = require("/opt/nodejs/utils/clientTransactions.js");
const authorize = require("/opt/nodejs/utils/authorize.js");
const authcode = require("/opt/nodejs/utils/accessCodes.js");
const responseHandler = require("/opt/nodejs/utils/responseHandler.js");

exports.lambdaHandler = async (event, context) => {
  let statusCode = 200;
  let data = [];
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
        let body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          authcode.ADD_BUILDING,
          ip,
          useragent,
          token,
          async (id, client_id) => await createPresignedUrl(body, id, client_id)
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

const bucket = process.env.BUCKET;
const region = process.env.REGION;

async function createPresignedUrl({ building_name, file_name }, id, client_id) {
  const filepath = `${client_id}/buildings/${building_name}/${file_name}`;
  const url = parseUrl(
    `https://${bucket}.s3.${region}.amazonaws.com/${filepath}`
  );
  const presigner = new S3RequestPresigner({
    credentials: fromIni(),
    region,
    sha256: Hash.bind(null, "sha256"),
  });

  const signedUrlObject = await presigner.presign(
    new HttpRequest({ ...url, method: "PUT" })
  );
  await addclienttransaction(id, client_id, "FILE_UPLOAD");
  return [formatUrl(signedUrlObject), 200];
}

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
        if (event.pathParameters && event.pathParameters.id) {
          console.log(event.pathParameters.id);
          [data, statusCode] = await authorize(
            [],
            ip,
            useragent,
            token,
            async (id) => await getAHJpdf(event.pathParameters.id),
            true
          );
        } else {
          throw new Error("Missing ID");
        }
        break;
      case "POST":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          [],
          ip,
          useragent,
          token,
          async (id) => await addAHJpdf(body, id),
          true
        );
        break;
      case "POST":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          [],
          ip,
          useragent,
          token,
          async (id) => await updateAHJpdf(body, id),
          true
        );
        break;
      case "DELETE":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          [],
          ip,
          useragent,
          token,
          async (id) => await deleteAHJpdf(body.id),
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

async function getAHJpdf(id) {
  let ahj_id = parseInt(id);
  const data = await db.any("SELECT * FROM ahj_pdf WHERE ahj_id = $1", [
    ahj_id,
  ]);
  return [data, 200];
}

async function deleteAHJpdf(id) {
  let ahj_id = parseInt(id);
  await db.none("DELETE FROM ahj_pdf WHERE id = $1", [ahj_id]);
  return ["AHJ PDF Successfully Deleted", 200];
}

async function addAHJpdf({ ahj_id, filepath, fields }, createdBy) {
  if (!ahj_id || !filepath || !fields)
    throw new Error("Missing required fields");

  const date_now = new Date().toISOString();

  await db.none(
    "INSERT into ahj_pdf (ahj_id, filepath, fields,  createdby, updatedby, createdat, updatedat) VALUES ($1, $2::json, $3::json[], $4, $4,$5,$5)",
    [ahj_id, filepath, fields, createdBy, date_now]
  );

  return ["AHJ PDF Successfully Added", 200];
}

async function updateAHJpdf({ fields }, username) {
  if (!ahj_id || !filepath || !fields)
    throw new Error("Missing required fields");

  const date_now = new Date().toISOString();

  await db.none(
    "UPDATE ahj_pdf SET fields = $1::json[], updatedby = $2, updatedat = $3",
    [fields, username, date_now]
  );

  return ["AHJ PDF Successfully Updated", 200];
}

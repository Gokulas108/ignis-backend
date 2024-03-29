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
            async (id) => await getSystem(event.pathParameters.id),
            true
          );
        } else if (event.queryStringParameters) {
          let params = event.queryStringParameters;
          if (params.page && params.limit) {
            page = parseInt(params.page);
            limit = parseInt(params.limit);
            [data, statusCode] = await authorize(
              [],
              ip,
              useragent,
              token,
              async (id) => await getSystems(page, limit, params.searchText),
              true
            );
          } else {
            throw new Error("Missing Page or Limit");
          }
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
          async (id) => await addSystem(body.client, id),
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
          async (id) => await updateSystemFields(body, id),
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
          async (id) => await deleteSystem(body.id),
          true
        );
        break;
      default:
        [data, statusCode] = ["Error: Invalid request", 400];
    }
  } catch (err) {
    statusCode = 400;
    if (err.message.includes("devicetypes_fk"))
      data = "There are existing devices for the system!";
    else data = err.message;
  }

  response = responseHandler(data, statusCode);
  return response;
};

async function getSystems(page = 1, limit = 10, searchText = "") {
  let offset = (page - 1) * limit;
  let data;
  if (searchText === "") {
    data = await db.any(
      `SELECT sys.* , count(sys.*) OVER() AS full_count FROM systemtypes sys ORDER BY sys.name OFFSET $1 LIMIT $2`,
      [offset, limit]
    );
  } else {
    searchText = `%${searchText}%`;
    data = await db.any(
      `SELECT sys.* , count(sys.*) OVER() AS full_count FROM systemtypes sys WHERE sys.name iLIKE $1 ORDER BY sys.name OFFSET $2 LIMIT $3`,
      [searchText, offset, limit]
    );
  }
  return [data, 200];
}

async function getSystem(id) {
  let sys_id = parseInt(id);
  const data = await db.any("SELECT * FROM systemtypes WHERE id = $1", [
    sys_id,
  ]);
  return [data, 200];
}

async function deleteSystem(id) {
  let sys_id = parseInt(id);
  await db.none("DELETE FROM systemtypes WHERE id = $1", [sys_id]);
  return ["System Successfully Deleted", 200];
}

async function addSystem({ name, general_information }, createdBy) {
  if (!name || !createdBy) throw new Error("Missing required fields");

  const date_now = new Date().toISOString();

  await db.none(
    "INSERT into systemtypes (name, general_information, createdBy, updatedby, createdAt, updatedAt) VALUES ($1, $2::json[], $3, $3, $4, $5)",
    [name, general_information, createdBy, date_now, date_now]
  );

  return ["System Successfully Added", 200];
}

async function updateSystemFields({ id, general_information }, updatedby) {
  if (!id) throw new Error("Missing Id");
  const date_now = new Date().toISOString();

  const query =
    "UPDATE systemtypes SET general_information = $1::json[], updatedat = $2, updatedby = $3 WHERE id = $4";
  await db.none(query, [general_information, date_now, updatedby, id]);

  return ["System General Fields Updated", 200];
}

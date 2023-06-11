const db = require("/opt/nodejs/utils/db.js");
const responseHandler = require("/opt/nodejs/utils/responseHandler.js");
const authorize = require("/opt/nodejs/utils/authorize.js");
const authcode = require("/opt/nodejs/utils/accessCodes.js");

exports.lambdaHandler = async (event, context) => {
  let statusCode = 200;
  let data, body;
  let httpMethod = event.httpMethod;
  let token = event.headers["ignistoken"];
  let clitoken = event.headers["clienttoken"];

  try {
    switch (httpMethod) {
      case "OPTIONS":
        [data, statusCode] = ["Success", 200];
        break;
      case "GET":
        if (event.pathParameters && event.pathParameters.id) {
          console.log(event.pathParameters.id);
          [data, statusCode] = await authorize(
            authcode.GET_RESOURCE,
            clitoken,
            token,
            async (id, client_id) =>
              await getResource(event.pathParameters.id, client_id)
          );
        } else if (event.queryStringParameters) {
          let params = event.queryStringParameters;
          if (params.page && params.limit) {
            page = parseInt(params.page);
            limit = parseInt(params.limit);
            [data, statusCode] = await authorize(
              authcode.GET_RESOURCE,
              clitoken,
              token,
              async (id) =>
                await getResources(page, limit, params.searchText, client_id)
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
          authcode.ADD_RESOURCE,
          clitoken,
          token,
          async (id, client_id) => await addResource(body, id, client_id)
        );
        break;
      case "DELETE":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          authcode.DELETE_RESOURCE,
          clitoken,
          token,
          async (id, client_id) => await deleteResource(body.id, client_id)
        );
        break;
      case "PUT":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          authcode.UPDATE_RESOURCE,
          clitoken,
          token,
          async (id, client_id) => await updateResource(body, client_id)
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

async function getResources(page = 1, limit = 10, searchText = "", client_id) {
  let offset = (page - 1) * limit;
  let data;
  if (searchText === "") {
    data = await db.any(
      `SELECT *, count(*) OVER() AS full_count FROM ${client_id}_resources ORDER BY name OFFSET $1 LIMIT $2`,
      [offset, limit]
    );
  } else {
    searchText = `%${searchText}%`;
    data = await db.any(
      `SELECT *, count(*) OVER() AS full_count FROM ${client_id}_resources WHERE name iLIKE $1 OR type iLIKE $1 OR description iLIKE $1 ORDER BY name OFFSET $2 LIMIT $3`,
      [searchText, offset, limit]
    );
  }
  return [data, 200];
}

async function getResource(id, client_id) {
  let resource_id = parseInt(id);
  const data = await db.any(
    `SELECT * FROM ${client_id}_resources WHERE id = $1`,
    [resource_id]
  );
  return [data, 200];
}

async function addResource({ name, type, description }, createdBy, client_id) {
  if (!id || !name || !type || !createdBy || !description)
    throw new Error("Missing required fields");

  const date_now = new Date().toISOString();

  await db.none(
    `INSERT into ${client_id}_resources (name, type, description, createdBy, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5, $6)`,
    [name, type, description, createdBy, date_now, date_now]
  );

  return ["Resource Successfully Added", 200];
}

async function updateResource({ id, name, type, description }, client_id) {
  if (!id || !name || !type || !description)
    throw new Error("Missing required fields");

  const date_now = new Date().toISOString();

  await db.none(
    `UPDATE ${client_id}_resources SET name = $1, description = $2, type = $3, updatedAt = $4 WHERE id = $5`,
    [name, type, description, date_now, id]
  );

  return ["Resource Successfully Updatedbuilb", 200];
}

async function deleteResource(id, client_id) {
  let resource_id = parseInt(id);
  await db.none(`DELETE FROM ${client_id}_resources WHERE id = $1`, [
    resource_id,
  ]);
  return ["Resource Successfully Deleted", 200];
}

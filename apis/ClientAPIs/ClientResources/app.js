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
        if (event.pathParameters && event.pathParameters.id) {
          console.log(event.pathParameters.id);
          [data, statusCode] = await authorize(
            authcode.GET_RESOURCE,
            ip,
            useragent,
            token,
            async (username, client_id) =>
              await getResource(event.pathParameters.id, client_id)
          );
        } else if (event.queryStringParameters) {
          let params = event.queryStringParameters;
          if (params.page && params.limit) {
            page = parseInt(params.page);
            limit = parseInt(params.limit);
            [data, statusCode] = await authorize(
              authcode.GET_RESOURCE,
              ip,
              useragent,
              token,
              async (username, client_id) =>
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
          ip,
          useragent,
          token,
          async (username, client_id) =>
            await addResource(body, username, client_id)
        );
        break;
      case "DELETE":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          authcode.DELETE_RESOURCE,
          ip,
          useragent,
          token,
          async (username, client_id) =>
            await deleteResource(body.id, username, client_id)
        );
        break;
      case "PUT":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          authcode.UPDATE_RESOURCE,
          ip,
          useragent,
          token,
          async (username, client_id) =>
            await updateResource(body, username, client_id)
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
  if (!name || !type || !description || !createdBy)
    throw new Error("Missing required fields");

  const date_now = new Date().toISOString();

  await db.none(
    `INSERT into ${client_id}_resources (name, type, description, createdBy, updatedby, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $4, $5, $5)`,
    [name, type, description, createdBy, date_now]
  );
  await addclienttransaction(createdBy, client_id, "ADD_RESOURCE");
  return ["Resource Successfully Added", 200];
}

async function updateResource(
  { id, name, type, description },
  updatedby,
  client_id
) {
  if (!id || !name || !type || !description)
    throw new Error("Missing required fields");

  const date_now = new Date().toISOString();

  await db.none(
    `UPDATE ${client_id}_resources SET name = $1, description = $2, type = $3, updatedAt = $4, updatedby = $5 WHERE id = $6`,
    [name, type, description, date_now, updatedby, id]
  );
  await addclienttransaction(updatedby, client_id, "UPDATE_RESOURCE");
  return ["Resource Successfully Updated", 200];
}

async function deleteResource(id, deletedby, client_id) {
  let resource_id = parseInt(id);
  await db.none(`DELETE FROM ${client_id}_resources WHERE id = $1`, [
    resource_id,
  ]);
  await addclienttransaction(deletedby, client_id, "DELETE_RESOURCE");
  return ["Resource Successfully Deleted", 200];
}

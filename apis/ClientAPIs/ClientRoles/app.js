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
            authcode.GET_USER_ROLE,
            ip,
            useragent,
            token,
            async (username, client_id) =>
              await getClientRole(event.pathParameters.id, client_id)
          );
        } else if (event.queryStringParameters) {
          let params = event.queryStringParameters;
          if (params.page && params.limit) {
            page = parseInt(params.page);
            limit = parseInt(params.limit);
            [data, statusCode] = await authorize(
              authcode.GET_USER_ROLE,
              ip,
              useragent,
              token,
              async (username) =>
                await getClientRoles(page, limit, params.searchText, client_id)
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
          authcode.ADD_USER_ROLE,
          ip,
          useragent,
          token,
          async (username, client_id) =>
            await addClientRole(body, username, client_id)
        );
        break;

      case "PUT":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          authcode.UPDATE_USER_ROLE,
          ip,
          useragent,
          token,
          async (username, client_id) =>
            await updateClientRole(body, username, client_id)
        );
        break;

      case "DELETE":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          authcode.DELETE_USER_ROLE,
          ip,
          useragent,
          token,
          async (username, client_id) =>
            await deleteClientRole(body.id, username, client_id)
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

async function getClientRoles(
  page = 1,
  limit = 10,
  searchText = "",
  client_id
) {
  let offset = (page - 1) * limit;
  let data;
  if (searchText === "") {
    data = await db.any(
      `SELECT *, count(*) OVER() AS full_count FROM ${client_id}_user_roles ORDER BY role OFFSET $1 LIMIT $2`,
      [offset, limit]
    );
  } else {
    searchText = `%${searchText}%`;
    data = await db.any(
      `SELECT *, count(*) OVER() AS full_count FROM ${client_id}_user_roles WHERE role iLIKE $1  ORDER BY role OFFSET $2 LIMIT $3`,
      [searchText, offset, limit]
    );
  }
  return [data, 200];
}

async function getClientRole(id, client_id) {
  let role_id = parseInt(id);
  const data = await db.any(
    `SELECT * FROM ${client_id}_user_roles WHERE id = $1`,
    [role_id]
  );
  return [data, 200];
}

async function addClientRole({ role, authorizations }, createdBy, client_id) {
  if (!role || !createdBy) throw new Error("Missing required fields");

  const date_now = new Date().toISOString();

  let data = await db.one(
    `INSERT into ${client_id}_user_roles (role, authorizations, createdBy, updatedby, createdAt, updatedAt) VALUES ($1, $2, $3, $3, $4, $4) returning id`,
    [role, authorizations, createdBy, date_now]
  );
  await addclienttransaction(createdBy, client_id, "ADD_USER_ROLE");
  return [data, 200];
}

async function updateClientRole(
  { id, role, authorizations },
  updatedby,
  client_id
) {
  if (!id || !authorizations || !role)
    throw new Error("Missing required fields");

  const date_now = new Date().toISOString();

  await db.none(
    `UPDATE ${client_id}_user_roles SET role = $1, authorizations = $2, updatedAt = $3, updatedby = $4 WHERE id = $5`,
    [role, authorizations, date_now, updatedby, id]
  );
  await addclienttransaction(updatedby, client_id, "UPDATE_USER_ROLES");
  return ["Role Successfully Updated", 200];
}

async function deleteClientRole(id, deletedby, client_id) {
  let role_id = parseInt(id);
  await db.none(`DELETE FROM ${client_id}_user_roles WHERE id = $1`, [role_id]);
  await addclienttransaction(deletedby, client_id, "DELETE_USER_ROLE");
  return ["Role Successfully Deleted", 200];
}

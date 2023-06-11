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
            authcode.GET_USER_ROLE,
            clitoken,
            token,
            async (id, client_id) =>
              await getClientRole(event.pathParameters.id, client_id)
          );
        } else if (event.queryStringParameters) {
          let params = event.queryStringParameters;
          if (params.page && params.limit) {
            page = parseInt(params.page);
            limit = parseInt(params.limit);
            [data, statusCode] = await authorize(
              authcode.GET_USER_ROLE,
              clitoken,
              token,
              async (id) =>
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
          clitoken,
          token,
          async (id, client_id) => await addClientRole(body, id, client_id)
        );
        break;
      case "DELETE":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          authcode.DELETE_USER_ROLE,
          clitoken,
          token,
          async (id, client_id) => await deleteClientRole(body.id, client_id)
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

  await db.none(
    `INSERT into ${client_id}_user_roles (role, authorizations, createdBy, updatedby, createdAt, updatedAt) VALUES ($1, $2, $3, $3, $4, $5)`,
    [role, authorizations, createdBy, updatedby, date_now, date_now]
  );

  return ["Role Successfully Added", 200];
}

async function deleteClientRole(id, client_id) {
  let role_id = parseInt(id);
  await db.none(`DELETE FROM ${client_id}_user_roles WHERE id = $1`, [role_id]);
  return ["Role Successfully Deleted", 200];
}

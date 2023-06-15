const db = require("/opt/nodejs/utils/db.js");
const responseHandler = require("/opt/nodejs/utils/responseHandler.js");
const bcrypt = require("bcryptjs");
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
            authcode.GET_USER,
            ip,
            useragent,
            token,
            async (id, client_id) =>
              await getClientUser(event.pathParameters.id, client_id)
          );
        } else if (event.queryStringParameters) {
          let params = event.queryStringParameters;
          if (params.page && params.limit) {
            page = parseInt(params.page);
            limit = parseInt(params.limit);
            [data, statusCode] = await authorize(
              authcode.GET_USER,
              ip,
              useragent,
              token,
              async (id, client_id) =>
                await getClientUsers(page, limit, params.searchText, client_id)
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
          authcode.ADD_USER,
          ip,
          useragent,
          token,
          async (id, client_id) => await addClientUser(body, id, client_id)
        );
        break;

      case "PUT":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          authcode.UPDATE_USER,
          ip,
          useragent,
          token,
          async (id, client_id) => await updateClientUser(body, id, client_id)
        );
        break;

      case "DELETE":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          authcode.DELETE_USER,
          ip,
          useragent,
          token,
          async (id, client_id) =>
            await deleteClientUser(body.id, id, client_id)
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

async function getClientUsers(
  page = 1,
  limit = 10,
  searchText = "",
  client_id
) {
  let offset = (page - 1) * limit;
  let data;
  if (searchText === "") {
    data = await db.any(
      `SELECT cu.*, cr.role as rolename, count(cu.*) OVER() AS full_count FROM ${client_id}_users cu JOIN ${client_id}_user_roles cr ON cu.role = cr.id  ORDER BY cu.name OFFSET $1 LIMIT $2`,
      [offset, limit]
    );
  } else {
    searchText = `%${searchText}%`;
    data = await db.any(
      `SELECT cu.*, cr.role as rolename, count(cu.*) OVER() AS full_count FROM ${client_id}_users cu JOIN ${client_id}_user_roles cr ON cu.role = cr.id WHERE cu.name iLIKE $1 OR cu.username iLIKE $1 OR cr.role iLIKE $1  ORDER BY cu.name OFFSET $2 LIMIT $3`,
      [searchText, offset, limit]
    );
  }
  return [data, 200];
}

async function getClientUser(id, client_id) {
  let user_id = parseInt(id);
  const data = await db.any(
    `SELECT cu.*, cr.role as rolename FROM ${client_id}_users cu JOIN ${client_id}_user_roles cr ON cu.role = cr.id WHERE cu.id = $1`,
    [user_id]
  );
  return [data, 200];
}

async function addClientUser(
  { name, username, password = "123456", role },
  createdBy,
  client_id
) {
  if (!name || !username || !role || !createdBy)
    throw new Error("Missing required fields");

  const date_now = new Date().toISOString();
  const encryptedPassword = bcrypt.hashSync(password.trim(), 10);

  await db.none(
    `INSERT into ${client_id}_users (name, username, password, role, createdBy, updatedby, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5, $5, $6, $7)`,
    [name, username, encryptedPassword, role, createdBy, date_now, date_now]
  );
  await addclienttransaction(createdBy, client_id, "ADD_USER");
  return ["User Successfully Added", 200];
}

async function updateClientUser({ id, name, role }, updatedby, client_id) {
  if (!id || !name || !role) throw new Error("Missing required fields");

  const date_now = new Date().toISOString();

  await db.none(
    `UPDATE ${client_id}_users SET name = $1, role = $2, updatedAt = $3, updatedby = $4 WHERE id = $5`,
    [name, role, date_now, updatedby, id]
  );
  await addclienttransaction(updatedby, client_id, "UPDATE_USER");
  return ["User Successfully Updated", 200];
}

async function deleteClientUser(id, deletedby, client_id) {
  let user_id = parseInt(id);
  await db.none(`DELETE FROM ${client_id}_users WHERE id = $1`, [user_id]);
  await addclienttransaction(deletedby, client_id, "DELETE_USER");
  return ["User Successfully Deleted", 200];
}

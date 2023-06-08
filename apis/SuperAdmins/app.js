const db = require("/opt/nodejs/utils/db.js");
const responseHandler = require("/opt/nodejs/utils/responseHandler.js");
const bcrypt = require("bcryptjs");
const authorize = require("/opt/nodejs/utils/authorize.js");

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
            [],
            clitoken,
            token,
            async (id) => await getSuperAdmin(event.pathParameters.id),
            true
          );
        } else if (event.queryStringParameters) {
          let params = event.queryStringParameters;
          if (params.page && params.limit) {
            page = parseInt(params.page);
            limit = parseInt(params.limit);
            [data, statusCode] = await authorize(
              [],
              clitoken,
              token,
              async (id) =>
                await getSuperAdmins(page, limit, params.searchText),
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
          clitoken,
          token,
          async (id) => await addSuperAdmin(body, id),
          true
        );
        break;
      case "DELETE":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          [],
          clitoken,
          token,
          async (id) => await deleteSuperAdmin(body.id),
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

async function getSuperAdmins(page = 1, limit = 10, searchText = "") {
  let offset = (page - 1) * limit;
  let data;
  if (searchText === "") {
    data = await db.any(
      `SELECT sa.id as id, sa.name AS name, sa.username AS username, sa.role as role, count(sa.*) OVER() AS full_count FROM superadmins sa ORDER BY sa.name OFFSET $1 LIMIT $2`,
      [offset, limit]
    );
  } else {
    searchText = `%${searchText}%`;
    data = await db.any(
      `SELECT sa.id as id, sa.name AS name, sa.username AS username, sa.role as role, cli.name as client, count(sa.*) OVER() AS full_count FROM superadmins sa WHERE sa.name iLIKE $1 OR sa.username iLIKE $1 ORDER BY sa.name OFFSET $2 LIMIT $3`,
      [searchText, offset, limit]
    );
  }
  return [data, 200];
}

async function getSuperAdmin(id) {
  let sa_id = parseInt(id);
  const data = await db.any(
    "SELECT sa.id as id, sa.name as name, sa.username as username, sa.role as role, cli.name as client FROM superadmins sa WHERE sa.id = $1",
    [sa_id]
  );
  return [data, 200];
}

async function addSuperAdmin(
  { name, username, password = "123456" },
  createdBy
) {
  if (!name || !username || !createdBy)
    throw new Error("Missing required fields");

  const date_now = new Date().toISOString();
  const encryptedPassword = bcrypt.hashSync(password.trim(), 10);

  await db.none(
    "INSERT into superadmins (name, username, password,  createdBy, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5, $6)",
    [name, username, encryptedPassword, createdBy, date_now, date_now]
  );

  return ["Super Admin Successfully Added", 200];
}

async function deleteSuperAdmin(id) {
  let user_id = parseInt(id);
  await db.none("DELETE FROM superadmins WHERE id = $1", [user_id]);
  return ["Super Admin Successfully Deleted", 200];
}

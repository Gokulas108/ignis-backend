const db = require("/opt/nodejs/utils/db.js");
const responseHandler = require("/opt/nodejs/utils/responseHandler.js");
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
            async (id) => await getAHJ(event.pathParameters.id),
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
              async (id) => await getAHJs(page, limit, params.searchText),
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
          async (id) => await addAHJ(body, id),
          true
        );
        break;
      case "DELETE":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          [],
          clitoken,
          token,
          async (id) => await deleteAHJ(body.id),
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

async function getAHJs(page = 1, limit = 10, searchText = "") {
  let offset = (page - 1) * limit;
  let data;
  if (searchText === "") {
    data = await db.any(
      `SELECT ahj.* , sa.name as uname, sa.username as username ,count(ahj.*)  OVER() AS full_count FROM ahjs ahj JOIN superadmins sa ON ahj.createdby = sa.id ORDER BY ahj.name OFFSET $1 LIMIT $2`,
      [offset, limit]
    );
  } else {
    searchText = `%${searchText}%`;
    data = await db.any(
      `SELECT ahj.* , sa.name as uname, sa.username as username ,count(ahj.*)  OVER() AS full_count FROM ahjs ahj JOIN superadmins sa ON ahj.createdby = sa.id  WHERE ahj.name iLIKE $1 OR ahj.country iLIKE $1 ORDER BY ahj.name OFFSET $2 LIMIT $3`,
      [searchText, offset, limit]
    );
  }
  return [data, 200];
}

async function getAHJ(id) {
  let ahj_id = parseInt(id);
  const data = await db.any(
    "SELECT ahj.*, sa.name as uname, sa.username as username FROM ahjs ahj JOIN superadmins sa ON ahj.createdby = sa.id  WHERE id = $1",
    [ahj_id]
  );
  return [data, 200];
}

async function deleteAHJ(id) {
  let ahj_id = parseInt(id);
  await db.none("DELETE FROM ahjs WHERE id = $1", [ahj_id]);
  return ["AHJ Successfully Deleted", 200];
}

async function addAHJ({ name, country }, createdBy) {
  if (!name || !createdBy || !country)
    throw new Error("Missing required fields");

  const date_now = new Date().toISOString();

  await db.none(
    "INSERT into ahjs (name, country,  createdBy, updatedby, createdAt, updatedAt) VALUES ($1, $2, $3, $3, $4, $5)",
    [name, country, createdBy, date_now, date_now]
  );

  return ["AHJ Successfully Added", 200];
}

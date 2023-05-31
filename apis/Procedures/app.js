const db = require("/opt/nodejs/utils/db.js");
const responseHandler = require("/opt/nodejs/utils/responseHandler.js");
const authorize = require("/opt/nodejs/utils/authorize.js");

exports.lambdaHandler = async (event, context) => {
  let statusCode = 200;
  let data, body;
  let httpMethod = event.httpMethod;
  let token = event.headers["ignistoken"];

  try {
    switch (httpMethod) {
      case "OPTIONS":
        [data, statusCode] = ["Success", 200];
        break;
      case "GET":
        if (event.pathParameters && event.pathParameters.id) {
          console.log(event.pathParameters.id);
          [data, statusCode] = await getProcedure(event.pathParameters.id);
        } else if (event.queryStringParameters) {
          let params = event.queryStringParameters;
          if (params.page && params.limit && params.system) {
            system = parseInt(params.system);
            activity = params.activity;
            page = parseInt(params.page);
            limit = parseInt(params.limit);
            [data, statusCode] = await getProcedures(
              page,
              limit,
              params.searchText,
              system,
              activity
            );
          } else {
            throw new Error("Missing System, Activity, Page or Limit");
          }
        } else {
          throw new Error("Missing ID");
        }
        break;

      case "POST":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          ["admin"],
          token,
          async (id) => await addProcedure(body)
        );
        break;

      case "PUT":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          ["admin"],
          token,
          async (id) => await updateProcedureFields(body)
        );
        break;

      case "DELETE":
        body = JSON.parse(event.body);
        [data, statusCode] = await deleteProcedure(body.id);
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

async function getProcedures(
  page = 1,
  limit = 10,
  searchText = "",
  system,
  activity
) {
  if (!system) throw new Error("Missing System");
  if (!activity) throw new Error("Missing Activity");

  let offset = (page - 1) * limit;
  let data;
  if (searchText === "") {
    data = await db.any(
      `SELECT *, count(*) OVER() AS full_count FROM procedures WHERE system = $1 AND activity = $2 ORDER BY code  OFFSET $3 LIMIT $4`,
      [system, activity, offset, limit]
    );
  } else {
    searchText = `%${searchText}%`;
    data = await db.any(
      `SELECT *, count(*) OVER() AS full_count FROM procedures WHERE system = $1 AND activity = $2 OR procedure iLIKE $5 OR id  iLIKE $5  ORDER BY code OFFSET $3 LIMIT $4`,
      [system, activity, offset, limit, searchText]
    );
  }
  return [data, 200];
}

async function getProcedure(id) {
  let p_id = parseInt(id);
  const data = await db.any(`SELECT * FROM procedures WHERE id = $1`, [p_id]);
  return [data, 200];
}

async function deleteProcedure(id) {
  let p_id = parseInt(id);
  await db.none("DELETE FROM procedures WHERE id = $1", [p_id]);
  return ["Procedure Successfully Deleted", 200];
}

async function addProcedure({
  code,
  procedure,
  system,
  devices,
  activity,
  createdBy = 1,
}) {
  if (!code || !createdBy || !system || !activity || !devices)
    throw new Error("Missing required fields");
  const date_now = new Date().toISOString();

  await db.none(
    "INSERT into procedures (code, procedure, system, devices, activity, createdBy, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    [code, procedure, system, devices, activity, createdBy, date_now, date_now]
  );

  return ["Procedure Successfully Added", 200];
}

async function updateProcedureFields({ id, devices }) {
  if (!id) throw new Error("Missing Id");
  const date_now = new Date().toISOString();

  const query =
    "UPDATE procedures SET devices = $1::json[], updatedat = $2 WHERE id = $3";
  await db.none(query, [devices, date_now, id]);

  return ["Procedure Devices Updated", 200];
}

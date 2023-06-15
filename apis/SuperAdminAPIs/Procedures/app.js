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
            async (id) => await getProcedure(event.pathParameters.id),
            true
          );
        } else if (event.queryStringParameters) {
          let params = event.queryStringParameters;
          if (
            params.page &&
            params.limit &&
            params.system &&
            params.activity &&
            params.ahj
          ) {
            system = parseInt(params.system);
            activity = params.activity;
            page = parseInt(params.page);
            limit = parseInt(params.limit);
            ahj = parseInt(params.ahj);
            [data, statusCode] = await authorize(
              [],
              ip,
              useragent,
              token,
              async (id) =>
                await getProcedures(
                  page,
                  limit,
                  params.searchText,
                  system,
                  activity,
                  ahj
                ),
              true
            );
          } else {
            throw new Error("Missing System, Activity, AHJ, Page or Limit");
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
          async (id) => await addProcedure(body),
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
          async (id) => await updateProcedureFields(body, id),
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
          async (id) => await deleteProcedure(body.id),
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

async function getProcedures(
  page = 1,
  limit = 10,
  searchText = "",
  system,
  activity,
  ahj
) {
  if (!ahj) throw new Error("Missing AHJ");
  if (!system) throw new Error("Missing System");
  if (!activity) throw new Error("Missing Activity");

  let offset = (page - 1) * limit;
  let data;
  if (searchText === "") {
    data = await db.any(
      `SELECT *, count(*) OVER() AS full_count FROM procedures WHERE system = $1 AND activity = $2 AND ahj = $3 ORDER BY code  OFFSET $4 LIMIT $5`,
      [system, activity, ahj, offset, limit]
    );
  } else {
    searchText = `%${searchText}%`;
    data = await db.any(
      `SELECT *, count(*) OVER() AS full_count FROM procedures WHERE system = $1 AND activity = $2 AND ahj = $3 OR procedure iLIKE $4 OR id  iLIKE $4  ORDER BY code OFFSET $5 LIMIT $6`,
      [system, activity, ahj, searchText, offset, limit]
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
  ahj,
  code,
  procedure,
  system,
  devices,
  activity,
  createdBy = 1,
}) {
  if (!code || !createdBy || !system || !activity || !devices || !ahj)
    throw new Error("Missing required fields");
  const date_now = new Date().toISOString();

  await db.none(
    "INSERT into procedures (ahj, code, procedure, system, devices, activity, createdBy, updatedby, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9)",
    [
      ahj,
      code,
      procedure,
      system,
      devices,
      activity,
      createdBy,
      date_now,
      date_now,
    ]
  );

  return ["Procedure Successfully Added", 200];
}

async function updateProcedureFields({ id, devices }, updatedby) {
  if (!id) throw new Error("Missing Id");
  const date_now = new Date().toISOString();

  const query =
    "UPDATE procedures SET devices = $1, updatedat = $2, updatedby = $3 WHERE id = $4";
  await db.none(query, [devices, date_now, updatedby, id]);

  return ["Procedure Devices Updated", 200];
}

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
            async (id) => await getDevice(event.pathParameters.id),
            true
          );
        } else if (event.queryStringParameters) {
          let params = event.queryStringParameters;
          if (params.page && params.limit) {
            page = parseInt(params.page);
            limit = parseInt(params.limit);
            // if (event.headers["ignistoken"])
            [data, statusCode] = await authorize(
              [],
              clitoken,
              token,
              async (id) =>
                getDevices(
                  page,
                  limit,
                  params.searchText,
                  event.headers["ignistoken"]
                ),
              true
            );
            // else throw new Error("Missing Token");
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
          async (id) => addDevice(body, id),
          true
        );
        break;
      case "PUT":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          [],
          token,
          async (id) => updateDevice(body),
          true
        );
        break;
      case "DELETE":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          [],
          token,
          async (id) => deleteDevice(body.id),
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

async function getDevices(
  page = 1,
  limit = 10,
  searchText = "",
  token = "123"
) {
  let offset = (page - 1) * limit;
  let data;
  if (searchText === "") {
    data = await db.any(
      `SELECT device.* , sa.name as uname, sa.username as username, sys.name as sysname, count(device.*) OVER() AS full_count FROM devicetypes device JOIN superadmins sa ON device.createdBy = sa.id JOIN systemtypes sys ON device.systemid = sys.id ORDER BY device.name OFFSET $1 LIMIT $2`,
      [offset, limit]
    );
  } else {
    searchText = `%${searchText}%`;
    data = await db.any(
      `SELECT device.* , sa.name as uname, sa.username as username, sys.name as sysname, count(device.*) OVER() AS full_count FROM devicetypes device JOIN superadmins sa ON device.createdBy = sa.id JOIN systemtypes sys ON device.systemid = sys.id WHERE device.name iLIKE $1 OR user.name iLIKE $1 OR user.username iLIKE $1  OR sys.name iLIKE $1 ORDER BY device.name OFFSET $2 LIMIT $3`,
      [searchText, offset, limit]
    );
  }
  return [data, 200];
}

async function getDevice(id) {
  let device_id = parseInt(id);
  const data = await db.any(
    "SELECT device.*, sa.name as uname, sa.username, sys.name as sysname FROM devicetypes device JOIN superadmins sa ON device.createdBy= sa.id JOIN systemtypes sys ON device.systemid = sys.id WHERE device.id = $1",
    [device_id]
  );
  return [data, 200];
}

async function deleteDevice(id) {
  let device_id = parseInt(id);
  await db.none("DELETE FROM devicetypes WHERE id = $1", [device_id]);
  return ["Device Successfully Deleted", 200];
}

async function addDevice(
  {
    name,
    systemid,
    general_fields,
    inspection_fields,
    testing_fields,
    maintenance_fields,
  },
  createdBy
) {
  if (!name || !systemid || !createdBy)
    throw new Error("Missing required fields");

  const date_now = new Date().toISOString();

  await db.none(
    "INSERT into devicetypes (name, systemid, general_fields, inspection_fields ,testing_fields, maintenance_fields, createdBy, createdAt, updatedAt) VALUES ($1, $2, $3::json[], $4::json[], $5::json[],$6::json[], $7, $8, $9)",
    [
      name,
      systemid,
      general_fields,
      inspection_fields,
      testing_fields,
      maintenance_fields,
      createdBy,
      date_now,
      date_now,
    ]
  );

  return ["Device Successfully Added", 200];
}

async function updateDevice({
  id,
  general_fields,
  inspection_fields,
  testing_fields,
  maintenance_fields,
}) {
  const date_now = new Date().toISOString();

  await db.none(
    "UPDATE devicetypes SET general_fields =  $1::json[], inspection_fields = $2::json[] ,testing_fields = $3::json[] ,maintenance_fields = $4::json[] , updatedAt = $5 WHERE id = $6 ",
    [
      general_fields,
      inspection_fields,
      testing_fields,
      maintenance_fields,
      date_now,
      id,
    ]
  );

  return ["Device Successfully Updated", 200];
}

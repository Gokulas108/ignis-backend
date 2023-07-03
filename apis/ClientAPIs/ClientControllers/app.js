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
            authcode.GET_BUILDING_CONTROLLER,
            ip,
            useragent,
            token,
            async (username, client_id) =>
              await getBuildingController(event.pathParameters.id, client_id)
          );
        } else if (event.queryStringParameters) {
          let params = event.queryStringParameters;
          if (params.page && params.limit) {
            page = parseInt(params.page);
            limit = parseInt(params.limit);
            [data, statusCode] = await authorize(
              authcode.GET_BUILDING_CONTROLLER,
              ip,
              useragent,
              token,
              async (username, client_id) =>
                await getBuildingControllers(
                  page,
                  limit,
                  params.searchText,
                  client_id
                )
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
          authcode.ADD_BUILDING_CONTROLLER,
          ip,
          useragent,
          token,
          async (username, client_id) =>
            await addBuildingController(body, username, client_id)
        );
        break;
      case "DELETE":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          authcode.DELETE_BUILDING_CONTROLLER,
          ip,
          useragent,
          token,
          async (username, client_id) =>
            await deleteBuildingController(body.id, username, client_id)
        );
        break;
      case "PUT":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          authcode.UPDATE_BUILDING_CONTROLLER,
          ip,
          useragent,
          token,
          async (username, client_id) =>
            await updateBuildingController(body, username, client_id)
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

async function getBuildingControllers(
  page = 1,
  limit = 10,
  searchText = "",
  client_id
) {
  let offset = (page - 1) * limit;
  let data;
  if (searchText === "") {
    data = await db.any(
      `SELECT *, count(*) OVER() AS full_count FROM ${client_id}_building_controllers ORDER BY id OFFSET $1 LIMIT $2`,
      [offset, limit]
    );
  } else {
    searchText = `%${searchText}%`;
    data = await db.any(
      `SELECT *, count(*) OVER() AS full_count FROM ${client_id}_building_controllers WHERE id iLIKE $1 ORDER BY id OFFSET $2 LIMIT $3`,
      [searchText, offset, limit]
    );
  }
  return [data, 200];
}

async function getBuildingController(id, client_id) {
  let building_controller_id = parseInt(id);
  const data = await db.any(
    `SELECT * FROM ${client_id}_building_controllers WHERE id = $1`,
    [building_controller_id]
  );
  return [data, 200];
}

async function addBuildingController(
  { id, assigned_users },
  createdBy,
  client_id
) {
  if (!id) throw new Error("Missing required fields");

  const date_now = new Date().toISOString();

  await db.none(
    `INSERT into ${client_id}_building_controllers (id, assigned_users, createdBy, updatedby, createdAt, updatedAt) VALUES ($1, $2, $3, $3, $4, $4)`,
    [id, assigned_users, createdBy, date_now]
  );
  await addclienttransaction(createdBy, client_id, "ADD_BUILDING_CONTROLLER");
  return ["BuildingController Successfully Added", 200];
}

async function updateBuildingController(
  { id, assigned_users },
  updatedby,
  client_id
) {
  if (!id) throw new Error("Missing required fields");

  const date_now = new Date().toISOString();

  await db.none(
    `UPDATE ${client_id}_building_controllers SET assigned_users = $1, updatedAt = $2, updatedby = $3 WHERE id = $4`,
    [assigned_users, date_now, updatedby, id]
  );
  await addclienttransaction(
    updatedby,
    client_id,
    "UPDATE_BUILDING_CONTROLLER"
  );
  return ["BuildingController Successfully Updated", 200];
}

async function deleteBuildingController(id, deletedby, client_id) {
  let building_controller_id = parseInt(id);
  await db.none(`DELETE FROM ${client_id}_building_controllers WHERE id = $1`, [
    building_controller_id,
  ]);
  await addclienttransaction(
    deletedby,
    client_id,
    "DELETE_BUILDING_CONTROLLER"
  );
  return ["BuildingController Successfully Deleted", 200];
}

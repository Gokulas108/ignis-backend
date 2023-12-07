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
            authcode.GET_WORK_ORDER,
            ip,
            useragent,
            token,
            async (username, client_id) =>
              await getWorkOrder(event.pathParameters.id, client_id, username)
          );
        } else if (event.queryStringParameters) {
          let params = event.queryStringParameters;
          if (params.page && params.limit) {
            page = parseInt(params.page);
            limit = parseInt(params.limit);
            [data, statusCode] = await authorize(
              authcode.GET_WORK_ORDER,
              ip,
              useragent,
              token,
              async (username, client_id) =>
                await getWorkOrders(
                  page,
                  limit,
                  params.searchText,
                  params.status,
                  username,
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

async function getWorkOrders(
  page = 1,
  limit = 10,
  searchText = "",
  status,
  username,
  client_id
) {
  let offset = (page - 1) * limit;
  let data;
  if (searchText === "") {
    data = await db.any(
      `SELECT wo.id,  wo.wo_start, wo.wo_end, noti.type,  noti.id AS notification_id, sys.name, bld.building_name, count(wo.*) OVER() AS full_count FROM ${client_id}_workorders wo JOIN ${client_id}_notifications noti ON wo.notification_id = noti.id JOIN ${client_id}_systems sys ON noti.system_id = sys.id JOIN ${client_id}_buildings bld ON sys.building_id = bld.id WHERE wo.lead_executor = $1 AND wo.status = $2 ORDER BY wo.id DESC OFFSET $3 LIMIT $4`,
      [username, status, offset, limit]
    );
  } else {
    searchText = `%${searchText}%`;
    data = await db.any(
      `SELECT wo.id, wo.wo_start, wo.wo_end, noti.type, noti.id AS notification_id, sys.name, bld.building_name, count(wo.*) OVER() AS full_count FROM ${client_id}_workorders wo JOIN ${client_id}_notifications noti ON wo.notification_id = noti.id JOIN ${client_id}_systems sys ON noti.system_id = sys.id JOIN ${client_id}_buildings bld ON sys.building_id = bld.id WHERE wo.lead_executor = $1 AND wo.status = $2 AND (wo.id LIKE $3 OR sys.name iLIKE $3 OR bld.building_name iLIKE $3 OR noti.id LIKE $3)  ORDER BY wo.id DESC OFFSET $4 LIMIT $5`,
      [username, status, searchText, offset, limit]
    );
  }
  return [data, 200];
}

async function getWorkOrder(id, client_id, username) {
  let workorder_id = parseInt(id);
  const data = await db.one(
    `SELECT wo.*, noti.*, sys.*, bld.*, wo.status AS wo_status, noti.type AS notification_type FROM ${client_id}_workorders wo JOIN ${client_id}_notifications noti ON wo.notification_id = noti.id JOIN ${client_id}_systems sys ON noti.system_id = sys.id JOIN ${client_id}_buildings bld ON sys.building_id = bld.id  WHERE wo.id = $1`,
    [workorder_id]
  );
  const employees = await db.any(
    `SELECT id, full_name FROM ${client_id}_employees WHERE id = ANY($1)`,
    [data.employees]
  );
  const resources = await db.any(
    `SELECT id, name FROM ${client_id}_resources WHERE id = ANY($1)`,
    [data.resources]
  );
  const message_count = await db.one(
    `SELECT count(*) FROM ${client_id}_messages WHERE wo_id = $1 AND seen = $2 AND createdby != $3`,
    [workorder_id, false, username]
  );

  return [{ data, employees, resources, message_count }, 200];
}

const db = require("/opt/nodejs/utils/db.js");
const responseHandler = require("/opt/nodejs/utils/responseHandler.js");
const authorize = require("/opt/nodejs/utils/authorize.js");
const authcode = require("/opt/nodejs/utils/accessCodes.js");
const addclienttransaction = require("/opt/nodejs/utils/clientTransactions.js");
const obdbinsert = require("/opt/nodejs/utils/obdbInsert.js");
const obdbupdate = require("/opt/nodejs/utils/obdbUpdate.js");

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
      case "POST":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          authcode.ADD_WORK_ORDER,
          ip,
          useragent,
          token,
          async (username, client_id) =>
            await addWorkOrder(body, username, client_id)
        );
        break;
      case "DELETE":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          authcode.DELETE_WORK_ORDER,
          ip,
          useragent,
          token,
          async (username, client_id) =>
            await deleteWorkOrder(body.id, username, client_id)
        );
        break;
      case "PUT":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          authcode.UPDATE_WORK_ORDER,
          ip,
          useragent,
          token,
          async (username, client_id) =>
            await updateWorkOrder(body, username, client_id)
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

async function getWorkOrders(
  page = 1,
  limit = 10,
  searchText = "",

  username,
  client_id
) {
  let offset = (page - 1) * limit;
  let data;
  if (searchText === "") {
    data = await db.any(
      `SELECT wo.*, noti.id AS notification_id, sys.name, bld.building_name, count(wo.*) OVER() AS full_count FROM ${client_id}_workorders wo JOIN ${client_id}_notifications noti ON wo.notification_id = noti.id JOIN ${client_id}_systems sys ON noti.system_id = sys.id JOIN ${client_id}_building_controllers blc ON noti.building_controller = blc.id JOIN ${client_id}_buildings bld ON sys.building_id = bld.id WHERE $1 = ANY(blc.assigned_users)   ORDER BY wo.id DESC OFFSET $2 LIMIT $3`,
      [username, offset, limit]
    );
  } else {
    searchText = `%${searchText}%`;
    data = await db.any(
      `SELECT wo.*, noti.id AS notification_id, sys.name, bld.building_name, count(wo.*) OVER() AS full_count FROM ${client_id}_workorders wo JOIN ${client_id}_notifications noti ON wo.notification_id = noti.id JOIN ${client_id}_systems sys ON noti.system_id = sys.id JOIN ${client_id}_building_controllers blc ON noti.building_controller = blc.id  JOIN ${client_id}_buildings bld ON sys.building_id = bld.id WHERE $1 = ANY(blc.assigned_users) AND (wo.id LIKE $2 OR sys.name iLIKE $2 OR bld.building_name iLIKE $2 OR noti.id LIKE $2)  ORDER BY wo.id DESC OFFSET $3 LIMIT $4`,
      [username, searchText, offset, limit]
    );
  }
  return [data, 200];
}

async function getWorkOrder(id, client_id, username) {
  let workorder_id = parseInt(id);
  const data = await db.one(
    `SELECT wo.* AS workorder, noti.* AS notification, sys.* AS system, bld.* AS building, cu.name AS leadexecutor_name FROM ${client_id}_workorders wo JOIN ${client_id}_users cu ON wo.lead_executor = cu.username  JOIN ${client_id}_notifications noti ON wo.notification_id = noti.id JOIN ${client_id}_systems sys ON noti.system_id = sys.id JOIN ${client_id}_buildings bld ON sys.building_id = bld.id  WHERE wo.id = $1`,
    [workorder_id]
  );

  const message_count = await db.one(
    `SELECT count(*) FROM ${client_id}_messages WHERE wo_id = $1 AND seen = $2 AND createdby != $3`,
    [workorder_id, false, username]
  );

  const employees = await db.any(
    `SELECT id, full_name FROM ${client_id}_employees WHERE id = ANY($1)`,
    [data.employees]
  );
  const resources = await db.any(
    `SELECT id, name FROM ${client_id}_resources WHERE id = ANY($1)`,
    [data.resources]
  );
  return [{ data, employees, resources, message_count }, 200];
}

async function addWorkOrder(data, createdBy, client_id) {
  const date_now = new Date().toISOString();
  let [sql_stmt, col_values] = obdbinsert(data, client_id, "workorders");
  const workorder = await db.one(`${sql_stmt} RETURNING id`, [
    ...col_values,
    createdBy,
    createdBy,
    date_now,
    date_now,
  ]);
  await addclienttransaction(createdBy, client_id, "ADD_WORK_ORDER");
  return [workorder, 200];
}

async function updateWorkOrder({ id, data }, updatedby, client_id) {
  const date_now = new Date().toISOString();
  let [sql_stmt, col_values] = obdbupdate(data, client_id, "workorders");
  await db.none(sql_stmt, [...col_values, updatedby, date_now, id]);
  await addclienttransaction(updatedby, client_id, "UPDATE_WORK_ORDER");
  return ["WorkOrder Successfully Updated", 200];
}

async function deleteWorkOrder(id, deletedby, client_id) {
  let workorder_id = parseInt(id);
  await db.none(`DELETE FROM ${client_id}_workorders WHERE id = $1`, [
    workorder_id,
  ]);
  await addclienttransaction(deletedby, client_id, "DELETE_WORK_ORDER");
  return ["WorkOrder Successfully Deleted", 200];
}

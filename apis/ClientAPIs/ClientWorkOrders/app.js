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
              await getWorkOrder(event.pathParameters.id, client_id)
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
                await getWorkOrders(page, limit, params.searchText, client_id)
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

async function getWorkOrders(page = 1, limit = 10, searchText = "", client_id) {
  let offset = (page - 1) * limit;
  let data;
  if (searchText === "") {
    data = await db.any(
      `SELECT *, count(*) OVER() AS full_count FROM ${client_id}_workorders ORDER BY id OFFSET $1 LIMIT $2`,
      [offset, limit]
    );
  } else {
    searchText = `%${searchText}%`;
    data = await db.any(
      `SELECT *, count(*) OVER() AS full_count FROM ${client_id}_workorders WHERE id iLIKE $1 OR notification_id iLIKE $1 OR remarks iLIKE $1 ORDER BY id OFFSET $2 LIMIT $3`,
      [searchText, offset, limit]
    );
  }
  return [data, 200];
}

async function getWorkOrder(id, client_id) {
  let workorder_id = parseInt(id);
  const data = await db.any(
    `SELECT * FROM ${client_id}_workorders WHERE id = $1`,
    [workorder_id]
  );
  return [data, 200];
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

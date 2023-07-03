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
            authcode.GET_NOTIFICATION,
            ip,
            useragent,
            token,
            async (username, client_id) =>
              await getNotification(event.pathParameters.id, client_id)
          );
        } else if (event.queryStringParameters) {
          let params = event.queryStringParameters;
          if (params.page && params.limit) {
            page = parseInt(params.page);
            limit = parseInt(params.limit);
            [data, statusCode] = await authorize(
              authcode.GET_NOTIFICATION,
              ip,
              useragent,
              token,
              async (username, client_id) =>
                await getNotifications(
                  page,
                  limit,
                  params.searchText,
                  client_id,
                  username
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
          authcode.ADD_NOTIFICATION,
          ip,
          useragent,
          token,
          async (username, client_id) =>
            await addNotification(body, username, client_id)
        );
        break;
      case "DELETE":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          authcode.DELETE_NOTIFICATION,
          ip,
          useragent,
          token,
          async (username, client_id) =>
            await deleteNotification(body.id, username, client_id)
        );
        break;
      case "PUT":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          authcode.UPDATE_NOTIFICATION,
          ip,
          useragent,
          token,
          async (username, client_id) =>
            await updateNotification(body, username, client_id)
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

async function getNotifications(
  page = 1,
  limit = 10,
  searchText = "",
  client_id,
  username
) {
  let offset = (page - 1) * limit;
  let data;
  if (searchText === "") {
    data = await db.any(
      `SELECT nt.*, sys.name as system_name, sys.tag as system_tag, count(nt.*) OVER() AS full_count FROM ${client_id}_notifications nt JOIN ${client_id}_systems sys ON nt.system_id = sys.id JOIN ${client_id}_building_controllers bc ON nt.building_controller = bc.id WHERE $1 = ANY(bc.assigned_users) ORDER BY nt.id OFFSET $2 LIMIT $3`,
      [username, offset, limit]
    );
  } else {
    searchText = `%${searchText}%`;
    data = await db.any(
      `SELECT nt.*, sys.name as system_name, sys.tag as system_tag, count(nt.*) OVER() AS full_count FROM ${client_id}_notifications nt JOIN ${client_id}_systems sys ON nt.system_id = sys.id JOIN ${client_id}_building_controllers bc ON nt.building_controller = bc.id WHERE $1 = ANY(bc.assigned_users) AND nt.description iLIKE $2 ORDER BY nt.id OFFSET $3 LIMIT $4`,
      [username, searchText, offset, limit]
    );
  }
  return [data, 200];
}

async function getNotification(id, client_id) {
  let notification_id = parseInt(id);
  const data = await db.any(
    `SELECT nt.*, sys.name as system_name, sys.tag as system_tag FROM ${client_id}_notifications nt JOIN ${client_id}_systems sys ON nt.system_id = sys.id WHERE nt.id = $1`,
    [notification_id]
  );
  return [data, 200];
}

async function addNotification(
  { description, type, status, system_id, asset_ids },
  createdBy,
  client_id
) {
  const date_now = new Date().toISOString();

  const notification = await db.one(
    `INSERT INTO ${client_id}_notifications (description, type, status, system_id, contract_id, building_controller, asset_ids, createdby, createdat) VALUES ($1, $2, $3, $4, ( SELECT current_contract FROM ${client_id}_systems WHERE id = $4 ), ( SELECT bld.building_controller FROM ${client_id}_buildings bld JOIN ${client_id}_systems sys ON bld.id = sys.building_id  WHERE sys.id = $4 ), $5, $6, $7) RETURNING id`,
    [description, type, status, system_id, asset_ids, createdBy, date_now]
  );
  await addclienttransaction(createdBy, client_id, "ADD_NOTIFICATION");
  return [notification, 200];
}

async function updateNotification({ id, data }, updatedby, client_id) {
  const date_now = new Date().toISOString();
  let [sql_stmt, col_values] = obdbupdate(data, client_id, "notifications");
  await db.none(sql_stmt, [...col_values, updatedby, date_now, id]);
  await addclienttransaction(updatedby, client_id, "UPDATE_NOTIFICATION");
  return ["Notification Successfully Updated", 200];
}

async function deleteNotification(id, deletedby, client_id) {
  let notification_id = parseInt(id);
  await db.none(`DELETE FROM ${client_id}_notifications WHERE id = $1`, [
    notification_id,
  ]);
  await addclienttransaction(deletedby, client_id, "DELETE_NOTIFICATION");
  return ["Notification Successfully Deleted", 200];
}

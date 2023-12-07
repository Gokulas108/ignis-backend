const db = require("/opt/nodejs/utils/db.js");
const responseHandler = require("/opt/nodejs/utils/responseHandler.js");
const authorize = require("/opt/nodejs/utils/authorize.js");
const authcode = require("/opt/nodejs/utils/accessCodes.js");

exports.lambdaHandler = async (event, context) => {
  let statusCode = 200;
  let data;
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
        [data, statusCode] = await authorize(
          authcode.GET_WORK_ORDER,
          ip,
          useragent,
          token,
          async (username, client_id) => await getDashboard(client_id, username)
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

async function getDashboard(client_id, username) {
  data = await db.any(
    `SELECT status, COUNT(*) FROM ${client_id}_workorders WHERE lead_executor = $1 GROUP BY status`,
    [username]
  );

  events = await db.any(
    `SELECT wo.id, wo.wo_start, wo.wo_end,wo.status,sys.name, bld.building_name FROM ${client_id}_workorders wo JOIN ${client_id}_notifications noti ON wo.notification_id = noti.id JOIN ${client_id}_systems sys ON noti.system_id = sys.id JOIN ${client_id}_buildings bld ON sys.building_id = bld.id  WHERE wo.lead_executor = $1 AND (wo.status = $2 OR wo.status =$3 OR wo.status =$4)`,
    [username, "Pending", "In Progress", "Completed"]
  );
  return [{ data, events }, 200];
}

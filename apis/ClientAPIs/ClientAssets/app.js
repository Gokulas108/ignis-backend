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
            authcode.GET_ASSET,
            ip,
            useragent,
            token,
            async (username, client_id) =>
              await getAsset(event.pathParameters.id, client_id)
          );
        } else if (event.queryStringParameters) {
          let params = event.queryStringParameters;
          if (params.page && params.limit) {
            page = parseInt(params.page);
            limit = parseInt(params.limit);
            [data, statusCode] = await authorize(
              authcode.GET_ASSET,
              ip,
              useragent,
              token,
              async (username, client_id) =>
                await getAssets(page, limit, params.searchText, client_id)
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
          authcode.ADD_ASSET,
          ip,
          useragent,
          token,
          async (username, client_id) =>
            await addAsset(body, username, client_id)
        );
        break;
      case "DELETE":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          authcode.DELETE_ASSET,
          ip,
          useragent,
          token,
          async (username, client_id) =>
            await deleteAsset(body.id, username, client_id)
        );
        break;
      case "PUT":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          authcode.UPDATE_ASSET,
          ip,
          useragent,
          token,
          async (username, client_id) =>
            await updateAsset(body, username, client_id)
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

async function getAssets(page = 1, limit = 10, searchText = "", client_id) {
  let offset = (page - 1) * limit;
  let data;
  if (searchText === "") {
    data = await db.any(
      `SELECT *, count(*) OVER() AS full_count FROM ${client_id}_assets ORDER BY name OFFSET $1 LIMIT $2`,
      [offset, limit]
    );
  } else {
    searchText = `%${searchText}%`;
    data = await db.any(
      `SELECT *, count(*) OVER() AS full_count FROM ${client_id}_assets WHERE name iLIKE $1 OR tag iLIKE $1 OR frequency iLIKE $1 ORDER BY name OFFSET $2 LIMIT $3`,
      [searchText, offset, limit]
    );
  }
  return [data, 200];
}

async function getAsset(id, client_id) {
  let asset_id = parseInt(id);
  const data = await db.any(`SELECT * FROM ${client_id}_assets WHERE id = $1`, [
    asset_id,
  ]);
  return [data, 200];
}

async function addAsset(data, createdBy, client_id) {
  const date_now = new Date().toISOString();
  let [sql_stmt, col_values] = obdbinsert(data, client_id, "assets");
  const asset = await db.one(`${sql_stmt} RETURNING id`, [
    ...col_values,
    createdBy,
    createdBy,
    date_now,
    date_now,
  ]);
  await addclienttransaction(createdBy, client_id, "ADD_ASSET");
  return [asset, 200];
}

async function updateAsset({ id, data }, updatedby, client_id) {
  const date_now = new Date().toISOString();
  let [sql_stmt, col_values] = obdbupdate(data, client_id, "assets");
  await db.none(sql_stmt, [...col_values, updatedby, date_now, id]);
  await addclienttransaction(updatedby, client_id, "UPDATE_ASSET");
  return ["Asset Successfully Updated", 200];
}

async function deleteAsset(id, deletedby, client_id) {
  let asset_id = parseInt(id);
  await db.none(`DELETE FROM ${client_id}_assets WHERE id = $1`, [asset_id]);
  await addclienttransaction(deletedby, client_id, "DELETE_ASSET");
  return ["Asset Successfully Deleted", 200];
}

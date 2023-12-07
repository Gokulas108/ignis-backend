const db = require("/opt/nodejs/utils/db.js");
const responseHandler = require("/opt/nodejs/utils/responseHandler.js");
const authorize = require("/opt/nodejs/utils/authorize.js");
const authcode = require("/opt/nodejs/utils/accessCodes.js");
const obdbinsert = require("/opt/nodejs/utils/obdbInsert.js");
const obdbupdate = require("/opt/nodejs/utils/obdbUpdate.js");
const addclienttransaction = require("/opt/nodejs/utils/clientTransactions.js");
const preSignedURL = require("/opt/nodejs/utils/preSignedURL.js");

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
              await getAssets(event.pathParameters.id, client_id)
          );
        } else if (event.queryStringParameters) {
          let params = event.queryStringParameters;
          if (params.asset_id) {
            [data, statusCode] = await authorize(
              authcode.GET_WORK_ORDER,
              ip,
              useragent,
              token,
              async (username, client_id) =>
                await getAsset(params.asset_id, client_id)
            );
          } else {
            throw new Error("Missing Asset ID");
          }
        } else {
          throw new Error("Missing ID");
        }
        break;
      case "POST":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          authcode.TECHNICIAN,
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
            await deleteAsset(body, username, client_id)
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

async function getAssets(id, client_id) {
  let wo_id = parseInt(id);
  const assets = await db.one(
    `SELECT completed_assets, status FROM ${client_id}_workorders WHERE id = $1`,
    [wo_id]
  );
  let status = assets.status;
  const data = await db.any(
    `SELECT asset.id, asset.tag, device.name  FROM ${client_id}_assets asset JOIN devicetypes device ON asset.type_id = device.id WHERE asset.id = ANY($1)`,
    [assets.completed_assets]
  );

  return [{ data, status }, 200];
}

async function getAsset(asset_id, client_id) {
  let aid = parseInt(asset_id);
  const asset = await db.one(
    `SELECT asset.*, device.name FROM ${client_id}_assets asset JOIN devicetypes device ON asset.type_id = device.id WHERE asset.id = $1`,
    [aid]
  );
  const URL = !asset.image
    ? null
    : preSignedURL(JSON.stringify(asset.image).replace(/"/g, ""));
  const data = { ...asset, url: URL };

  return [data, 200];
}

async function addAsset({ id, data }, createdBy, client_id) {
  let wo_id = parseInt(id);
  const date_now = new Date().toISOString();
  let [sql_stmt, col_values] = obdbinsert(data, client_id, "assets");
  const asset = await db.one(`${sql_stmt} RETURNING id`, [
    ...col_values,
    createdBy,
    createdBy,
    date_now,
    date_now,
  ]);
  const assets = await db.one(
    `SELECT completed_assets FROM ${client_id}_workorders WHERE id = $1`,
    [wo_id]
  );
  let status;
  let completed_assets = !assets.completed_assets
    ? [].concat(asset.id)
    : [].concat(assets.completed_assets, asset.id);

  if (completed_assets.length != 0) status = "In Progress";
  else status = "Pending";
  await db.none(
    `UPDATE  ${client_id}_workorders SET completed_assets =$2, status = $3, updatedby =$4,updatedat =$5 WHERE id = $1`,
    [wo_id, completed_assets, status, createdBy, date_now]
  );
  await addclienttransaction(createdBy, client_id, "ADD_ASSET");
  return [asset, 200];
}

async function updateAsset({ id }, updatedby, client_id) {
  const date_now = new Date().toISOString();
  let wo_id = parseInt(id);

  await db.none(
    `UPDATE  ${client_id}_workorders SET  status = $2, updatedby =$3,updatedat =$4 WHERE id = $1`,
    [wo_id, "Completed", updatedby, date_now]
  );
  await addclienttransaction(updatedby, client_id, "UPDATE_ASSET");
  return ["Work Order Marked Completed", 200];
}

async function deleteAsset({ id, wo_id }, deletedby, client_id) {
  const date_now = new Date().toISOString();
  let asset_id = parseInt(id);
  let woid = parseInt(wo_id);
  const assets = await db.one(
    `SELECT completed_assets FROM ${client_id}_workorders WHERE id = $1`,
    [woid]
  );
  let status;
  let casset = assets.completed_assets;
  let index = casset.indexOf(asset_id);
  casset.splice(index, 1);
  let completed_assets = casset;
  if (completed_assets.length != 0) status = "In Progress";
  else status = "Pending";
  await db.none(
    `UPDATE  ${client_id}_workorders SET completed_assets =$2, status = $3, updatedby =$4,updatedat =$5 WHERE id = $1`,
    [woid, completed_assets, status, deletedby, date_now]
  );
  await db.none(`DELETE FROM ${client_id}_assets WHERE id = $1`, [asset_id]);
  await addclienttransaction(deletedby, client_id, "DELETE_ASSET");
  return ["Asset Successfully Deleted", 200];
}

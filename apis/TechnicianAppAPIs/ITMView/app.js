const db = require("/opt/nodejs/utils/db.js");
const responseHandler = require("/opt/nodejs/utils/responseHandler.js");
const authorize = require("/opt/nodejs/utils/authorize.js");
const authcode = require("/opt/nodejs/utils/accessCodes.js");
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
              await getITMAssets(event.pathParameters.id, client_id)
          );
        } else if (event.queryStringParameters) {
          let params = event.queryStringParameters;
          if (params.wo_id && params.asset_id) {
            [data, statusCode] = await authorize(
              authcode.GET_WORK_ORDER,
              ip,
              useragent,
              token,
              async (username, client_id) =>
                await getITMAsset(params.wo_id, params.asset_id, client_id)
            );
          } else {
            throw new Error("Missing WoID or AssetID");
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
            await resetITMAsset(body, username, client_id)
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

async function getITMAssets(id, client_id) {
  let wo_id = parseInt(id);
  const data = await db.any(`SELECT * FROM ${client_id}_ITM WHERE wo_id = $1`, [
    wo_id,
  ]);

  return [data, 200];
}

async function getITMAsset(wo_id, asset_id, client_id) {
  let wid = parseInt(wo_id);
  let aid = parseInt(asset_id);
  const asset = await db.one(
    `SELECT  * FROM ${client_id}_ITM asset WHERE wo_id = $1 AND asset_id = $2`,
    [wid, aid]
  );
  const URL = !asset.image
    ? null
    : preSignedURL(JSON.stringify(asset.image).replace(/"/g, ""));
  const data = { ...asset, url: URL };

  return [data, 200];
}

async function resetITMAsset({ wo_id, asset_id, itm_id }, username, client_id) {
  let status;
  const date_now = new Date().toISOString();
  const assets = await db.one(
    `SELECT pending_assets, completed_assets FROM ${client_id}_workorders WHERE id = $1`,
    [wo_id]
  );
  let casset = assets.completed_assets;
  let index = casset.indexOf(asset_id);
  casset.splice(index, 1);
  let completed_assets = casset;
  let pending_assets = !assets.pending_assets
    ? [].concat(asset_id)
    : [].concat(assets.pending_assets, asset_id);
  if (pending_assets.length === 0) status = "Completed";
  else if (completed_assets.length != 0) status = "In Progress";
  else status = "Pending";
  await db.none(
    `UPDATE  ${client_id}_workorders SET pending_assets =$2, completed_assets =$3, status = $4, updatedby =$5,updatedat =$6 WHERE id = $1`,
    [wo_id, pending_assets, completed_assets, status, username, date_now]
  );
  await db.none(`DELETE FROM ${client_id}_itm WHERE id = $1`, [itm_id]);

  return [
    "ITM Result has been Reset. Please record results again from Pending Assets!",
    200,
  ];
}

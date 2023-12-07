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
              await getAsset(event.pathParameters.id, client_id)
          );
        } else if (event.queryStringParameters) {
          let params = event.queryStringParameters;
          if (params.wo_id) {
            [data, statusCode] = await authorize(
              authcode.GET_WORK_ORDER,
              ip,
              useragent,
              token,
              async (username, client_id) =>
                await getAssets(params.wo_id, client_id)
            );
          } else {
            throw new Error("Missing WoID");
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
            await executeAsset(body, username, client_id)
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

async function getAssets(wo_id, client_id) {
  const assets = await db.one(
    `SELECT pending_assets, completed_assets FROM ${client_id}_workorders WHERE id = $1`,
    [wo_id]
  );
  let p_assets = !assets.pending_assets
    ? null
    : !assets.pending_assets.length
    ? null
    : assets.pending_assets.toString();

  let c_assets = !assets.completed_assets
    ? null
    : !assets.completed_assets.length
    ? null
    : assets.completed_assets.toString();

  const passet = await db.any(
    `SELECT asset.id, asset.tag, asset.image, asset.general_info, device.name FROM ${client_id}_assets asset JOIN devicetypes device ON asset.type_id = device.id WHERE asset.id IN (${p_assets}) ORDER BY asset.id`
  );
  const casset = await db.any(
    `SELECT asset.id, asset.tag, asset.image, asset.general_info, device.name FROM ${client_id}_assets asset JOIN devicetypes device ON asset.type_id = device.id WHERE asset.id IN (${c_assets}) ORDER BY asset.id`
  );
  const passets = passet.map((asset) => {
    const URL = !asset.image
      ? null
      : preSignedURL(JSON.stringify(asset.image).replace(/"/g, ""));
    return { ...asset, url: URL };
  });
  const cassets = casset.map((asset) => {
    const URL = !asset.image
      ? null
      : preSignedURL(JSON.stringify(asset.image).replace(/"/g, ""));
    return { ...asset, url: URL };
  });
  return [{ passets, cassets }, 200];
}

async function getAsset(id, client_id) {
  let asset_id = parseInt(id);
  const data = await db.one(
    `SELECT  asset.id, asset.general_info, device.inspection_fields, device.testing_fields, device.maintenance_fields FROM ${client_id}_assets asset JOIN devicetypes device ON asset.type_id = device.id WHERE asset.id = $1`,
    [asset_id]
  );
  return [data, 200];
}

async function executeAsset(itmdata, username, client_id) {
  let wo_id = parseInt(itmdata.wo_id);
  let asset_id = parseInt(itmdata.asset_id);
  let status;
  const date_now = new Date().toISOString();
  const assets = await db.one(
    `SELECT pending_assets, completed_assets FROM ${client_id}_workorders WHERE id = $1`,
    [wo_id]
  );
  let passet = assets.pending_assets;
  let index = passet.indexOf(asset_id);
  passet.splice(index, 1);
  let pending_assets = passet;
  let completed_assets = !assets.completed_assets
    ? [].concat(asset_id)
    : [].concat(assets.completed_assets, asset_id);
  if (pending_assets.length === 0) status = "Completed";
  else if (completed_assets.length != 0) status = "In Progress";
  else status = "Pending";
  await db.none(
    `UPDATE  ${client_id}_workorders SET pending_assets =$2, completed_assets =$3, status = $4, updatedby =$5,updatedat =$6 WHERE id = $1`,
    [wo_id, pending_assets, completed_assets, status, username, date_now]
  );
  let data = await db.one(
    `INSERT INTO ${client_id}_itm (asset_id, wo_id, result, pass, remarks,image, createdat, updatedat, createdby, updatedby) VALUES ($1,$2,$3::json[],$4,$5,$6,$7,$7,$8,$8) RETURNING id`,
    [
      asset_id,
      wo_id,
      itmdata.result,
      itmdata.pass,
      itmdata.remarks,
      itmdata.image,
      date_now,
      username,
    ]
  );
  return [data, 200];
}

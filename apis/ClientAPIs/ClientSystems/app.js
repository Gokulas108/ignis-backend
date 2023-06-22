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
            authcode.GET_SYSTEM,
            ip,
            useragent,
            token,
            async (id, client_id) =>
              await getSystem(event.pathParameters.id, client_id)
          );
        } else if (event.queryStringParameters) {
          let params = event.queryStringParameters;
          if (params.page && params.limit) {
            page = parseInt(params.page);
            limit = parseInt(params.limit);
            [data, statusCode] = await authorize(
              authcode.GET_SYSTEM,
              ip,
              useragent,
              token,
              async (id, client_id) =>
                await getSystems(page, limit, params.searchText, client_id)
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
          authcode.ADD_SYSTEM,
          ip,
          useragent,
          token,
          async (id, client_id) => await addSystem(body, id, client_id)
        );
        break;
      case "DELETE":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          authcode.DELETE_SYSTEM,
          ip,
          useragent,
          token,
          async (id, client_id) => await deleteSystem(body.id, id, client_id)
        );
        break;
      case "PUT":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          authcode.UPDATE_SYSTEM,
          ip,
          useragent,
          token,
          async (id, client_id) => await updateSystem(body, id, client_id)
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

async function getSystems(page = 1, limit = 10, searchText = "", client_id) {
  let offset = (page - 1) * limit;
  let data;
  if (searchText === "") {
    data = await db.any(
      `SELECT cs.*, sys.name as systemtype, count(cs.*) OVER() AS full_count FROM ${client_id}_systems cs JOIN systemtypes sys ON cs.type = sys.id ORDER BY cs.id OFFSET $1 LIMIT $2`,
      [offset, limit]
    );
  } else {
    searchText = `%${searchText}%`;
    data = await db.any(
      `SELECT cs.*, sys.name as systemtype, count(cs.*) OVER() AS full_count FROM ${client_id}_systems cs JOIN systemtypes sys ON cs.type = sys.id WHERE cs.name iLIKE $1 OR cs.systemtype iLIKE $1 OR cs.tag iLIKE $1 OR cs.contract_id iLIKE $1 ORDER BY cs.id OFFSET $2 LIMIT $3`,
      [searchText, offset, limit]
    );
  }
  return [data, 200];
}

async function getSystem(id, client_id) {
  let system_id = parseInt(id);
  const cdata = await db.one(
    `SELECT * FROM ${client_id}_systems WHERE id = $1`,
    [system_id]
  );
  const bdata = await db.any(
    `SELECT * FROM ${client_id}_buildings WHERE id IN ($1)`,
    [cdata.building_ids.join()]
  );
  return [{ cdata, bdata }, 200];
}

async function addSystem({ data, contract_id }, createdBy, client_id) {
  const date_now = new Date().toISOString();
  let [sql_stmt, col_values] = obdbinsert(data, client_id, "systems");

  const system_id = await db.one(`${sql_stmt} RETURNING id`, [
    ...col_values,
    createdBy,
    createdBy,
    date_now,
    date_now,
  ]);
  if (contract_id) {
    await db.none(
      `INSERT INTO ${client_id}_system_contract (system_id, contract_id, createdby, createdat) VALUES ($1, $2, $3, $4)`,
      [system_id, contract_id, createdBy, date_now]
    );
    await db.none(
      `UPDATE ${client_id}_systems SET current_contract = $1, contract_status = ( SELECT status FROM ${client_id}_contracts WHERE id = $1 ) WHERE id = $2`,
      [contract_id, system_id]
    );
    await addclienttransaction(
      createdBy,
      client_id,
      "ADD_SYSTEM_WITH_CONTRACT"
    );
  } else await addclienttransaction(createdBy, client_id, "ADD_SYSTEM");
  return ["System Successfully Added", 200];
}

async function updateSystem({ id, data }, updatedby, client_id) {
  const date_now = new Date().toISOString();
  let [sql_stmt, col_values] = obdbupdate(id, data, client_id, "systems");
  await db.none(sql_stmt, [...col_values, updatedby, date_now]);
  await addclienttransaction(updatedby, client_id, "UPDATE_SYSTEM");
  return ["System Successfully Updated", 200];
}

async function deleteSystem(id, deletedby, client_id) {
  let system_id = parseInt(id);
  await db.none(`DELETE FROM ${client_id}_systems WHERE id = $1`, [system_id]);
  await addclienttransaction(deletedby, client_id, "DELETE_SYSTEM");
  return ["System Successfully Deleted", 200];
}

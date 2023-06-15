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
            authcode.GET_CONTRACT,
            ip,
            useragent,
            token,
            async (id, client_id) =>
              await getContract(event.pathParameters.id, client_id)
          );
        } else if (event.queryStringParameters) {
          let params = event.queryStringParameters;
          if (params.page && params.limit) {
            page = parseInt(params.page);
            limit = parseInt(params.limit);
            [data, statusCode] = await authorize(
              authcode.GET_CONTRACT,
              ip,
              useragent,
              token,
              async (id, client_id) =>
                await getContracts(page, limit, params.searchText, client_id)
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
          authcode.ADD_CONTRACT,
          ip,
          useragent,
          token,
          async (id, client_id) => await addContract(body, id, client_id)
        );
        break;
      case "DELETE":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          authcode.DELETE_CONTRACT,
          ip,
          useragent,
          token,
          async (id, client_id) => await deleteContract(body.id, id, client_id)
        );
        break;
      case "PUT":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          authcode.UPDATE_CONTRACT,
          ip,
          useragent,
          token,
          async (id, client_id) => await updateContract(body, id, client_id)
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

async function getContracts(page = 1, limit = 10, searchText = "", client_id) {
  let offset = (page - 1) * limit;
  let data;
  if (searchText === "") {
    data = await db.any(
      `SELECT *, count(*) OVER() AS full_count FROM ${client_id}_contracts ORDER BY id OFFSET $1 LIMIT $2`,
      [offset, limit]
    );
  } else {
    searchText = `%${searchText}%`;
    data = await db.any(
      `SELECT *, count(*) OVER() AS full_count FROM ${client_id}_contracts WHERE id iLIKE $1 OR title iLIKE $1 OR type iLIKE $1 OR fm_company iLIKE $1 ORDER BY contract_number OFFSET $2 LIMIT $3`,
      [searchText, offset, limit]
    );
  }
  return [data, 200];
}

async function getContract(id, client_id) {
  let contract_id = parseInt(id);
  const cdata = await db.one(
    `SELECT * FROM ${client_id}_contracts WHERE id = $1`,
    [contract_id]
  );
  const bdata = await db.any(
    `SELECT * FROM ${client_id}_buildings WHERE id IN ($1)`,
    [cdata.building_ids.join()]
  );
  return [{ cdata, bdata }, 200];
}

async function addContract(data, createdBy, client_id) {
  const date_now = new Date().toISOString();
  let [sql_stmt, col_values] = obdbinsert(data, client_id, "contracts");

  await db.none(sql_stmt, [
    ...col_values,
    createdBy,
    createdBy,
    date_now,
    date_now,
  ]);
  await addclienttransaction(createdBy, client_id, "ADD_CONTRACT");
  return ["Contract Successfully Added", 200];
}

async function updateContract({ id, data }, updatedby, client_id) {
  const date_now = new Date().toISOString();
  let [sql_stmt, col_values] = obdbupdate(id, data, client_id, "contracts");
  await db.none(sql_stmt, [...col_values, updatedby, date_now]);
  await addclienttransaction(updatedby, client_id, "UPDATE_CONTRACT");
  return ["Contract Successfully Updated", 200];
}

async function deleteContract(id, deletedby, client_id) {
  let contract_id = parseInt(id);
  await db.none(`DELETE FROM ${client_id}_contracts WHERE id = $1`, [
    contract_id,
  ]);
  await addclienttransaction(deletedby, client_id, "DELETE_CONTRACT");
  return ["Contract Successfully Deleted", 200];
}

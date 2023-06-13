const db = require("/opt/nodejs/utils/db.js");
const responseHandler = require("/opt/nodejs/utils/responseHandler.js");
const authorize = require("/opt/nodejs/utils/authorize.js");
const authcode = require("/opt/nodejs/utils/accessCodes.js");
const addclienttransaction = require("/opt/nodejs/utils/clientTransactions.js");

exports.lambdaHandler = async (event, context) => {
  let statusCode = 200;
  let data, body;
  let httpMethod = event.httpMethod;
  let token = event.headers["ignistoken"];
  let clitoken = event.headers["clienttoken"];

  try {
    switch (httpMethod) {
      case "OPTIONS":
        [data, statusCode] = ["Success", 200];
        break;
      case "GET":
        if (event.pathParameters && event.pathParameters.id) {
          console.log(event.pathParameters.id);
          [data, statusCode] = await authorize(
            authcode.GET_BUILDING,
            clitoken,
            token,
            async (id, client_id) =>
              await getBuilding(event.pathParameters.id, client_id)
          );
        } else if (event.queryStringParameters) {
          let params = event.queryStringParameters;
          if (params.page && params.limit) {
            page = parseInt(params.page);
            limit = parseInt(params.limit);
            [data, statusCode] = await authorize(
              authcode.GET_BUILDING,
              clitoken,
              token,
              async (id, client_id) =>
                await getBuildings(page, limit, params.searchText, client_id)
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
          authcode.ADD_BUILDING,
          clitoken,
          token,
          async (id, client_id) => await addBuilding(body, id, client_id)
        );
        break;
      case "DELETE":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          authcode.DELETE_BUILDING,
          clitoken,
          token,
          async (id, client_id) => await deleteBuilding(body.id, id, client_id)
        );
        break;
      case "PUT":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          authcode.UPDATE_BUILDING,
          clitoken,
          token,
          async (id, client_id) => await updateBuilding(body, id, client_id)
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

async function getBuildings(page = 1, limit = 10, searchText = "", client_id) {
  let offset = (page - 1) * limit;
  let data;
  if (searchText === "") {
    data = await db.any(
      `SELECT *, count(*) OVER() AS full_count FROM ${client_id}_buildings ORDER BY building_name OFFSET $1 LIMIT $2`,
      [offset, limit]
    );
  } else {
    searchText = `%${searchText}%`;
    data = await db.any(
      `SELECT *, count(*) OVER() AS full_count FROM ${client_id}_buildings WHERE building_name iLIKE $1 OR building_area iLIKE $1 OR contact_number iLIKE $1 ORDER BY building_name OFFSET $2 LIMIT $3`,
      [searchText, offset, limit]
    );
  }
  return [data, 200];
}

async function getBuilding(id, client_id) {
  let building_id = parseInt(id);
  const data = await db.any(
    `SELECT * FROM ${client_id}_buildings WHERE id = $1`,
    [building_id]
  );
  return [data, 200];
}

async function addBuilding(data, createdBy, client_id) {
  const date_now = new Date().toISOString();

  let column_names = Object.keys(data);
  column_names = column_names.join();
  let values = Object.values(data);
  let col_values = values;
  values = values.map(
    (value, index) =>
      `$${index + 1}${
        Array.isArray(value)
          ? typeof value[0] === "object" && value[0] !== null
            ? "::json[]"
            : ""
          : ""
      }`
  );
  values = values.join();
  let sql_stmt = `INSERT INTO ${client_id}_buildings (${column_names},createdby, updatedby, createdat, updatedat) VALUES (${values}, ${createdBy}, ${createdBy}, ${date_now}, ${date_now})`;
  await db.none(sql_stmt, col_values);
  await addclienttransaction(createdBy, client_id, "ADD_BUILDING");
  return ["Building Successfully Added", 200];
}

async function updateBuilding(data, updatedby, client_id) {
  const date_now = new Date().toISOString();
  let column_names = Object.keys(data);
  let values = Object.values(data);
  let col_values = values;
  values = values.map(
    (value, index) =>
      `$${index + 1}${
        Array.isArray(value)
          ? typeof value[0] === "object" && value[0] !== null
            ? "::json[]"
            : ""
          : ""
      }`
  );
  // values = values.join();
  let update_statement = column_names.map(
    (name, index) => `${name} = ${values[index]}`
  );
  update_statement = update_statement.join();
  let sql_stmt = `UPDATE ${client_id}_buildings SET ${update_statement},updatedby = ${updatedby}, updatedat = ${date_now} WHERE id=(${data.id})`;
  await db.none(sql_stmt, col_values);
  await addclienttransaction(updatedby, client_id, "UPDATE_BUILDING");
  return ["Building Successfully Updated", 200];
}

async function deleteBuilding(id, deletedby, client_id) {
  let building_id = parseInt(id);
  await db.none(`DELETE FROM ${client_id}_buildings WHERE id = $1`, [
    building_id,
  ]);
  await addclienttransaction(deletedby, client_id, "DELETE_BUILDING");
  return ["Building Successfully Deleted", 200];
}

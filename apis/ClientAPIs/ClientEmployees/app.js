const db = require("/opt/nodejs/utils/db.js");
const responseHandler = require("/opt/nodejs/utils/responseHandler.js");
const authorize = require("/opt/nodejs/utils/authorize.js");
const authcode = require("/opt/nodejs/utils/accessCodes.js");

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
            authcode.GET_EMPLOYEE,
            clitoken,
            token,
            async (id, client_id) =>
              await getEmployee(event.pathParameters.id, client_id)
          );
        } else if (event.queryStringParameters) {
          let params = event.queryStringParameters;
          if (params.page && params.limit) {
            page = parseInt(params.page);
            limit = parseInt(params.limit);
            [data, statusCode] = await authorize(
              authcode.GET_EMPLOYEE,
              clitoken,
              token,
              async (id, client_id) =>
                await getEmployees(page, limit, params.searchText, client_id)
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
          authcode.ADD_EMPLOYEE,
          clitoken,
          token,
          async (id, client_id) => await addEmployee(body, id, client_id)
        );
        break;
      case "DELETE":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          authcode.DELETE_EMPLOYEE,
          clitoken,
          token,
          async (id, client_id) => await deleteEmployee(body.id, client_id)
        );
        break;
      case "PUT":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          authcode.UPDATE_EMPLOYEE,
          clitoken,
          token,
          async (id, client_id) => await updateEmployee(body, id, client_id)
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

async function getEmployees(page = 1, limit = 10, searchText = "", client_id) {
  let offset = (page - 1) * limit;
  let data;
  if (searchText === "") {
    data = await db.any(
      `SELECT *, count(*) OVER() AS full_count FROM ${client_id}_employees ORDER BY full_name OFFSET $1 LIMIT $2`,
      [offset, limit]
    );
  } else {
    searchText = `%${searchText}%`;
    data = await db.any(
      `SELECT *, count(*) OVER() AS full_count FROM ${client_id}_employees WHERE full_name iLIKE $1 OR id iLIKE $1 OR designation iLIKE $1 ORDER BY full_name OFFSET $2 LIMIT $3`,
      [searchText, offset, limit]
    );
  }
  return [data, 200];
}

async function getEmployee(id, client_id) {
  let employee_id = parseInt(id);
  const data = await db.any(
    `SELECT * FROM ${client_id}_employees WHERE id = $1`,
    [employee_id]
  );
  return [data, 200];
}

async function addEmployee(
  { id, full_name, designation },
  createdBy,
  client_id
) {
  if (!id || !full_name || !designation || !createdBy)
    throw new Error("Missing required fields");

  const date_now = new Date().toISOString();

  await db.none(
    `INSERT into ${client_id}_employees (id, full_name, designation, createdBy, updatedby, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $4, $5, $6)`,
    [id, full_name, designation, createdBy, date_now, date_now]
  );

  return ["Employee Successfully Added", 200];
}

async function updateEmployee(
  { id, full_name, designation },
  updatedby,
  client_id
) {
  if (!id || !full_name || !designation)
    throw new Error("Missing required fields");

  const date_now = new Date().toISOString();

  await db.none(
    `UPDATE ${client_id}_employees SET full_name = $1, designation = $2, updatedAt = $3, updatedby = $4 WHERE id = $5`,
    [full_name, designation, date_now, updatedby, id]
  );

  return ["Employee Successfully Updatedbuilb", 200];
}

async function deleteEmployee(id, client_id) {
  let employee_id = parseInt(id);
  await db.none(`DELETE FROM ${client_id}_employees WHERE id = $1`, [
    employee_id,
  ]);
  return ["Employee Successfully Deleted", 200];
}

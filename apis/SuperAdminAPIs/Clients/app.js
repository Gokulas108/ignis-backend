const db = require("/opt/nodejs/utils/db.js");
const responseHandler = require("/opt/nodejs/utils/responseHandler.js");
const authorize = require("/opt/nodejs/utils/authorize.js");

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
        let params = event.queryStringParameters;
        if (params.id) {
          [data, statusCode] = await authorize(
            [],
            clitoken,
            token,
            async (id) => await getClient(params.id),
            true
          );
        } else {
          page = parseInt(params.page);
          limit = parseInt(params.limit);
          [data, statusCode] = await authorize(
            [],
            clitoken,
            token,
            async (id) => await getClients(page, limit, params.searchText),
            true
          );
        }
        break;
      case "POST":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          [],
          clitoken,
          token,
          async (id) => await addClient(body.client, id),
          true
        );
        break;
      case "DELETE":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          [],
          clitoken,
          token,
          async (id) => await deleteClient(body.id),
          true
        );
        break;
      case "PUT":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          [],
          clitoken,
          token,
          async (id) => await updateClient(body),
          true
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

async function getClients(page = 1, limit = 10, searchText = "") {
  let offset = (page - 1) * limit;
  let users;
  if (searchText === "") {
    users = await db.any(
      `SELECT cli.id as id, cli.name AS name, cli.client_id AS client_id, co.name AS country, sa.name AS uname, sa.username AS username, count(cli.*) OVER() AS full_count FROM client cli JOIN country_iso co ON cli.country = co.country_iso JOIN superadmins sa ON cli.createdby = sa.id ORDER BY id DESC OFFSET $1 LIMIT $2`,
      [offset, limit]
    );
  } else {
    searchText = `%${searchText}%`;
    users = await db.any(
      `SELECT cli.id as id, cli.name AS name, cli.client_id AS client_id, co.name AS country, sa.name AS uname, sa.username AS username, count(cli.*) OVER() AS full_count FROM client cli JOIN country_iso co ON cli.country = co.country_iso JOIN superadmins sa ON cli.createdby = sa.id  WHERE cli.name iLIKE $1 OR co.name iLIKE $1 OR sa.username iLIKE $1 ORDER BY id DESC OFFSET $2 LIMIT $3`,
      [searchText, offset, limit]
    );
  }

  let data = users;
  let statusCode = 200;
  return [data, statusCode];
}

async function getClient(id) {
  const data = await db.one("SELECT name FROM client WHERE client_id = $1", [
    id,
  ]);
  return [data, 200];
}

async function addClient({ name, clientId, country }, createdby) {
  if (!name || !country) throw new Error("Missing required fields");
  const date_now = new Date().toISOString();

  await db.none(
    "INSERT into client (name, client_id, country, createdby, createdat, updatedat) VALUES ($1, $2, $3, $4, $5, $6)",
    [name, clientId, country, createdby, date_now, date_now]
  );

  return ["Client Successfully Added", 200];
}

async function deleteClient(id) {
  if (!id) throw new Error("ID Missing!");

  await db.none("DELETE FROM client WHERE id = $1", [id]);

  return ["Client Successfully Removed", 200];
}

async function updateClient({ id, name }) {
  if (!id) throw new Error("ID Missing!");
  const date_now = new Date().toISOString();

  await db.none("UPDATE client SET name = $1, updatedat = $2 WHERE id = $3", [
    name,
    date_now,
    id,
  ]);

  return ["Client Successfully Updated", 200];
}

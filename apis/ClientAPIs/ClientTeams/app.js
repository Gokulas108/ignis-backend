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
  let ip = event["requestContext"]["identity"]["sourceIp"];
  let useragent = event["requestContext"]["identity"]["userAgent"];

  try {
    switch (httpMethod) {
      case "OPTIONS":
        [data, statusCode] = ["Success", 200];
        break;
      case "GET":
        if (event.queryStringParameters) {
          let params = event.queryStringParameters;
          if (params.team_id) {
            [data, statusCode] = await authorize(
              authcode.GET_BUILDING,
              ip,
              useragent,
              token,
              async (username, client_id) =>
                await getTeam(params.team_id, client_id)
            );
          } else {
            throw new Error("Missing Team ID");
          }
        } else {
          [data, statusCode] = await authorize(
            authcode.GET_BUILDING,
            ip,
            useragent,
            token,
            async (username, client_id) => await getTeams(client_id)
          );
        }
        break;
      case "POST":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          authcode.ADD_BUILDING,
          ip,
          useragent,
          token,
          async (username, client_id) =>
            await addTeam(body, username, client_id)
        );
        break;
      case "DELETE":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          authcode.DELETE_BUILDING,
          ip,
          useragent,
          token,
          async (username, client_id) =>
            await deleteTeam(body.id, username, client_id)
        );
        break;
      case "PUT":
        body = JSON.parse(event.body);
        [data, statusCode] = await authorize(
          authcode.UPDATE_BUILDING,
          ip,
          useragent,
          token,
          async (username, client_id) =>
            await updateTeam(body, username, client_id)
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

async function getTeams(client_id) {
  let data = await db.any(`SELECT * FROM ${client_id}_building_controllers`);

  return [data, 200];
}

async function getTeam(id, client_id) {
  const adata = await db.any(
    `SELECT sys.name, bld.building_name, co.id, co.title, bld.id AS building_id FROM ${client_id}_systems sys JOIN ${client_id}_buildings bld ON sys.building_id = bld.id JOIN ${client_id}_contracts co ON sys.current_contract = co.id  WHERE bld.building_controller = $1 AND co.status = $2 `,
    [id, "ACTIVE"]
  );
  const udata = await db.any(
    `SELECT sys.name, bld.building_name, co.id, co.title, bld.id AS building_id  FROM ${client_id}_systems sys JOIN ${client_id}_buildings bld ON sys.building_id = bld.id JOIN ${client_id}_contracts co ON sys.current_contract = co.id  WHERE (bld.building_controller IS NULL OR bld.building_controller =$1)  AND co.status = $2 `,
    ["", "ACTIVE"]
  );
  const users = await db.any(
    `SELECT cu.username, cu.name FROM ${client_id}_users cu JOIN ${client_id}_building_controllers blc ON cu.username = ANY(blc.assigned_users) WHERE blc.id =$1`,
    [id]
  );
  let acontract = adata.reduce(function (r, a) {
    let contract = a.id;
    r[contract] = r[contract] || [];
    r[contract].push(a);
    return r;
  }, Object.create(null));
  let assigned = Object.keys(acontract).map((result) => {
    let abuilding = acontract[result].reduce(function (r, a) {
      let building = a.building_id;
      r[building] = r[building] || [];
      r[building].push(a);
      return r;
    }, Object.create(null));
    return { [result]: abuilding };
  });
  let ucontract = udata.reduce(function (r, a) {
    let contract = a.id;
    r[contract] = r[contract] || [];
    r[contract].push(a);
    return r;
  }, Object.create(null));
  let unassigned = Object.keys(ucontract).map((result) => {
    let ubuilding = ucontract[result].reduce(function (r, a) {
      let building = a.building_id;
      r[building] = r[building] || [];
      r[building].push(a);
      return r;
    }, Object.create(null));
    return { [result]: ubuilding };
  });
  return [{ assigned, unassigned, users }, 200];
}

async function addTeam(
  { team_id, assigned, unassigned },
  createdBy,
  client_id
) {
  const date_now = new Date().toISOString();

  await db.none(
    `UPDATE ${client_id}_buildings SET building_controller = $1 WHERE id = ANY($2)`,
    [team_id, assigned]
  );
  await db.none(
    `UPDATE ${client_id}_buildings SET building_controller = $1 WHERE id = ANY($2)`,
    [null, unassigned]
  );
  return ["Assigned Succesfully!", 200];
}

async function updateTeam({ id, data }, updatedby, client_id) {
  const date_now = new Date().toISOString();

  await db.none(``[(updatedby, date_now, id)]);
  await addclienttransaction(updatedby, client_id, "UPDATE_BUILDING");
  return ["Team Successfully Updated", 200];
}

async function deleteTeam(id, deletedby, client_id) {
  let team_id = parseInt(id);
  await db.none(`DELETE FROM ${client_id}_building_controllers WHERE id = $1`, [
    team_id,
  ]);
  await addclienttransaction(deletedby, client_id, "DELETE_BUILDING");
  return ["Team Successfully Deleted", 200];
}

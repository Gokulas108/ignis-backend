//Dropdown APIs
//Consists of APIs for getting values of dropdowns for the entire app.

const db = require("/opt/nodejs/utils/db.js");
const responseHandler = require("/opt/nodejs/utils/responseHandler.js");
const authorize = require("/opt/nodejs/utils/authorize.js");
const authcode = require("/opt/nodejs/utils/accessCodes.js");

exports.lambdaHandler = async (event, context) => {
  let data = [];
  let statusCode = 400;
  let httpMethod = event.httpMethod;
  let path = event.path;
  let token = event.headers["ignistoken"];
  let clitoken = event.headers["clienttoken"];
  path = path.replace(/([^\/]*\/){2}/, ""); //getting the last path from -> "/dropdown/{path}"

  try {
    switch (httpMethod) {
      //Cors
      case "OPTIONS":
        if (
          path === "occupancyClassification" ||
          path === "hazardClassification" ||
          path === "typeOfConstruction" ||
          path === "contractType" ||
          path === "saveBuildingFields" ||
          path === "getBuildingFields" ||
          path === "dropdownAll" ||
          path === "countries" ||
          path === "systemtypes" ||
          path === "devicetypes" ||
          path === "clientRoles" ||
          path === "employees" ||
          path === "authCodes"
        ) {
          [data, statusCode] = ["Success", 200];
        } else {
          [data, statusCode] = ["Error: Invalid Request", 400];
        }
        break;

      //Sending dropdown data to frontend
      case "GET":
        if (path === "occupancyClassification") {
          [data, statusCode] = await authorize(
            authcode.GET_BUILDING,
            clitoken,
            token,
            async (id, client_id) =>
              await getOccupancyClassifications(client_id)
          );
        } else if (path === "hazardClassification") {
          [data, statusCode] = await authorize(
            authcode.GET_BUILDING,
            clitoken,
            token,
            async (id, client_id) => await getHazardClassifications(client_id)
          );
        } else if (path === "dropdownAll") {
          [data, statusCode] = await authorize(
            authcode.GET_BUILDING,
            clitoken,
            token,
            async (id, client_id) => await getAllDropdowns(client_id)
          );
        } else if (path === "typeOfConstruction") {
          [data, statusCode] = await authorize(
            authcode.GET_BUILDING,
            clitoken,
            token,
            async (id, client_id) => await getTypeOfConstruction(client_id)
          );
        } else if (path === "contractType") {
          [data, statusCode] = await authorize(
            authcode.GET_BUILDING,
            clitoken,
            token,
            async (id, client_id) => await getContractType(client_id)
          );
        } else if (path === "getBuildingFields") {
          [data, statusCode] = await authorize(
            authcode.GET_BUILDING,
            clitoken,
            token,
            async (id, client_id) => await getBuildingFields(client_id)
          );
        } else if (path === "countries") {
          [data, statusCode] = await getAllCountries();
        } else if (path === "systemtypes") {
          [data, statusCode] = await getAllSystemtypes();
        } else if (path === "clientRoles") {
          [data, statusCode] = await authorize(
            authcode.GET_USER_ROLE,
            clitoken,
            token,
            async (id, client_id) => await getAllRoles(client_id)
          );
        } else if (path === "authCodes") {
          [data, statusCode] = await authorize(
            authcode.GET_AUTH_CODES,
            clitoken,
            token,
            async (id, client_id) => await getAllAuthCodes()
          );
        } else if (path === "employees") {
          [data, statusCode] = await authorize(
            authcode.GET_EMPLOYEE,
            clitoken,
            token,
            async (id, client_id) => await getAllEmployees(client_id)
          );
        } else if (path === "devicetypes") {
          if (
            event.queryStringParameters &&
            event.queryStringParameters.system
          ) {
            [data, statusCode] = await getAllDeviceTypes(
              event.queryStringParameters.system
            );
          }
        } else {
          [data, statusCode] = ["Error: Invalid request", 400];
        }
        break;

      //Adding new values to dropdown
      case "POST":
        if (path === "occupancyClassification") {
          let body = JSON.parse(event.body);
          [data, statusCode] = await authorize(
            authcode.ADD_BUILDING,
            clitoken,
            token,
            async (id, client_id) =>
              await addNewOccupancyClassification(body.new_value, id, client_id)
          );
        } else if (path === "hazardClassification") {
          let body = JSON.parse(event.body);
          [data, statusCode] = await authorize(
            authcode.ADD_BUILDING,
            clitoken,
            token,
            async (id, client_id) =>
              await addNewHazardClassification(body.new_value, id, client_id)
          );
        } else if (path === "typeOfConstruction") {
          let body = JSON.parse(event.body);
          [data, statusCode] = await authorize(
            authcode.ADD_BUILDING,
            clitoken,
            token,
            async (id, client_id) =>
              await addNewTypeOfConstruction(body.new_value, id, client_id)
          );
        } else if (path === "contractType") {
          let body = JSON.parse(event.body);
          [data, statusCode] = await authorize(
            authcode.ADD_BUILDING,
            clitoken,
            token,
            async (id, client_id) =>
              await addNewContractType(body.new_value, id, client_id)
          );
        } else if (path === "saveBuildingFields") {
          let body = JSON.parse(event.body);
          [data, statusCode] = await authorize(
            authcode.ADD_BUILDING,
            clitoken,
            token,
            async (id, client_id) =>
              await saveRequiredfields(body.fields, id, client_id)
          );
        } else [data, statusCode] = ["Error: Invalid request", 400];
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

//Getting all dropdown values
async function getAllDropdowns(client_id) {
  let [occupancyClassification] = await getOccupancyClassifications(client_id);
  let [hazardClassification] = await getHazardClassifications(client_id);
  let [typeOfConstruction] = await getTypeOfConstruction(client_id);
  let [contractType] = await getContractType(client_id);
  let [engineers] = await getEngineers(client_id);
  let [add_building_required_fields] = await getBuildingFields(client_id);
  let data = {
    occupancyClassification,
    hazardClassification,
    typeOfConstruction,
    contractType,
    add_building_required_fields,
    engineers,
  };
  let statusCode = 200;
  return [data, statusCode];
}

//Getting data from Engineers table
async function getEngineers() {
  const users = await db.any(`SELECT id, name FROM users WHERE role = $1`, [
    "engineer",
  ]);
  let data = users;
  let statusCode = 200;
  return [data, statusCode];
}

//Getting data from Occupancy Classification table
async function getOccupancyClassifications(client_id) {
  const users = await db.any(
    `SELECT * FROM ${client_id}_occupancy_classification`
  );
  let data = users;
  let statusCode = 200;
  return [data, statusCode];
}

//Adding new dropdown value to Occupancy classification
async function addNewOccupancyClassification(new_value, createdby, client_id) {
  const date_now = new Date().toISOString();
  await db.none(
    `INSERT INTO ${client_id}_occupancy_classification (value, ahj, createdby, updatedby, createdat, updatedat ) VALUES ($1, $2, $3, $3, $4, $4)`,
    [new_value, 1, createdby, date_now]
  );
  let statusCode = 200;
  return ["Sucessfully Inserted", statusCode];
}

//Getting data from Hazard Classification table
async function getHazardClassifications(client_id) {
  const data = await db.any(
    `SELECT * FROM  ${client_id}_hazard_classification WHERE ahj = $1`,
    [1]
  );
  let statusCode = 200;
  return [data, statusCode];
}

//Adding new dropdown value to Hazard classification
async function addNewHazardClassification(new_value, createdby, client_id) {
  const date_now = new Date().toISOString();
  await db.none(
    `INSERT INTO ${client_id}_hazard_classification (value, ahj, createdby, updatedby, createdat, updatedat ) VALUES ($1, $2, $3, $3, $4, $4)`,
    [new_value, 1, createdby, date_now]
  );
  let statusCode = 200;
  return ["Sucessfully Inserted", statusCode];
}

//Getting data from Types Of Construction table
async function getTypeOfConstruction(client_id) {
  const data = await db.any(
    `SELECT * FROM ${client_id}_type_of_construction WHERE ahj = $1`,
    [1]
  );
  let statusCode = 200;
  return [data, statusCode];
}

//Adding new dropdown value to Types Of Construction
async function addNewTypeOfConstruction(new_value, createdby, client_id) {
  const date_now = new Date().toISOString();
  await db.none(
    `INSERT INTO ${client_id}_type_of_construction (value, ahj, createdby, updatedby, createdat, updatedat ) VALUES ($1, $2, $3, $3, $4, $4)`,
    [new_value, 1, createdby, date_now]
  );
  let statusCode = 200;
  return ["Sucessfully Inserted", statusCode];
}

//Getting data from Contract-type table
async function getContractType(client_id) {
  const data = await db.any(
    `SELECT * FROM ${client_id}_contract_type WHERE ahj = $1`,
    [1]
  );
  let statusCode = 200;
  return [data, statusCode];
}

//Adding new dropdown value to Contract type
async function addNewContractType(new_value, createdby, client_id) {
  const date_now = new Date().toISOString();
  await db.none(
    `INSERT INTO ${client_id}_contract_type (value, ahj, createdby, updatedby, createdat, updatedat) VALUES ($1, $2, $3, $3, $4, $4)`,
    [new_value, 1, createdby, date_now]
  );
  let statusCode = 200;
  return ["Sucessfully Inserted", statusCode];
}

async function saveRequiredfields(fields) {
  await db.none(
    "UPDATE client SET add_building_required_fields = $1 WHERE id = 28",
    [fields]
  );
  let statusCode = 200;
  return ["Sucessfully Updated", statusCode];
}

async function getBuildingFields() {
  const data = await db.one(
    "SELECT add_building_required_fields FROM client where id = 28"
  );
  let statusCode = 200;
  return [data, statusCode];
}

async function getAllCountries() {
  const data = await db.any("SELECT country_iso, name FROM country_iso");
  let statusCode = 200;
  return [data, statusCode];
}

async function getAllSystemtypes() {
  const data = await db.any("SELECT id, name FROM systemtypes");
  let statusCode = 200;
  return [data, statusCode];
}

async function getAllDeviceTypes(id) {
  const data = await db.any(
    "SELECT id, name FROM devicetypes WHERE systemid= $1 ",
    [id]
  );
  let statusCode = 200;
  return [data, statusCode];
}

async function getAllRoles(client_id) {
  const data = await db.any(
    `SELECT id, role, authorizations FROM ${client_id}_user_roles`
  );
  let statusCode = 200;
  return [data, statusCode];
}

async function getAllAuthCodes() {
  const data = await db.any(`SELECT * FROM auth_codes ORDER BY module`);
  let statusCode = 200;
  return [data, statusCode];
}

async function getAllEmployees(client_id) {
  const data = await db.any(`SELECT id, full_name FROM ${client_id}_employees`);
  let statusCode = 200;
  return [data, statusCode];
}

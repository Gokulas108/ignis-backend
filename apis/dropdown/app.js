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
          [data, statusCode] = await getOccupancyClassifications();
        } else if (path === "hazardClassification") {
          [data, statusCode] = await getHazardClassifications();
        } else if (path === "dropdownAll") {
          [data, statusCode] = await getAllDropdowns();
        } else if (path === "typeOfConstruction") {
          [data, statusCode] = await getTypeOfConstruction();
        } else if (path === "contractType") {
          [data, statusCode] = await getContractType();
        } else if (path === "getBuildingFields") {
          [data, statusCode] = await getBuildingFields();
        } else if (path === "countries") {
          [data, statusCode] = await getAllCountries();
        } else if (path === "systemtypes") {
          [data, statusCode] = await getAllSystemtypes();
        } else if (path === "clientRoles") {
          [data, statusCode] = await authorize(
            [authcode.GET_USER_ROLE],
            clitoken,
            token,
            async (id, client_id) => await getAllRoles(client_id)
          );
        } else if (path === "authCodes") {
          [data, statusCode] = await authorize(
            [authcode.GET_AUTH_CODES],
            clitoken,
            token,
            async (id, client_id) => await getAllAuthCodes()
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
          [data, statusCode] = await addNewOccupancyClassification(
            body.new_value
          );
        } else if (path === "hazardClassification") {
          let body = JSON.parse(event.body);
          [data, statusCode] = await addNewHazardClassification(body.new_value);
        } else if (path === "typeOfConstruction") {
          let body = JSON.parse(event.body);
          [data, statusCode] = await addNewTypeOfConstruction(body.new_value);
        } else if (path === "contractType") {
          let body = JSON.parse(event.body);
          [data, statusCode] = await addNewContractType(body.new_value);
        } else if (path === "saveBuildingFields") {
          let body = JSON.parse(event.body);
          [data, statusCode] = await saveRequiredfields(body.fields);
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
async function getAllDropdowns() {
  let [occupancyClassification] = await getOccupancyClassifications();
  let [hazardClassification] = await getHazardClassifications();
  let [typeOfConstruction] = await getTypeOfConstruction();
  let [contractType] = await getContractType();
  let [engineers] = await getEngineers();
  let [add_building_required_fields] = await getBuildingFields();
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

//Getting data from Occupancy Classification table
async function getEngineers() {
  const users = await db.any(`SELECT id, name FROM users WHERE role = $1`, [
    "engineer",
  ]);
  let data = users;
  let statusCode = 200;
  return [data, statusCode];
}

//Getting data from Occupancy Classification table
async function getOccupancyClassifications() {
  const users = await db.any(`SELECT * FROM occupancy_classification`);
  let data = users;
  let statusCode = 200;
  return [data, statusCode];
}

//Adding new dropdown value to Occupancy classification
async function addNewOccupancyClassification(new_value) {
  await db.none(
    "INSERT INTO occupancy_classification (value, ahj) VALUES ($1, $2)",
    [new_value, 1]
  );
  let statusCode = 200;
  return ["Sucessfully Inserted", statusCode];
}

//Getting data from Hazard Classification table
async function getHazardClassifications() {
  const data = await db.any(
    `SELECT * FROM hazard_classification WHERE ahj = $1`,
    [1]
  );
  let statusCode = 200;
  return [data, statusCode];
}

//Adding new dropdown value to Hazard classification
async function addNewHazardClassification(new_value) {
  await db.none(
    "INSERT INTO hazard_classification (value, ahj) VALUES ($1, $2)",
    [new_value, 1]
  );
  let statusCode = 200;
  return ["Sucessfully Inserted", statusCode];
}

//Getting data from Types Of Construction table
async function getTypeOfConstruction() {
  const data = await db.any(
    `SELECT * FROM type_of_construction WHERE ahj = $1`,
    [1]
  );
  let statusCode = 200;
  return [data, statusCode];
}

//Adding new dropdown value to Types Of Construction
async function addNewTypeOfConstruction(new_value) {
  await db.none(
    "INSERT INTO type_of_construction (value, ahj) VALUES ($1, $2)",
    [new_value, 1]
  );
  let statusCode = 200;
  return ["Sucessfully Inserted", statusCode];
}

//Getting data from Contract-type table
async function getContractType() {
  const data = await db.any(`SELECT * FROM contract_type WHERE ahj = $1`, [1]);
  let statusCode = 200;
  return [data, statusCode];
}

//Adding new dropdown value to Contract type
async function addNewContractType(new_value) {
  await db.none("INSERT INTO contract_type (value, ahj) VALUES ($1, $2)", [
    new_value,
    1,
  ]);
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
  const data = await db.any(`SELECT id, role FROM ${client_id}_user_roles`);
  let statusCode = 200;
  return [data, statusCode];
}

async function getAllAuthCodes() {
  const data = await db.one(`SELECT name, authorization FROM auth_codes`);
  let statusCode = 200;
  return [data, statusCode];
}

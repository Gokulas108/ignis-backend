const db = require("/opt/nodejs/utils/db.js");
const responseHandler = require("/opt/nodejs/utils/responseHandler.js");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const authorize = require("/opt/nodejs/utils/authorize.js");

exports.lambdaHandler = async (event, context) => {
  let statusCode = 200;
  let data;
  let httpMethod = event.httpMethod;
  let path = event.path;
  path = path.replace(/([^\/]*\/){2}/, ""); //getting the last path from -> "/dropdown/{path}"

  try {
    switch (httpMethod) {
      //Handling Cors
      case "OPTIONS":
        if (
          path === "register" ||
          path === "login" ||
          path === "verify" ||
          path === "users" ||
          path === "employee" ||
          path === "employeeID" ||
          path === "resource" ||
          path === "reset"
        ) {
          [data, statusCode] = ["Success", 200];
        } else {
          [data, statusCode] = ["Error: Invalid Request", 400];
        }
        break;

      // Get functions
      case "GET":
        // [data, statusCode] = await getBuildings();
        if (path === "users") {
          let params = event.queryStringParameters;
          page = parseInt(params.page);
          limit = parseInt(params.limit);
          [data, statusCode] = await getUsers(page, limit, params.searchText);
        }
        if (path === "employee") {
          let params = event.queryStringParameters;
          page = parseInt(params.page);
          limit = parseInt(params.limit);
          [data, statusCode] = await getEmployee(
            page,
            limit,
            params.searchText
          );
        }
        if (path === "resource") {
          let params = event.queryStringParameters;
          page = parseInt(params.page);
          limit = parseInt(params.limit);
          [data, statusCode] = await getResource(
            page,
            limit,
            params.searchText
          );
        }
        if (path === "employeeID") {
          [data, statusCode] = await getEmployeeID();
        }

        break;

      //Post functions
      case "POST":
        let body = JSON.parse(event.body);
        if (path === "register")
          [data, statusCode] = await registerAccount(body.userInfo);
        else if (path === "login")
          [data, statusCode] = await login(body.userInfo);
        else if (path === "verify") [data, statusCode] = await verify(body);
        else if (path === "reset")
          [data, statusCode] = await resetPasswordFirstTime(body);
        else if (path === "employee")
          [data, statusCode] = await registerEmployee(body.employeeInfo);
        else if (path === "resource")
          [data, statusCode] = await registerResource(body.resourceInfo);
        break;
      default:
        [data, statusCode] = ["Error: Invalid request", 400];
    }
  } catch (err) {
    statusCode = 400;
    data = err.stack;
  }

  response = responseHandler(data, statusCode);
  return response;
};

async function getUsers(page = 1, limit = 10, searchText = "") {
  let offset = (page - 1) * limit;
  let users;
  if (searchText === "") {
    users = await db.any(
      `SELECT id, name, username, role, count(*) OVER() AS full_count FROM users ORDER BY id DESC OFFSET $1 LIMIT $2`,
      [offset, limit]
    );
  } else {
    searchText = `%${searchText}%`;
    users = await db.any(
      `SELECT id, name, username, role, count(*) OVER() AS full_count FROM users WHERE name iLIKE $1 OR username iLIKE $1 OR role iLIKE $1 ORDER BY id DESC OFFSET $2 LIMIT $3`,
      [searchText, offset, limit]
    );
  }

  let data = users;
  let statusCode = 200;
  return [data, statusCode];
}

async function getEmployee(page = 1, limit = 10, searchText = "") {
  let offset = (page - 1) * limit;
  let employee;
  if (searchText === "") {
    employee = await db.any(
      `SELECT  *, count(*) OVER() AS full_count FROM employee ORDER BY id DESC OFFSET $1 LIMIT $2`,
      [offset, limit]
    );
  } else {
    searchText = `%${searchText}%`;
    employee = await db.any(
      `SELECT *, count(*) OVER() AS full_count FROM employee WHERE name iLIKE $1 OR id iLIKE $1 OR role iLIKE $1 ORDER BY id DESC OFFSET $2 LIMIT $3`,
      [searchText, offset, limit]
    );
  }

  let data = employee;
  let statusCode = 200;
  return [data, statusCode];
}

async function getResource(page = 1, limit = 10, searchText = "") {
  let offset = (page - 1) * limit;
  let resource;
  if (searchText === "") {
    resource = await db.any(
      `SELECT *, count(*) OVER() AS full_count FROM resource ORDER BY id DESC OFFSET $1 LIMIT $2`,
      [offset, limit]
    );
  } else {
    searchText = `%${searchText}%`;
    resource = await db.any(
      `SELECT *, count(*) OVER() AS full_count FROM resource WHERE name iLIKE $1 OR type iLIKE $1 OR description iLIKE $1 ORDER BY id DESC OFFSET $2 LIMIT $3`,
      [searchText, offset, limit]
    );
  }

  let data = resource;
  let statusCode = 200;
  return [data, statusCode];
}

async function getEmployeeID() {
  let employeeIDs;
  employeeIDs = await db.any(`SELECT id FROM employee`);

  let data = employeeIDs;
  let statusCode = 200;
  return [data, statusCode];
}

//Registering an user account
// INPUTS - Name, User type, username
//OUTPUTS - User created  successfully
async function registerAccount(userInfo) {
  let { id, password, role } = { ...userInfo };

  //Checking all fields
  if (!id || !password || !role) return ["Error: All fields are required", 401];

  //Checking if user already exist
  const users = await db.any("SELECT * FROM users WHERE username = $1", [
    id.toString(),
  ]);
  if (users.length) return ["Error: User already exist", 401];

  const emp = await db.any("SELECT name FROM employee WHERE id = $1", [
    parseInt(id),
  ]);
  if (!emp.length) return [`Error: Employee ID ${id} does not exist`, 401];

  //Registering user
  const encryptedPassword = bcrypt.hashSync(password.trim(), 10);
  role = role.toLowerCase().trim();
  const user = await db.one(
    "INSERT INTO users(name, username, password, role) VALUES($1, $2, $3, $4) returning id",
    [emp[0].name, id.toString(), encryptedPassword, role]
  );

  let values_to_be_inserted = [];

  if (role === "technician" && userInfo.system_rating) {
    userInfo.system_rating.map((x) => {
      x.itm.map((y) => {
        values_to_be_inserted.push(
          `(${user.id}, ${x.system}, '${y}', ${parseInt(x.rating)})`
        );
      });
    });
    await db.none(
      `INSERT INTO technician(user_id, system_id, itm, rating) VALUES${values_to_be_inserted.toString()}`
    );
  }

  await db.none(`UPDATE employee set user = $1 WHERE id = $2`, [
    true,
    parseInt(id),
  ]);

  return ["User created successfully", 200];
}

//Registering an employee
// INPUTS - Name, Role, employee ID
//OUTPUTS - Employee added successfully
async function registerEmployee(employeeInfo) {
  let { name, role, id } = { ...employeeInfo };

  //Checking all fields
  if (!name || !role || !id) return ["Error: All fields are required", 401];

  //Checking if employee ID already exist
  const employees = await db.any("SELECT * FROM employee WHERE id = $1", [id]);
  if (employees.length) return ["Error: Employee ID already exist", 401];

  //Registering employee
  role = role.toLowerCase().trim();
  const employee = await db.one(
    "INSERT INTO employee(id, name, role) VALUES($1, $2, $3) returning id",
    [id, name, role]
  );

  return ["Employee added successfully", 200];
}

//Registering a resource
// INPUTS - Name, Type
//OUTPUTS - Resource added successfully
async function registerResource(resourceInfo) {
  let { name, type, description } = { ...resourceInfo };

  //Checking all fields
  if (!name || !type) return ["Error: All fields are required", 401];

  //Registering resource
  const resource = await db.one(
    "INSERT INTO resource(name, type, description) VALUES($1, $2, $3) returning id",
    [name, type, description]
  );

  return ["Resource added successfully", 200];
}

//Logging into user account
//Inputs - username, password
//Output - Logged in
async function login(userInfo) {
  let { username, password } = { ...userInfo };

  //Checking required fields
  if (!username || !password) return ["Error: All fields are required", 401];

  //Checking if user exists and comparing password
  const user = await db.oneOrNone("SELECT * FROM users WHERE username = $1", [
    username,
  ]);
  if (!user || !user.username) return ["Error: No User found", 401];
  else {
    if (!bcrypt.compareSync(password, user.password)) {
      return ["Error: Incorrect password", 403];
    }
    let new_user = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      first_login: user.first_login,
    };
    const token = generateToken(new_user);
    const responseBody = {
      user: new_user,
      token,
    };
    return [responseBody, 200];
  }
}

//Verifying Token
//Input - Token
function verify({ user, token }) {
  if (!user || !user.username || !user.role || !user.name)
    return [{ verified: false, mssg: "incorrect request body" }, 400];

  verification = jwt.verify(token, "mysecretkey30903xcdfsdfg", (err, res) => {
    if (err) return { verified: false, mssg: "invalid token" };
    if (
      res.username !== user.username ||
      res.role !== user.role ||
      res.name !== user.name
    )
      return { verified: false, mssg: "invalid token" };
    return { verified: true, mssg: "verified" };
  });

  if (!verification.verified) {
    return [verification, 400];
  } else {
    return [verification, 200];
  }
}

//Generate JWT
//Input - User object
//Output - Token
function generateToken(user) {
  if (!user) return null;
  return jwt.sign(user, "mysecretkey30903xcdfsdfg", {
    expiresIn: "8h",
  });
}

//Reseting password for the first time
//Inputs - new password, confirm password
//Outpus - password changed successfully
async function resetPasswordFirstTime(body) {
  let { new_password, confirm_password, user } = { ...body };

  //Checking required fields
  if (!new_password || !confirm_password)
    return ["Error: All fields are required", 401];
  else if (!user) return ["Error: No user", 401];

  if (new_password === confirm_password) {
    let username = user.username;
    const encryptedPassword = bcrypt.hashSync(new_password.trim(), 10);
    if (user.first_login) {
      await db.none(
        "UPDATE users SET password = $1, first_login = $2 WHERE username = $3",
        [encryptedPassword, false, username]
      );
      return ["Password changed successfully", 200];
    }
  } else {
    return ["Password did not match", 400];
  }
}

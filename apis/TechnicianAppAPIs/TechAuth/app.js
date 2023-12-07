const db = require("/opt/nodejs/utils/db.js");
const responseHandler = require("/opt/nodejs/utils/responseHandler.js");
const addclienttransaction = require("/opt/nodejs/utils/clientTransactions.js");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const authcode = require("/opt/nodejs/utils/accessCodes.js");

exports.lambdaHandler = async (event, context) => {
  let ip = event["requestContext"]["identity"]["sourceIp"];
  let useragent = event["requestContext"]["identity"]["userAgent"];
  let statusCode = 200;
  let data;
  let httpMethod = event.httpMethod;
  let path = event.path;
  path = path.replace(/([^\/]*\/){2}/, ""); //getting the last path from -> "/dropdown/{path}"

  try {
    switch (httpMethod) {
      //Handling Cors
      case "OPTIONS":
        if (path === "login" || path === "verify" || path === "reset") {
          [data, statusCode] = ["Success", 200];
        } else {
          [data, statusCode] = ["Error: Invalid Request", 400];
        }
        break;

      //Post functions
      case "POST":
        let body = JSON.parse(event.body);

        if (path === "login")
          [data, statusCode] = await login(
            body.userInfo,
            ip,
            useragent,
            context
          );
        else if (path === "verify") [data, statusCode] = await verify(body);
        else if (path === "reset")
          [data, statusCode] = await resetPassword(body);

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

//Logging into user account
//Inputs - username, password
//Output - Logged in
async function login(userInfo, ip, useragent) {
  let { username, password, client_id } = { ...userInfo };

  //Checking required fields
  if (!username || !password) return ["Error: All fields are required", 401];
  if (!client_id) return ["Error: Client ID Missing", 401];

  //Checking if user exists and comparing password
  const user = await db.oneOrNone(
    `SELECT cu.*, cr.authorizations as authorizations FROM ${client_id}_users cu JOIN ${client_id}_user_roles cr ON cu.role = cr.id WHERE cu.username = $1`,
    [username]
  );
  if (!user || !user.username) return ["Error: No User found", 401];
  else if (user.status === "INACTIVE")
    return ["Error: Inactive User, Please contact System Administrator", 401];
  else if (!user.authorizations.includes(authcode.TECHNICIAN))
    return ["Error: Invalid User, Please contact System Administrator", 401];
  else {
    if (!bcrypt.compareSync(password, user.password)) {
      return ["Error: Incorrect password", 403];
    }
    let new_user = {
      username: user.username,
      name: user.name,
      role: user.role,
      authorizations: JSON.stringify(user.authorizations),
      first_login: user.first_login,
      client_id: client_id,
      ip: ip,
      useragent: useragent,
    };
    const token = generateToken(new_user);

    const responseBody = {
      user: new_user,
      token,
    };
    await addclienttransaction(user.username, client_id, "Login");
    return [responseBody, 200];
  }
}

//Verifying Token
//Input - Token
function verify({ user, token }) {
  if (!user || !user.username || !user.name) return ["Invalid Token", 401];

  verification = jwt.verify(token, process.env.SECRET_KEY, (err, res) => {
    if (err) return "Invalid Token";
    if (res.username !== user.username || res.name !== user.name)
      return "Invalid Token";
    return { verified: true, mssg: "Verified" };
  });

  if (!verification.verified) {
    return [verification, 401];
  } else {
    return [verification, 200];
  }
}

//Generate JWT
//Input - User object
//Output - Token
function generateToken(user) {
  if (!user) return null;
  return jwt.sign(user, process.env.SECRET_KEY, {
    expiresIn: "8h",
  });
}

function generateClientToken(client) {
  if (!client) return null;
  return jwt.sign(client, process.env.SECRET_KEY, {
    expiresIn: "8h",
  });
}

//Reseting password for the first time
//Inputs - new password, confirm password
//Outpus - password changed successfully
async function resetPassword(body) {
  let { old_password, new_password, user } = { ...body };

  //Checking required fields
  if (!old_password || !new_password)
    return ["Error: All fields are required", 401];
  else if (!user) return ["Error: No user", 401];

  let username = user.username;
  let client_id = user.client_id;
  let data = await db.one(
    `SELECT password FROM ${client_id}_users WHERE username = $1`,
    [username]
  );
  if (!bcrypt.compareSync(old_password, data.password)) {
    return ["Error: Old Password is Incorrect", 403];
  } else {
    const encryptedPassword = bcrypt.hashSync(new_password.trim(), 10);
    if (user.first_login) {
      await db.none(
        `UPDATE ${client_id}_users SET password = $1, first_login = $2 WHERE username = $3`,
        [encryptedPassword, false, username]
      );
      return ["Password changed successfully", 200];
    } else {
      await db.none(
        `UPDATE ${client_id}_users SET password = $1 WHERE username = $2`,
        [encryptedPassword, username]
      );
      return ["Password changed successfully", 200];
    }
  }
}

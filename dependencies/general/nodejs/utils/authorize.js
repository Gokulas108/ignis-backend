const jwt = require("jsonwebtoken");

async function authorize(
  accesscode,
  clienttoken,
  token,
  apifunction,
  superadmin = false
) {
  let client_verified = jwt.verify(
    clienttoken,
    process.env.SECRET_KEY,
    async (err, res) => {
      if (err) {
        console.log(err);
        return null;
      }
      return res.client_id;
    }
  );

  if (client_verified) {
    return jwt.verify(
      token,
      superadmin ? process.env.SUPER_SECRET_KEY : process.env.SECRET_KEY,
      async (err, res) => {
        if (err) {
          console.log(err);
          return ["Invalid Token", 401];
        }
        if (!superadmin && !res.roles.includes(accesscode))
          return ["Not Authorized", 403];
        return await apifunction(res.id, client_verified);
      }
    );
  } else {
    return ["Client Not Authorized", 403];
  }
}
module.exports = authorize;

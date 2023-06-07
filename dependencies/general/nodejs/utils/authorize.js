const jwt = require("jsonwebtoken");

async function authorize(accesscode, token, apifunction, superadmin = false) {
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
      return await apifunction(res.id);
    }
  );
}
module.exports = authorize;

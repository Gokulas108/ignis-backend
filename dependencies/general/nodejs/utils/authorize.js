const jwt = require("jsonwebtoken");

async function authorize(
  accesscode,
  ip,
  useragent,
  token,
  apifunction,
  superadmin = false
) {
  return jwt.verify(
    token,
    superadmin ? process.env.SUPER_SECRET_KEY : process.env.SECRET_KEY,
    async (err, res) => {
      console.log(res);
      if (err) {
        console.log(err);
        return ["Invalid Token", 401];
      }
      if (ip === res.ip && useragent === res.useragent) {
        if (!superadmin) {
          let authorizations = JSON.parse(res.authorizations);
          if (!authorizations.includes(accesscode))
            return ["Not Authorized", 403];
        }
        return await apifunction(res.id, res.client_id);
      } else return ["Not Authorized", 403];
    }
  );
}

module.exports = authorize;

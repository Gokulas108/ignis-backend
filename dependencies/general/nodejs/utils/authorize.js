const jwt = require("jsonwebtoken");

async function authorize(
  accesscode,
  clienttoken,
  token,
  apifunction,
  superadmin = false
) {
  let verified_client = null;

  try {
    verified_client = jwt.verify(clienttoken, process.env.SECRET_KEY);
  } catch (err) {
    return ["Client Not Authorized", 403];
  }

  return jwt.verify(
    token,
    superadmin ? process.env.SUPER_SECRET_KEY : process.env.SECRET_KEY,
    async (err, res) => {
      if (err) {
        console.log(err);
        return ["Invalid Token", 401];
      }
      if (!superadmin && !res.authorizations.includes(accesscode))
        return ["Not Authorized", 403];
      return await apifunction(res.id, verified_client.client_id);
    }
  );
}

module.exports = authorize;

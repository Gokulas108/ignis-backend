const jwt = require("jsonwebtoken");

async function authorize(usertypes, token, apifunction) {
	return jwt.verify(token, "mysecretkey30903xcdfsdfg", async (err, res) => {
		if (err) {
			console.log(err);
			return ["Invalid Token", 401];
		}
		if (!usertypes.includes(res.role)) return ["Not Authorized", 403];
		return await apifunction(res.id);
	});
}
module.exports = authorize;

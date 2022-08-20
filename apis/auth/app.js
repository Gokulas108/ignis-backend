const db = require("/opt/nodejs/utils/db.js");
const responseHandler = require("/opt/nodejs/utils/responseHandler.js");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

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

//Registering an user account
// INPUTS - Name, User type, Email
//OUTPUTS - User created  successfully
async function registerAccount(userInfo) {
	let { name, email, password, role } = { ...userInfo };

	//Checking all fields
	if (!name || !email || !password || !role)
		return ["Error: All fields are required", 401];

	//Checking if user already exist
	const users = await db.any("SELECT * FROM users WHERE email = $1", [email]);
	if (users.length) return ["Error: User already exist", 401];

	//Registering user
	const encryptedPassword = bcrypt.hashSync(password.trim(), 10);
	email = email.toLowerCase().trim();
	role = role.toLowerCase().trim();
	await db.none(
		"INSERT INTO users(name, email, password, role) VALUES($1, $2, $3, $4)",
		[name, email, encryptedPassword, role]
	);
	return ["User created successfully", 200];
}

//Logging into user account
//Inputs - Email, password
//Output - Logged in
async function login(userInfo) {
	let { email, password } = { ...userInfo };

	//Checking required fields
	if (!email || !password) return ["Error: All fields are required", 401];

	//Checking if user exists and comparing password
	const user = await db.oneOrNone("SELECT * FROM users WHERE email = $1", [
		email,
	]);
	if (!user || !user.email) return ["Error: No User found", 401];
	else {
		if (!bcrypt.compareSync(password, user.password)) {
			return ["Error: Incorrect password", 403];
		}
		let new_user = {
			email: user.email,
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
	if (!user || !user.email || !user.role || !user.name)
		return [{ verified: false, mssg: "incorrect request body" }, 400];

	verification = jwt.verify(token, "mysecretkey30903xcdfsdfg", (err, res) => {
		if (err) return { verified: false, mssg: "invalid token" };
		if (
			res.email !== user.email ||
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
		expiresIn: "1h",
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
		let email = user.email;
		const encryptedPassword = bcrypt.hashSync(new_password.trim(), 10);
		if (user.first_login) {
			await db.none(
				"UPDATE users SET password = $1, first_login = $2 WHERE email = $3",
				[encryptedPassword, false, email]
			);
			return ["Password changed successfully", 200];
		}
	} else {
		return ["Password did not match", 400];
	}
}

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
					path === "users" ||
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

//Registering an user account
// INPUTS - Name, User type, username
//OUTPUTS - User created  successfully
async function registerAccount(userInfo) {
	let { name, username, password, role } = { ...userInfo };

	//Checking all fields
	if (!name || !username || !password || !role)
		return ["Error: All fields are required", 401];

	//Checking if user already exist
	const users = await db.any("SELECT * FROM users WHERE username = $1", [
		username,
	]);
	if (users.length) return ["Error: User already exist", 401];

	//Registering user
	const encryptedPassword = bcrypt.hashSync(password.trim(), 10);
	username = username.toLowerCase().trim();
	role = role.toLowerCase().trim();
	await db.none(
		"INSERT INTO users(name, username, password, role) VALUES($1, $2, $3, $4)",
		[name, username, encryptedPassword, role]
	);
	return ["User created successfully", 200];
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

const db = require("/opt/nodejs/utils/db.js");
const responseHandler = require("/opt/nodejs/utils/responseHandler.js");

exports.lambdaHandler = async (event, context) => {
	let statusCode = 200;
	let data;
	let httpMethod = event.httpMethod;
	let path = event.path;
	path = path.replace(/([^\/]*\/){2}/, ""); //getting the last path from -> "/assets/{path}"

	try {
		switch (httpMethod) {
			//Handling Cors
			case "OPTIONS":
				if (
					path === "systems" ||
					path === "devices" ||
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
				if (path === "systems") [data, statusCode] = await getSystems();
				else if (path === "devices") {
					let params = event.queryStringParameters;
					sys_id = parseInt(params.sys_id);
					page = parseInt(params.page);
					limit = parseInt(params.limit);
					[data, statusCode] = await getDevices(
						sys_id,
						page,
						limit,
						params.searchText
					);
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

async function getSystems() {
	let systems = await db.any("SELECT * FROM systems");
	return [systems, 200];
}

async function getDevices(sys_id = 0, page = 1, limit = 10, searchText = "") {
	let offset = (page - 1) * limit;
	let users;
	if (searchText === "") {
		users = await db.any(
			`SELECT id, name, activity, frequency, count(*) OVER() AS full_count FROM devices WHERE system_id = $1 ORDER BY id DESC OFFSET $2 LIMIT $3`,
			[sys_id, offset, limit]
		);
	} else {
		searchText = `%${searchText}%`;
		users = await db.any(
			`SELECT id, name, activity, frequency, count(*) OVER() AS full_count FROM devices WHERE system_id = $1 AND name iLIKE $2 OR activity iLIKE $2 OR frequency iLIKE $2 ORDER BY id DESC OFFSET $3 LIMIT $4`,
			[sys_id, searchText, offset, limit]
		);
	}

	let data = users;
	let statusCode = 200;
	return [data, statusCode];
}

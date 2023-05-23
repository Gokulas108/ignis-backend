const db = require("/opt/nodejs/utils/db.js");
const responseHandler = require("/opt/nodejs/utils/responseHandler.js");

exports.lambdaHandler = async (event, context) => {
	let statusCode = 200;
	let data, body;
	let httpMethod = event.httpMethod;

	try {
		switch (httpMethod) {
			case "OPTIONS":
				[data, statusCode] = ["Success", 200];
				break;
			case "GET":
				if (event.pathParameters && event.pathParameters.id) {
					console.log(event.pathParameters.id);
					[data, statusCode] = await getSystem(event.pathParameters.id);
				} else if (event.queryStringParameters) {
					let params = event.queryStringParameters;
					if (params.page && params.limit) {
						page = parseInt(params.page);
						limit = parseInt(params.limit);
						[data, statusCode] = await getSystems(
							page,
							limit,
							params.searchText
						);
					} else {
						throw new Error("Missing Page or Limit");
					}
				} else {
					throw new Error("Missing ID");
				}
				break;
			case "POST":
				body = JSON.parse(event.body);
				[data, statusCode] = await addSystem(body.client);
				break;
			case "DELETE":
				body = JSON.parse(event.body);
				[data, statusCode] = await deleteSystem(body.id);
				break;
			default:
				[data, statusCode] = ["Error: Invalid request", 400];
		}
	} catch (err) {
		statusCode = 400;
		data = err.message;
	}

	response = responseHandler(data, statusCode);
	return response;
};

async function getSystems(page = 1, limit = 10, searchText = "") {
	let offset = (page - 1) * limit;
	let data;
	if (searchText === "") {
		data = await db.any(
			`SELECT sys.* , sa.name as uname, sa.username as username, count(sys.*) OVER() AS full_count FROM systemtypes sys JOIN superadmins sa ON sys.createdBy = sa.id ORDER BY sys.name OFFSET $1 LIMIT $2`,
			[offset, limit]
		);
	} else {
		searchText = `%${searchText}%`;
		data = await db.any(
			`SELECT sys.* , sa.name as uname, sa.username as username, count(sys.*) OVER() AS full_count FROM systemtypes sys JOIN superadmins sa ON sys.createdBy = sa.id WHERE sys.name iLIKE $1 OR user.name iLIKE $1 OR user.username iLIKE $1 ORDER BY sys.name OFFSET $2 LIMIT $3`,
			[searchText, offset, limit]
		);
	}
	return [data, 200];
}

async function getSystem(id) {
	let sys_id = parseInt(id);
	const data = await db.any(
		"SELECT sys.*, sa.name as uname, sa.username, count(sys.*) OVER() AS full_count FROM systemtypes sys JOIN superadmins sa ON sys.createdBy= sa.id WHERE sys.id = $1",
		[sys_id]
	);
	return [data, 200];
}

async function deleteSystem(id) {
	let sys_id = parseInt(id);
	await db.none("DELETE FROM systemtypes WHERE id = $1", [sys_id]);
	return ["System Successfully Deleted", 200];
}

async function addSystem({ name, createdBy = 1 }) {
	if (!name || !createdBy) throw new Error("Missing required fields");

	const date_now = new Date().toISOString();

	await db.none(
		"INSERT into systemtypes (name,  createdBy, createdAt, updatedAt) VALUES ($1, $2, $3, $4)",
		[name, createdBy, date_now, date_now]
	);

	return ["System Successfully Added", 200];
}

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
					[data, statusCode] = await getSuperAdmin(event.pathParameters.id);
				} else if (event.queryStringParameters) {
					let params = event.queryStringParameters;
					if (params.page && params.limit) {
						page = parseInt(params.page);
						limit = parseInt(params.limit);
						[data, statusCode] = await getSuperAdmins(
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
				[data, statusCode] = await addSuperAdmin(body.client);
				break;
			// case "DELETE":
			// body = JSON.parse(event.body);
			// [data, statusCode] = await deleteSuperAdmin(body.id);
			// break;
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

async function getSuperAdmins(page = 1, limit = 10, searchText = "") {
	let offset = (page - 1) * limit;
	let data;
	if (searchText === "") {
		data = await db.any(
			`SELECT sa.id as id, sa.name AS name, sa.username AS username, sa.role as role, cli.name as client, count(sa.*) OVER() AS full_count FROM superadmins sa JOIN clients cli ON sa.clientid = cli.id ORDER BY sa.name OFFSET $1 LIMIT $2`,
			[offset, limit]
		);
	} else {
		searchText = `%${searchText}%`;
		data = await db.any(
			`SELECT sa.id as id, sa.name AS name, sa.username AS username, sa.role as role, cli.name as client, count(sa.*) OVER() AS full_count FROM superadmins sa JOIN clients cli ON sa.clientid = cli.id WHERE sa.name iLIKE $1 OR sa.username iLIKE $1 ORDER BY sa.name OFFSET $2 LIMIT $3`,
			[searchText, offset, limit]
		);
	}
	return [data, 200];
}

async function getSuperAdmin(id) {
	let sa_id = parseInt(id);
	const data = await db.any(
		"SELECT sa.id as id, sa.name as name, sa.username as username, sa.role as role, cli.name as client FROM superadmins sa JOIN clients cli ON sa.clientid = cli.id WHERE sa.id = $1",
		[sa_id]
	);
	return [data, 200];
}

async function addSuperAdmin({
	name,
	username,
	role = "superadmin",
	password = "123456",
	clientId,
	createdBy,
}) {
	if (!name || !username || !clientId || !createdBy)
		throw new Error("Missing required fields");

	const date_now = new Date().toISOString();

	await db.none(
		"INSERT into superadmins (name, username, password, role, clientid, createdBy, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
		[name, username, password, role, clientId, createdBy, date_now, date_now]
	);

	return ["Super Admin Successfully Added", 200];
}

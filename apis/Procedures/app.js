const db = require("/opt/nodejs/utils/db.js");
const responseHandler = require("/opt/nodejs/utils/responseHandler.js");
const authorize = require("/opt/nodejs/utils/authorize.js");

exports.lambdaHandler = async (event, context) => {
	let statusCode = 200;
	let data, body;
	let httpMethod = event.httpMethod;
	let token = event.headers["ignistoken"];

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
					if (params.page && params.limit && params.system) {
						system = parseInt(params.system);
						activity = params.activity;
						page = parseInt(params.page);
						limit = parseInt(params.limit);
						[data, statusCode] = await getProcedures(
							page,
							limit,
							params.searchText,
							system,
							activity
						);
					} else {
						throw new Error("Missing System, Page or Limit");
					}
				} else {
					throw new Error("Missing ID");
				}
				break;

			case "POST":
				body = JSON.parse(event.body);
				[data, statusCode] = await authorize(
					["admin"],
					token,
					async (id) => await addProcedure(body)
				);
				break;

			case "PUT":
				body = JSON.parse(event.body);
				[data, statusCode] = await authorize(
					["admin"],
					token,
					async (id) => await updateSystemFields(body)
				);
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

async function getProcedures(
	page = 1,
	limit = 10,
	searchText = "",
	system,
	activity
) {
	if (!system) throw new Error("Missing System");
	if (!activity) throw new Error("Missing Activity");

	let offset = (page - 1) * limit;
	let data;
	if (searchText === "") {
		data = await db.any(
			`SELECT *, count(*) OVER() AS full_count FROM procedures WHERE system = $1 AND activity = $2 OFFSET $3 LIMIT $4`,
			[system, activity, offset, limit]
		);
	} else {
		searchText = `%${searchText}%`;
		data = await db.any(
			`SELECT *, count(*) OVER() AS full_count FROM procedures WHERE system = $1 AND activity = $2 OFFSET $3 LIMIT $4`,
			[system, activity, offset, limit]
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

async function addProcedure({
	code,
	procedure,
	system,
	devices,
	activity,
	createdBy = 1,
}) {
	if (!code || !createdBy || !system || !activity || !devices)
		throw new Error("Missing required fields");
	const date_now = new Date().toISOString();

	await db.none(
		"INSERT into procedures (code, procedure, system, devices, activity, createdBy, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
		[code, procedure, system, devices, activity, createdBy, date_now, date_now]
	);

	return ["Procedure Successfully Added", 200];
}

async function updateSystemFields({ id, general_information }) {
	if (!id) throw new Error("Missing Id");
	const date_now = new Date().toISOString();

	const query =
		"UPDATE systemtypes SET general_information = $1::json[], updatedat = $2 WHERE id = $3";
	await db.none(query, [general_information, date_now, id]);

	return ["System General Fields Updated", 200];
}

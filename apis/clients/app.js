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
				let params = event.queryStringParameters;
				if (params.id) {
					[data, statusCode] = await getClient(params.id);
				} else {
					page = parseInt(params.page);
					limit = parseInt(params.limit);
					[data, statusCode] = await getClients(page, limit, params.searchText);
				}
				break;
			case "POST":
				body = JSON.parse(event.body);
				[data, statusCode] = await addClient(body.client);
				break;
			case "DELETE":
				body = JSON.parse(event.body);
				[data, statusCode] = await deleteClient(body.id);
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

async function getClients(page = 1, limit = 10, searchText = "") {
	let offset = (page - 1) * limit;
	let users;
	if (searchText === "") {
		users = await db.any(
			`SELECT cli.id as id, cli.name AS name, co.name AS country, count(cli.*) OVER() AS full_count FROM client cli JOIN country_iso co ON cli.country = co.country_iso ORDER BY id DESC OFFSET $1 LIMIT $2`,
			[offset, limit]
		);
	} else {
		searchText = `%${searchText}%`;
		users = await db.any(
			`SELECT cli.id as id, cli.name AS name, co.name AS country, count(cli.*) OVER() AS full_count FROM client cli JOIN country_iso co ON cli.country = co.country_iso WHERE cli.name iLIKE $1 OR co.name iLIKE $1 ORDER BY id DESC OFFSET $2 LIMIT $3`,
			[searchText, offset, limit]
		);
	}

	let data = users;
	let statusCode = 200;
	return [data, statusCode];
}

async function getClient(id) {
	const data = await db.one("SELECT name FROM client WHERE client_id = $1", [
		id,
	]);
	return [data, 200];
}

async function addClient({ name, clientId, country }) {
	if (!name || !country) throw new Error("Missing required fields");

	await db.none(
		"INSERT into client (name, client_id, country) VALUES ($1, $2, $3)",
		[name, clientId, country]
	);

	return ["Client Successfully Added", 200];
}

async function deleteClient(id) {
	if (!id) throw new Error("ID Missing!");

	await db.none("DELETE FROM client WHERE id = $1", [id]);

	return ["Client Successfully Removed", 200];
}

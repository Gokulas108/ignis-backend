const db = require("/opt/nodejs/utils/db.js");
const responseHandler = require("/opt/nodejs/utils/responseHandler.js");

exports.lambdaHandler = async (event, context) => {
	let statusCode = 200;
	let data;
	let httpMethod = event.httpMethod;

	try {
		switch (httpMethod) {
			case "OPTIONS":
				[data, statusCode] = ["Success", 200];
				break;
			case "GET":
				[data, statusCode] = await getClients();
				break;
			case "POST":
				let body = JSON.parse(event.body);
				[data, statusCode] = await addClient(body.client);
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

async function getClients() {
	const users = await db.any(`SELECT * FROM clients ORDER BY id DESC`);
	let data = users;
	let statusCode = 200;
	return [data, statusCode];
}

async function addClient({ name, country, timezone, menu }) {
	if (!name || !country || !timezone)
		throw new Error("Missing required fields");
}

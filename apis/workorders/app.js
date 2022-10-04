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
				[data, statusCode] = await getWorkOrders(userId);
				break;
			case "POST":
				// let body = JSON.parse(event.body);
				// [data, statusCode] = await addBuilding(body.building);
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

async function getWorkOrders(userId) {
	await db.any("SELECT * FROM workorders WHERE ");
}

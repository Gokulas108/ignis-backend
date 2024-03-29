//Notification module
//Consists of all the APIs for notification page.(Getting notification details, Adding new notification)

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
				let params = event.queryStringParameters;
				page = parseInt(params.page);
				limit = parseInt(params.limit);
				[data, statusCode] = await getNotifications(
					page,
					limit,
					params.searchText
				);
				break;
			case "POST":
				let body = JSON.parse(event.body);
				[data, statusCode] = await addNotification(body.notification);
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

//Getting notification details from the backend
// async function getNotifications() {
// 	const users = await db.any(
// 		`SELECT n.*, c.contract_number FROM notifications n JOIN buildings b ON n.building_id = b.id ORDER BY n.id DESC`
// 	);
// 	let data = users;
// 	let statusCode = 200;
// 	return [data, statusCode];
// }

async function getNotifications(page = 1, limit = 10, searchText = "") {
	let offset = (page - 1) * limit;
	let users;
	if (searchText === "") {
		users = await db.any(
			`select n.*, cb.contract_number, cb.building_name, cb.building_id, count(n.*) OVER() AS full_count from notification n join (select c.id as id, c.contract_number as contract_number, c.building_id as building_id, b.building_name as building_name from contracts c join buildings b on c.building_id = b.id) cb on n.contract_id = cb.id WHERE status='open' ORDER BY n.contract_id DESC OFFSET $1 LIMIT $2`,
			[offset, limit]
		);
	} else {
		searchText = `%${searchText}%`;
		users = await db.any(
			`select n.*, cb.contract_number, cb.building_name, cb.building_id, count(n.*) OVER() AS full_count from notification n join (select c.id as id, c.contract_number as contract_number, c.building_id as building_id, b.building_name as building_name from contracts c join buildings b on c.building_id = b.id) cb on n.contract_id = cb.id WHERE (n.type iLIKE $1 OR cb.contract_number iLIKE $1 OR cb.building_name iLIKE $1) AND status='open' ORDER BY n.contract_id DESC OFFSET $2 LIMIT $3`,
			[searchText, offset, limit]
		);
	}

	let data = users;
	let statusCode = 200;
	return [data, statusCode];
}

//Adding a new notification
//Input - Building id, Notification details
//output - Notification added for a building
async function addNotification(notification) {
	let { contract_id, reason, itm, systems } = {
		...notification,
	};

	if (!contract_id || !itm || !systems) throw new Error("Incompete details");
	if (!reason) reason = "";

	await db.none(
		"INSERT INTO notification (type, contract_id, system, activity, reason, status) values ($1, $2, $3, $4, $5, $6)",
		["task", contract_id, systems, itm, reason, "open"]
	);

	return ["Notification Added", 200];
}

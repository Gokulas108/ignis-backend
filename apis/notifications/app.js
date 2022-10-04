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
			`select n.*, cb.contract_number, cb.building_name from notifications n join (select c.id as id, c.contract_number as contract_number, b.building_name as building_name from contracts c join buildings b on c.building_id = b.id) cb on n.contract_id = cb.id ORDER BY n.id DESC OFFSET $1 LIMIT $2`,
			[offset, limit]
		);
	} else {
		searchText = `%${searchText}%`;
		users = await db.any(
			`select n.*, cb.contract_number, cb.building_name from notifications n join (select c.id as id, c.contract_number as contract_number, b.building_name as building_name from contracts c join buildings b on c.building_id = b.id) cb on n.contract_id = cb.id WHERE n.notification_type iLIKE $1 OR cb.contract_number iLIKE $1 OR cb.building_name iLIKE $1 ORDER BY id DESC OFFSET $2 LIMIT $3`,
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
	let { building_id, notification_type, reason, fire_protection_systems } = {
		...notification,
	};

	if (!building_id || !notification_type || !fire_protection_systems)
		throw new Error("Incompete details");
	if (!reason) reason = "";

	await db.none(
		"INSERT INTO notifications (building_id, notification_type, reason, fire_protection_systems) values ($1, $2, $3, $4::json[])",
		[building_id, notification_type, reason, fire_protection_systems]
	);

	return ["Notification Added", 200];
}

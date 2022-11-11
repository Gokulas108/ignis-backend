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
				[data, statusCode] = await getWorkOrders(
					page,
					limit,
					params.status,
					params.searchText
				);
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

async function getWorkOrders(
	page = 1,
	limit = 10,
	status = "Pending",
	searchText = ""
) {
	let offset = (page - 1) * limit;
	let users;
	if (searchText === "") {
		users = await db.any(
			`SELECT wo.*, b.building_name, b.building_area, b.building_no, b.street_no, b.zone_no, b.unit_no, count(*) OVER() AS full_count FROM buildings b join (SELECT w.*, u.name as assigned_to from workorders w join users u on w.user_id = u.id) wo on b.id = wo.building_id WHERE wo.status = $1 ORDER BY wo.wo_id DESC OFFSET $2 LIMIT $3`,
			[status, offset, limit]
		);
	} else {
		searchText = `%${searchText}%`;
		users = await db.any(
			`SELECT id, building_name, building_area, building_completion_certificate_number, count(*) OVER() AS full_count FROM buildings WHERE building_name iLIKE $1 OR building_area iLIKE $1 OR building_completion_certificate_number iLIKE $1 ORDER BY id DESC OFFSET $2 LIMIT $3`,
			[searchText, offset, limit]
		);
	}

	let data = users;
	let statusCode = 200;
	return [data, statusCode];
}

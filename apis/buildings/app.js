5; //Building module
//Consists of all APIs for building page.(Adding building, getting building details)

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
				if (params?.column_name === "names")
					[data, statusCode] = await getBuildingsByName();
				else if (params?.id)
					[data, statusCode] = await getBuildingById(params.id);
				else {
					page = parseInt(params.page);
					limit = parseInt(params.limit);
					[data, statusCode] = await getBuildings(
						page,
						limit,
						params.searchText
					);
				}
				break;
			case "POST":
				body = JSON.parse(event.body);
				[data, statusCode] = await addBuilding(body.building);
				break;
			case "PUT":
				body = JSON.parse(event.body);
				[data, statusCode] = await updateBuilding(body.building);
				break;
			case "DELETE":
				body = JSON.parse(event.body);
				[data, statusCode] = await deleteBuilding(body.id);
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

//Getting all building details
//Output - Object of all buildings
// async function getBuildings() {
// 	const users = await db.any(`SELECT * FROM buildings ORDER BY id DESC`);
// 	let data = users;
// 	let statusCode = 200;
// 	return [data, statusCode];
// }

async function getBuildings(page = 1, limit = 10, searchText = "") {
	let offset = (page - 1) * limit;
	let users;
	if (searchText === "") {
		users = await db.any(
			`SELECT id, building_name, building_area, building_completion_certificate_number, count(*) OVER() AS full_count FROM buildings ORDER BY id DESC OFFSET $1 LIMIT $2`,
			[offset, limit]
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

async function getBuildingsByName() {
	const users = await db.any(
		`SELECT id, building_name FROM buildings ORDER BY id DESC`
	);
	let data = users;
	let statusCode = 200;
	return [data, statusCode];
}

async function getBuildingById(id) {
	const users = await db.one(`SELECT * FROM buildings WHERE id = $1`, [id]);
	let data = users;
	let statusCode = 200;
	return [data, statusCode];
}

//Adding a new building
//Input - Building details
//Output - Added successfully
async function addBuilding(data) {
	let column_names = Object.keys(data);
	column_names = column_names.join();
	let values = Object.values(data);
	let col_values = values;
	values = values.map(
		(value, index) =>
			`$${index + 1}${
				Array.isArray(value)
					? typeof value[0] === "object" && value[0] !== null
						? "::json[]"
						: ""
					: ""
			}`
	);
	values = values.join();
	let sql_stmt = `INSERT INTO buildings (${column_names}) VALUES (${values}) RETURNING id`;
	const building = await db.one(sql_stmt, col_values);

	// sql_stmt = `INSERT INTO notifications (building_id, notification_type, fire_protection_systems, reason) VALUES ($1,$2, $3::json[], $4) RETURNING id`;
	// const asset_notification = await db.one(sql_stmt, [
	// 	building.id,
	// 	"Asset Tagging",
	// 	building.fire_protection_systems,
	// 	"Tag assets for the added building",
	// ]);

	// const frequencies = [
	// 	...new Set(building.fire_protection_systems.map((fps) => fps.frequency)),
	// ];
	// const systems = groupBy(
	// 	building.fire_protection_systems,
	// 	(fps) => fps.frequency
	// );

	// for (x in frequencies) {
	// 	let system = systems.get(frequencies[x]);
	// 	if (system) {
	// 		let system_names = system.map((item) => item.label);
	// 		system_names = system_names.join(", \n");
	// 		let reason = `${
	// 			frequencies[x] === "semiAnnually"
	// 				? "Semi-Annual"
	// 				: frequencies[x] === "annually"
	// 				? "Annual"
	// 				: capitalizeFirstLetter(frequencies[x])
	// 		} Inspection, Testing and Maintanance for following systems : \n${system_names}`;
	// 		let sql_stmt2 = `INSERT INTO notifications (building_id, notification_type, fire_protection_systems, reason) VALUES ($1,$2, $3::json[], $4) RETURNING id`;
	// 		const notification = await db.one(sql_stmt2, [
	// 			building.id,
	// 			"Preventive",
	// 			system,
	// 			reason,
	// 		]);
	// 	}
	// }
	return [building, 200];
}

async function updateBuilding(data) {
	let column_names = Object.keys(data);
	// column_names = column_names.join();
	let values = Object.values(data);
	let col_values = values;
	values = values.map(
		(value, index) =>
			`$${index + 1}${
				Array.isArray(value)
					? typeof value[0] === "object" && value[0] !== null
						? "::json[]"
						: ""
					: ""
			}`
	);
	// values = values.join();
	let update_statement = column_names.map(
		(name, index) => `${name} = ${values[index]}`
	);
	update_statement = update_statement.join();
	let sql_stmt = `UPDATE buildings SET ${update_statement} WHERE id=(${data.id})`;
	await db.none(sql_stmt, col_values);

	return ["Updated Successfully!", 200];
}
//######### HELPER FUNCTIONS #############

function capitalizeFirstLetter(string) {
	return string.charAt(0).toUpperCase() + string.slice(1);
}

function validateInputToTable(columns, input) {
	let keys = Object.keys(input);
	const keys_set = [...new Set(keys).values()];
	const columns_set = [...new Set(columns).values()];
	const validated = keys_set.every((x) => columns_set.includes(x));
	return validated;
}

function groupBy(list, keyGetter) {
	const map = new Map();
	list.forEach((item) => {
		const key = keyGetter(item);
		const collection = map.get(key);
		if (!collection) {
			map.set(key, [item]);
		} else {
			collection.push(item);
		}
	});
	return map;
}

async function deleteBuilding(id) {
	if (!id) throw new Error("ID Missing!");

	await db.none("DELETE FROM buildings WHERE id = $1", [id]);

	return ["Building removed successfully", 200];
}

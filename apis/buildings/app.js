//Building module
//Consists of all APIs for building page.(Adding building, getting building details)

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
				[data, statusCode] = await getBuildings();
				break;
			case "POST":
				let body = JSON.parse(event.body);
				[data, statusCode] = await addBuilding(body.building);
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
async function getBuildings() {
	const users = await db.any(`SELECT * FROM buildings ORDER BY id DESC`);
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
	let sql_stmt = `INSERT INTO buildings (${column_names}) VALUES (${values}) RETURNING id, fire_protection_systems`;
	const building = await db.one(sql_stmt, col_values);

	sql_stmt = `INSERT INTO notifications (building_id, notification_type, fire_protection_systems, reason) VALUES ($1,$2, $3::json[], $4) RETURNING id`;
	const asset_notification = await db.one(sql_stmt, [
		building.id,
		"Asset Tagging",
		building.fire_protection_systems,
		"Tag assets for the added building",
	]);

	const frequencies = [
		...new Set(building.fire_protection_systems.map((fps) => fps.frequency)),
	];
	const systems = groupBy(
		building.fire_protection_systems,
		(fps) => fps.frequency
	);

	for (x in frequencies) {
		let system = systems.get(frequencies[x]);
		if (system) {
			let system_names = system.map((item) => item.label);
			system_names = system_names.join(", \n");
			let reason = `${
				frequencies[x] === "semiAnnually"
					? "Semi-Annual"
					: frequencies[x] === "annually"
					? "Annual"
					: capitalizeFirstLetter(frequencies[x])
			} Inspection, Testing and Maintanance for following systems : \n${system_names}`;
			let sql_stmt2 = `INSERT INTO notifications (building_id, notification_type, fire_protection_systems, reason) VALUES ($1,$2, $3::json[], $4) RETURNING id`;
			const notification = await db.one(sql_stmt2, [
				building.id,
				"Preventive",
				system,
				reason,
			]);
		}
	}
	return ["success", 200];
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

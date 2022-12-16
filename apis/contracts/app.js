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
				let params = event.queryStringParameters;
				building_id = parseInt(params.building_id);
				page = parseInt(params.page);
				limit = parseInt(params.limit);
				[data, statusCode] = await getContracts(
					building_id,
					page,
					limit,
					params.searchText
				);
				break;
			case "POST":
				let body = JSON.parse(event.body);
				[data, statusCode] = await addContract(body.contract);
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
async function getContracts(
	building_id = 0,
	page = 1,
	limit = 10,
	searchText = ""
) {
	let offset = (page - 1) * limit;
	let users;
	if (searchText === "") {
		users = await db.any(
			`SELECT con.id as id, con.contract_number AS contract_number, ct.value as contract_type, con.total_contract_value AS total_contract_value,  con.fire_protection_systems AS fire_protection_systems, count(con.*) OVER() AS full_count FROM contracts con JOIN contract_type ct ON con.contract_type = ct.id WHERE con.building_id = $1 ORDER BY id DESC OFFSET $2 LIMIT $3`,
			[building_id, offset, limit]
		);
	} else {
		searchText = `%${searchText}%`;
		users = await db.any(
			`SELECT con.id as id, con.contract_number AS contract_number, ct.value as contract_type, con.total_contract_value AS total_contract_value,  con.fire_protection_systems AS fire_protection_systems, count(con.*) OVER() AS full_count FROM contracts con JOIN contract_type ct ON con.contract_type = ct.id WHERE con.building_id = $1 AND con.contract_number iLIKE $2 OR ct.value iLIKE $2 OR con.total_contract_value iLIKE $2 ORDER BY id DESC OFFSET $3 LIMIT $4`,
			[building_id, searchText, offset, limit]
		);
	}

	let data = users;
	let statusCode = 200;
	return [data, statusCode];
}

//Adding a new building
//Input - Building details
//Output - Added successfully
async function addContract(data) {
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
	let sql_stmt = `INSERT INTO contracts (${column_names}) VALUES (${values}) RETURNING id, fire_protection_systems, contract_number`;
	const contract = await db.one(sql_stmt, col_values);

	let systems = contract.fire_protection_systems.map((system) => system.system);
	let systemNames = await db.any(
		`SELECT id, name FROM systems WHERE id IN (${systems.toString()})`
	);
	systemNames = systemNames.map(
		(system) => `($1, $2, $3, ${system.id}, 'Tag assets for ${system.name}')`
	);

	sql_stmt = `INSERT INTO notification (contract_id, type, activity, system, reason) VALUES ${systemNames.join(
		","
	)}`;
	const asset_notification = await db.none(sql_stmt, [
		contract.id,
		"task",
		"Asset Tagging",
	]);

	// sql_stmt = `INSERT INTO notifications (contract_id, notification_type, fire_protection_systems, reason) VALUES ($1,$2, $3::json[], $4) RETURNING id`;
	// const asset_notification = await db.one(sql_stmt, [
	// 	contract.id,
	// 	"Asset Tagging",
	// 	contract.fire_protection_systems,
	// 	"Tag assets for the Systems: " + systemNames.join(", "),
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
	return [contract, 200];
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

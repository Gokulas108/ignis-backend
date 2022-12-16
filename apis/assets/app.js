const db = require("/opt/nodejs/utils/db.js");
const responseHandler = require("/opt/nodejs/utils/responseHandler.js");

exports.lambdaHandler = async (event, context) => {
	let statusCode = 200;
	let data;
	let httpMethod = event.httpMethod;
	let path = event.path;
	path = path.replace(/([^\/]*\/){2}/, ""); //getting the last path from -> "/assets/{path}"

	try {
		switch (httpMethod) {
			//Handling Cors
			case "OPTIONS":
				if (
					path === "systems" ||
					path === "devices" ||
					path === "schedule" ||
					path === "workorders" ||
					path === "reset" ||
					path === "getassetsforwo" ||
					path === "getassetsforbldg" ||
					path === "getContractforBldg" ||
					path === "getSystemsforContract"
				) {
					[data, statusCode] = ["Success", 200];
				} else {
					[data, statusCode] = ["Error: Invalid Request", 400];
				}
				break;

			// Get functions
			case "GET":
				if (path === "systems") [data, statusCode] = await getSystems();
				else if (path === "devices") {
					let params = event.queryStringParameters;
					sys_id = parseInt(params.sys_id);
					page = parseInt(params.page);
					limit = parseInt(params.limit);
					[data, statusCode] = await getDevices(
						sys_id,
						page,
						limit,
						params.searchText
					);
				} else if (path === "getassetsforwo") {
					let params = event.queryStringParameters;
					[data, statusCode] = await getAssetsforWO(params.id);
				} else if (path === "getassetsforbldg") {
					let params = event.queryStringParameters;
					[data, statusCode] = await getAssetsforBldg(params.id);
				} else if (path === "getContractforBldg") {
					let params = event.queryStringParameters;
					[data, statusCode] = await getContractforBldg(params.id);
				} else if (path === "getSystemsforContract") {
					let params = event.queryStringParameters;
					[data, statusCode] = await getSystemsforContract(params.id);
				}

				break;

			//Post functions
			case "POST":
				let body = JSON.parse(event.body);
				if (path === "schedule")
					[data, statusCode] = await schedule(body.values);
				else if (path === "workorders")
					[data, statusCode] = await newWorkOrder(body.values);
				else if (path === "verify") [data, statusCode] = await verify(body);
				else if (path === "reset")
					[data, statusCode] = await resetPasswordFirstTime(body);
				break;
			default:
				[data, statusCode] = ["Error: Invalid request", 400];
		}
	} catch (err) {
		statusCode = 400;
		data = err.stack;
	}

	response = responseHandler(data, statusCode);
	return response;
};

async function schedule(values) {
	let systems = values.systems.map((system) => system.system);
	let schedule = await db.any(
		`SELECT distinct t.user_id, u.name FROM technician t JOIN users u ON u.id = t.user_id WHERE t.system_id IN (${systems.toString()}) AND t.user_id NOT IN (SELECT user_id from schedule where not (start > $1 OR "end" < $2))`,
		[values.date[1], values.date[0]]
	);
	return [schedule, 200];
}

async function newWorkOrder(values) {
	let yourDate = new Date();
	let date = yourDate.toISOString().split("T")[0];
	let values_to_be_inserted = [];

	let wo = await db.any(
		`INSERT into workorders (status, date, user_id) VALUES($1, $2, $3) returning wo_id`,
		["Pending", date, values.assigned[0]]
	);

	values.assigned.map((x) => {
		values_to_be_inserted.push(`(${x}, $1, $2, $3, $4)`);
	});

	await db.any(
		`INSERT into schedule (user_id, start, "end", activity, wo_id) VALUES${values_to_be_inserted.toString()}`,
		[values.date[0], values.date[1], `WO# ${wo[0].wo_id}`, wo[0].wo_id]
	);

	let notifications = values.record.map((x) => x.id);

	await db.any(
		`UPDATE notification SET assigned_wo = $1, status = $2 WHERE id IN (${notifications.toString()})`,
		[wo[0].wo_id, "pending"]
	);

	return ["Work Order created!", 200];
}

async function getSystems() {
	let systems = await db.any("SELECT * FROM systems");
	return [systems, 200];
}

async function getDevices(sys_id = 0, page = 1, limit = 10, searchText = "") {
	let offset = (page - 1) * limit;
	let users;
	if (searchText === "") {
		users = await db.any(
			`SELECT id, name, activity, frequency, count(*) OVER() AS full_count FROM devices WHERE system_id = $1 ORDER BY id DESC OFFSET $2 LIMIT $3`,
			[sys_id, offset, limit]
		);
	} else {
		searchText = `%${searchText}%`;
		users = await db.any(
			`SELECT id, name, activity, frequency, count(*) OVER() AS full_count FROM devices WHERE system_id = $1 AND name iLIKE $2 OR activity iLIKE $2 OR frequency iLIKE $2 ORDER BY id DESC OFFSET $3 LIMIT $4`,
			[sys_id, searchText, offset, limit]
		);
	}

	let data = users;
	let statusCode = 200;
	return [data, statusCode];
}

async function getAssetsforWO(id) {
	let data = await db.any(`SELECT * from assets WHERE wo_id = $1`, [id]);
	return [data, 200];
}

async function getAssetsforBldg(id) {
	let data = await db.any(
		`SELECT asset_id, device from assets WHERE building_id = $1`,
		[id]
	);
	return [data, 200];
}

async function getContractforBldg(id) {
	let data = await db.any(
		"SELECT id, contract_number from contracts WHERE building_id = $1",
		[id]
	);
	return [data, 200];
}

async function getSystemsforContract(id) {
	let systems = await db.oneOrNone(
		"SELECT fire_protection_systems FROM contracts WHERE id = $1",
		[id]
	);
	let system_ids = systems.fire_protection_systems.map(
		(system) => system.system
	);
	system_ids = system_ids.join();
	let data = await db.any(
		`SELECT id, name FROM systems WHERE id in (${system_ids})`
	);
	return [data, 200];
}

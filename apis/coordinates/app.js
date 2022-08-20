const transformation = require("transform-coordinates");
const transform = transformation("EPSG:2932", "EPSG:4326");
const responseHandler = require("/opt/nodejs/utils/responseHandler.js");

exports.lambdaHandler = async (event, context) => {
	let statusCode = 200;
	let data = [];
	let httpMethod = event.httpMethod;

	try {
		switch (httpMethod) {
			case "OPTIONS":
				[data, statusCode] = ["Success", 200];
				break;
			case "POST":
				let body = JSON.parse(event.body);
				[data, statusCode] = await getLatLong(body.coordinates);
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

function getLatLong({ x, y }) {
	x = parseFloat(x);
	y = parseFloat(y);
	let res = transform.forward({ x, y });
	return [res, 200];
}

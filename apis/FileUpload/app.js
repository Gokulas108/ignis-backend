const AWS = require("aws-sdk");
const addclienttransaction = require("/opt/nodejs/utils/clientTransactions.js");
const authorize = require("/opt/nodejs/utils/authorize.js");
const authcode = require("/opt/nodejs/utils/accessCodes.js");
const responseHandler = require("/opt/nodejs/utils/responseHandler.js");
const bucket = process.env.BUCKET;
const region = process.env.REGION;

AWS.config.update({ region });
const s3 = new AWS.S3();
const uploadBucket = bucket;
const URL_EXPIRATION_SECONDS = 60 * 60;

exports.lambdaHandler = async (event, context) => {
	let statusCode = 200;
	let data = [];
	let httpMethod = event.httpMethod;
	let token = event.headers["ignistoken"];
	let ip = event["requestContext"]["identity"]["sourceIp"];
	let useragent = event["requestContext"]["identity"]["userAgent"];

	try {
		switch (httpMethod) {
			case "OPTIONS":
				[data, statusCode] = ["Success", 200];
				break;
			case "POST":
				let body = JSON.parse(event.body);
				[data, statusCode] = await authorize(
					authcode.ADD_BUILDING,
					ip,
					useragent,
					token,
					async (id, client_id) => await createPresignedUrl(body, id, client_id)
				);
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

async function createPresignedUrl({ building_name, file_name }, id, client_id) {
	const filepath = `${client_id}/buildings/${building_name}/${file_name}`;
	const s3Params = {
		Bucket: uploadBucket,
		Key: filepath,
		Expires: URL_EXPIRATION_SECONDS,
		ContentType: "image/* application/*",
	};
	let uploadURL = s3.getSignedUrl("putObject", s3Params);

	await addclienttransaction(id, client_id, "FILE_UPLOAD");
	return [uploadURL, 200];
}

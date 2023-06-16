// const { fromIni } = require("@aws-sdk/credential-providers");
// const { HttpRequest } = require("@aws-sdk/protocol-http");
// const { S3RequestPresigner } = require("@aws-sdk/s3-request-presigner");
// const { parseUrl } = require("@aws-sdk/url-parser");
// const { formatUrl } = require("@aws-sdk/util-format-url");
// const { Hash } = require("@aws-sdk/hash-node");
// const addclienttransaction = require("/opt/nodejs/utils/clientTransactions.js");
// const authorize = require("/opt/nodejs/utils/authorize.js");
// const authcode = require("/opt/nodejs/utils/accessCodes.js");
// const responseHandler = require("/opt/nodejs/utils/responseHandler.js");
// const bucket = process.env.BUCKET;
// const region = process.env.REGION;

// exports.lambdaHandler = async (event, context) => {
// 	let statusCode = 200;
// 	let data = [];
// 	let httpMethod = event.httpMethod;
// 	let token = event.headers["ignistoken"];
// 	let ip = event["requestContext"]["identity"]["sourceIp"];
// 	let useragent = event["requestContext"]["identity"]["userAgent"];

// 	try {
// 		switch (httpMethod) {
// 			case "OPTIONS":
// 				[data, statusCode] = ["Success", 200];
// 				break;
// 			case "POST":
// 				let body = JSON.parse(event.body);
// 				[data, statusCode] = await authorize(
// 					authcode.ADD_BUILDING,
// 					ip,
// 					useragent,
// 					token,
// 					async (id, client_id) => await createPresignedUrl(body, id, client_id)
// 				);
// 				break;
// 			default:
// 				[data, statusCode] = ["Error: Invalid request", 400];
// 		}
// 	} catch (err) {
// 		statusCode = 400;
// 		data = err.stack;
// 	}

// 	response = responseHandler(data, statusCode);
// 	return response;
// };

// async function createPresignedUrl({ building_name, file_name }, id, client_id) {
// 	const filepath = `${client_id}/buildings/${building_name}/${file_name}`;
// 	const url = parseUrl(
// 		`https://${bucket}.s3.${region}.amazonaws.com/${filepath}`
// 	);
// 	const presigner = new S3RequestPresigner({
// 		credentials: fromIni(),
// 		region,
// 		sha256: Hash.bind(null, "sha256"),
// 	});

// 	const signedUrlObject = await presigner.presign(
// 		new HttpRequest({ ...url, method: "PUT" })
// 	);
// 	await addclienttransaction(id, client_id, "FILE_UPLOAD");
// 	return [formatUrl(signedUrlObject), 200];
// }

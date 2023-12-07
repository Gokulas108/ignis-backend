const AWS = require("aws-sdk");

function preSignedURL(filepath) {
  AWS.config.update({ region: process.env.REGION });
  const s3 = new AWS.S3();
  const URL_EXPIRATION_SECONDS = 60 * 60;

  const s3Params = {
    Bucket: process.env.BUCKET,
    Key: filepath,
    Expires: URL_EXPIRATION_SECONDS,
  };
  let viewURL = s3.getSignedUrl("getObject", s3Params);

  return viewURL;
}

module.exports = preSignedURL;

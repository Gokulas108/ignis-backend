const pgp = require("pg-promise")();

const cn = {
	user: process.env.DB_USER,
	host: process.env.DB_HOST,
	database: process.env.DB_NAME,
	password: process.env.DB_PASS,
	port: parseInt(process.env.DB_PORT),
};

const db = pgp(cn);

module.exports = db;

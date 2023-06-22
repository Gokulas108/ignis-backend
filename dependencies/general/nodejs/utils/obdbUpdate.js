function obdbupdate(data, client_id, table) {
  let column_names = Object.keys(data);
  let values = Object.values(data);
  let col_values = values;
  let table_name = `${client_id}_${table}`;
  let sql_stmt;
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
  let update_statement = column_names.map(
    (name, index) => `${name} = ${values[index]}`
  );
  values = update_statement.join();
  sql_stmt = `UPDATE ${table_name} SET ${values},updatedby = $${
    col_values.length + 1
  },updatedat = $${col_values.length + 2} WHERE id= $${col_values.length + 3} `;

  return [sql_stmt, col_values];
}

module.exports = obdbupdate;

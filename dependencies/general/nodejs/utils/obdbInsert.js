function obdbinsert(data, client_id, table) {
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

  values = values.join();
  sql_stmt = `INSERT INTO ${table_name} (${column_names},createdby, updatedby, createdat, updatedat) VALUES (${values}, $${
    col_values.length + 1
  }, $${col_values.length + 2}, $${col_values.length + 3}, $${
    col_values.length + 4
  })`;

  return [sql_stmt, col_values];
}

module.exports = obdbinsert;

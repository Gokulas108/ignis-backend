function obdbmultiinsert(data, client_id, table) {
  let table_name = `${client_id}_${table}`;
  let columns = [];
  data.forEach((row) => {
    columns = [...new Set(columns.concat(Object.keys(row)))];
  });
  let idx = 0;
  let col_values = [];
  let sql_values = [];
  data.forEach((row) => {
    let row_sql = [];
    columns.forEach((col) => {
      if (row[col]) {
        idx = idx + 1;
        col_values.push(row[col]);
        row_sql.push(
          `$${idx}${
            Array.isArray(row[col])
              ? typeof row[col][0] === "object" && row[col][0] !== null
                ? "::json[]"
                : ""
              : ""
          }`
        );
      } else row_sql.push("null");
    });
    sql_values.push(row_sql.join() + "REPLACEMENT_FOR_CB_CA_UB_UA");
  });
  sql_stmt = `INSERT INTO ${table_name} (${columns},createdby,updatedby,createdat,updatedat) VALUES (${sql_values.join(
    "),("
  )})`;

  const replaced_text = `,$${col_values.length + 1},$${
    col_values.length + 2
  },$${col_values.length + 3},$${col_values.length + 4}`;
  sql_stmt = sql_stmt.replace(/REPLACEMENT_FOR_CB_CA_UB_UA/g, replaced_text);

  return [sql_stmt, col_values];
}
module.exports = obdbmultiinsert;

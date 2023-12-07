const db = require("/opt/nodejs/utils/db.js");

exports.lambdaHandler = async (event, context) => {
  let data = await db.any(
    `SELECT client_id, timezone, notification_frequency FROM client WHERE id != $1`,
    [1]
  );

  data.forEach(async ({ client_id, timezone, notification_frequency }) => {
    let date_now = new Date(
      new Date().toLocaleString("en-US", { timeZone: timezone })
    ).toISOString();
    let date_new = new Date(
      new Date(
        new Date().toLocaleString("en-US", { timeZone: timezone })
      ).setDate(new Date().getDate() + notification_frequency)
    ).toISOString();
    let closed = await db.any(
      `SELECT asset_ids FROM ${client_id}_notifications WHERE status != $1`,
      ["CLOSED"]
    );
    let assets = await db.any(
      `SELECT ast.id AS asset_id , ast.system_id AS system_id FROM ${client_id}_assets  WHERE ast.id != ANY($1) AND ast.next_service <= $2`,
      [closed, date_new]
    );
    const SystemAsset = assets.reduce((group, arr) => {
      const { system_id, asset_id } = arr;
      group[system_id] = group[system_id] ?? [];
      group[system_id].push(asset_id);
      return group;
    }, {});

    const system_ids = Object.keys(SystemAsset);
    system_ids.forEach(async (system_id) => {
      await db.none(
        `INSERT INTO ${client_id}_notifications (type, system_id, asset_ids, contract_id, status, building_controller) `,
        []
      );
    });
  });
};

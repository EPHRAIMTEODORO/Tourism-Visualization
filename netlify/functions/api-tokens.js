const { ensureSchema, getPool } = require("./_responses-store");

const ADMIN_PASSWORD = "eisadmin1";

function checkAuth(event) {
  const auth = event.headers["x-admin-password"] || "";
  return auth === ADMIN_PASSWORD;
}

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Content-Type": "application/json"
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  if (!checkAuth(event)) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  await ensureSchema();
  const db = getPool();

  // GET — list all tokens
  if (event.httpMethod === "GET") {
    const result = await db.query(
      `SELECT id, token, used, memo, created_at, used_at FROM tokens ORDER BY id`
    );
    return { statusCode: 200, headers, body: JSON.stringify(result.rows) };
  }

  // POST — seed tokens (only if table is empty)
  if (event.httpMethod === "POST") {
    const { count } = JSON.parse(event.body || "{}");
    const n = Math.min(Number(count) || 50, 200);

    const existing = await db.query(`SELECT COUNT(*) FROM tokens`);
    if (Number(existing.rows[0].count) > 0) {
      // Add more tokens
      const values = [];
      const params = [];
      for (let i = 0; i < n; i++) {
        const token = generateToken();
        params.push(token);
        values.push(`($${i + 1})`);
      }
      await db.query(
        `INSERT INTO tokens (token) VALUES ${values.join(", ")}`,
        params
      );
    } else {
      const values = [];
      const params = [];
      for (let i = 0; i < n; i++) {
        const token = generateToken();
        params.push(token);
        values.push(`($${i + 1})`);
      }
      await db.query(
        `INSERT INTO tokens (token) VALUES ${values.join(", ")}`,
        params
      );
    }

    const result = await db.query(
      `SELECT id, token, used, memo, created_at, used_at FROM tokens ORDER BY id`
    );
    return { statusCode: 201, headers, body: JSON.stringify(result.rows) };
  }

  // PATCH — update memo for a token
  if (event.httpMethod === "PATCH") {
    const { id, memo } = JSON.parse(event.body || "{}");
    if (!id) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing id" }) };
    }
    await db.query(`UPDATE tokens SET memo = $1 WHERE id = $2`, [memo || "", id]);
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
};

function generateToken() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let token = "";
  for (let i = 0; i < 6; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

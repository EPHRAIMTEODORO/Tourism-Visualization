const { ensureSchema, getPool } = require("./_responses-store");

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { token } = JSON.parse(event.body || "{}");
    if (!token || typeof token !== "string") {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Token is required." }) };
    }

    await ensureSchema();
    const db = getPool();

    const result = await db.query(
      `SELECT id, used FROM tokens WHERE token = $1`,
      [token.trim().toUpperCase()]
    );

    if (result.rows.length === 0) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: "Invalid token." }) };
    }

    const row = result.rows[0];
    if (row.used) {
      return { statusCode: 409, headers, body: JSON.stringify({ error: "This token has already been used." }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, tokenId: row.id }) };
  } catch (error) {
    console.error("api-validate-token error", error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Server error." }) };
  }
};

const { ensureSchema, getPool } = require("./_responses-store");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    await ensureSchema();
    const db = getPool();

    const result = await db.query(
      `INSERT INTO participant_counter DEFAULT VALUES RETURNING id`
    );

    const participantId = Number(result.rows[0].id);
    const conditionOrder = participantId % 2 === 1 ? "standard-first" : "bubble-first";

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({ participantId, conditionOrder })
    };
  } catch (error) {
    console.error("api-register error", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to register participant." })
    };
  }
};

const { ensureSchema, getPool } = require("./_responses-store");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true })
    };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    await ensureSchema();
    const db = getPool();

    const { rows } = await db.query(`
      SELECT
        condition_a_pattern_ease,
        condition_a_outlier_ease,
        condition_a_population_ease,
        condition_b_pattern_ease,
        condition_b_outlier_ease,
        condition_b_population_ease
      FROM questionnaire_responses
      ORDER BY id ASC;
    `);

    const summary = {
      patternEaseStandard: rows.map((row) => Number(row.condition_a_pattern_ease)),
      patternEaseBubble: rows.map((row) => Number(row.condition_b_pattern_ease)),
      outlierEaseStandard: rows.map((row) => Number(row.condition_a_outlier_ease)),
      outlierEaseBubble: rows.map((row) => Number(row.condition_b_outlier_ease)),
      populationEaseStandard: rows.map((row) => Number(row.condition_a_population_ease)),
      populationEaseBubble: rows.map((row) => Number(row.condition_b_population_ease))
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(summary)
    };
  } catch (error) {
    console.error("api-responses-summary error", error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to fetch response summary." })
    };
  }
};

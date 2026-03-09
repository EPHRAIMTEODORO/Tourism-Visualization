const { ensureSchema, getPool, validatePayload } = require("./_responses-store");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true })
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    const validation = validatePayload(payload);

    if (!validation.ok) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: validation.error })
      };
    }

    const data = validation.normalized;

    await ensureSchema();
    const db = getPool();

    await db.query(
      `
      INSERT INTO questionnaire_responses (
        client_timestamp,
        demographics,
        condition_a,
        condition_b,
        comparison,
        final_comment,
        age,
        major,
        taken_course,
        condition_a_pattern_ease,
        condition_a_outlier_ease,
        condition_a_population_ease,
        condition_b_pattern_ease,
        condition_b_outlier_ease,
        condition_b_population_ease,
        participant_id,
        condition_order
      )
      VALUES (
        $1::timestamptz,
        $2::jsonb,
        $3::jsonb,
        $4::jsonb,
        $5::jsonb,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        $15,
        $16,
        $17
      )
      `,
      [
        data.timestamp,
        JSON.stringify(data.demographics),
        JSON.stringify(data.conditionA),
        JSON.stringify(data.conditionB),
        JSON.stringify(data.comparison),
        data.finalComment,
        data.demographics.age,
        data.demographics.major,
        data.demographics.takenCourse,
        data.conditionA.patternEase,
        data.conditionA.outlierEase,
        data.conditionA.populationEase,
        data.conditionB.patternEase,
        data.conditionB.outlierEase,
        data.conditionB.populationEase,
        payload.participantId || null,
        payload.conditionOrder || "unknown"
      ]
    );

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({ message: "Response stored successfully." })
    };
  } catch (error) {
    console.error("api-responses error", error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to store response." })
    };
  }
};

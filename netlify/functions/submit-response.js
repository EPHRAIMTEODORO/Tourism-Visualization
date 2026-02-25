const { Pool } = require("pg");

let pool;
let schemaReady;

function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set.");
    }

    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
  }

  return pool;
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEase(value) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 5) {
    return null;
  }

  return numeric;
}

function normalizeCourseTaken(value) {
  const text = normalizeText(value).toLowerCase();
  if (text === "yes") return true;
  if (text === "no") return false;
  return null;
}

async function ensureSchema() {
  if (schemaReady) {
    return schemaReady;
  }

  const db = getPool();
  schemaReady = (async () => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS participant_responses (
        id BIGSERIAL PRIMARY KEY,
        submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        demographics JSONB NOT NULL,
        condition_a JSONB NOT NULL,
        condition_b JSONB NOT NULL,
        comparison JSONB NOT NULL,
        final JSONB NOT NULL,
        raw_response JSONB,
        age_group TEXT,
        major_group TEXT,
        took_course BOOLEAN,
        condition_a_ease SMALLINT CHECK (condition_a_ease BETWEEN 1 AND 5),
        condition_b_ease SMALLINT CHECK (condition_b_ease BETWEEN 1 AND 5),
        easier_visualization TEXT
      );
    `);

    await db.query(`
      ALTER TABLE participant_responses
      ADD COLUMN IF NOT EXISTS raw_response JSONB,
      ADD COLUMN IF NOT EXISTS age_group TEXT,
      ADD COLUMN IF NOT EXISTS major_group TEXT,
      ADD COLUMN IF NOT EXISTS took_course BOOLEAN,
      ADD COLUMN IF NOT EXISTS condition_a_ease SMALLINT CHECK (condition_a_ease BETWEEN 1 AND 5),
      ADD COLUMN IF NOT EXISTS condition_b_ease SMALLINT CHECK (condition_b_ease BETWEEN 1 AND 5),
      ADD COLUMN IF NOT EXISTS easier_visualization TEXT;
    `);

    await db.query(`
      CREATE OR REPLACE VIEW participant_ease_scores AS
      SELECT id, submitted_at, 'A'::text AS condition, condition_a_ease AS ease_score
      FROM participant_responses
      WHERE condition_a_ease IS NOT NULL
      UNION ALL
      SELECT id, submitted_at, 'B'::text AS condition, condition_b_ease AS ease_score
      FROM participant_responses
      WHERE condition_b_ease IS NOT NULL;
    `);
  })();

  return schemaReady;
}

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

    const { demographics, conditionA, conditionB, comparison, final } = payload;

    if (
      !isObject(demographics) ||
      !isObject(conditionA) ||
      !isObject(conditionB) ||
      !isObject(comparison) ||
      !isObject(final)
    ) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid payload format." })
      };
    }

    const db = getPool();
    await ensureSchema();

    const ageGroup = normalizeText(demographics.age);
    const majorGroup = normalizeText(demographics.major);
    const tookCourse = normalizeCourseTaken(demographics.tookDataVizOrStatisticsCourse);
    const conditionAEase = normalizeEase(conditionA.easeOfUse);
    const conditionBEase = normalizeEase(conditionB.easeOfUse);
    const easierVisualization = normalizeText(comparison.easierVisualization);

    if (conditionAEase === null || conditionBEase === null) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Ease scores must be integers between 1 and 5." })
      };
    }

    await db.query(
      `
      INSERT INTO participant_responses
      (
        demographics,
        condition_a,
        condition_b,
        comparison,
        final,
        raw_response,
        age_group,
        major_group,
        took_course,
        condition_a_ease,
        condition_b_ease,
        easier_visualization
      )
      VALUES
      (
        $1::jsonb,
        $2::jsonb,
        $3::jsonb,
        $4::jsonb,
        $5::jsonb,
        $6::jsonb,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12
      )
      `,
      [
        JSON.stringify(demographics),
        JSON.stringify(conditionA),
        JSON.stringify(conditionB),
        JSON.stringify(comparison),
        JSON.stringify(final),
        JSON.stringify(payload),
        ageGroup || null,
        majorGroup || null,
        tookCourse,
        conditionAEase,
        conditionBEase,
        easierVisualization || null
      ]
    );

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({ ok: true })
    };
  } catch (error) {
    console.error("submit-response error", error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to store response." })
    };
  }
};

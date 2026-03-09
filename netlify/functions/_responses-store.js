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

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeLikert(value) {
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue < 1 || numberValue > 5) {
    return null;
  }

  return numberValue;
}

function parseBooleanStrict(value) {
  if (typeof value === "boolean") {
    return value;
  }

  return null;
}

function parseTimestamp(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function hasText(value) {
  return normalizeText(value).length > 0;
}

function validatePayload(payload) {
  const requiredTopLevel = [
    "demographics",
    "conditionA",
    "conditionB",
    "comparison",
    "finalComment",
    "timestamp"
  ];

  for (const key of requiredTopLevel) {
    if (!(key in payload)) {
      return { ok: false, error: `Missing required field: ${key}` };
    }
  }

  const demographics = payload.demographics || {};
  const conditionA = payload.conditionA || {};
  const conditionB = payload.conditionB || {};
  const comparison = payload.comparison || {};

  const takenCourse = parseBooleanStrict(demographics.takenCourse);
  const populationInconsistency = parseBooleanStrict(conditionB.populationInconsistency);

  const aPatternEase = normalizeLikert(conditionA.patternEase);
  const aOutlierEase = normalizeLikert(conditionA.outlierEase);
  const aPopulationEase = normalizeLikert(conditionA.populationEase);

  const bPatternEase = normalizeLikert(conditionB.patternEase);
  const bOutlierEase = normalizeLikert(conditionB.outlierEase);
  const bPopulationEase = normalizeLikert(conditionB.populationEase);

  const clientTimestamp = parseTimestamp(payload.timestamp);

  const missingTextFields = [
    ["demographics.age", demographics.age],
    ["demographics.major", demographics.major],
    ["conditionA.warmup", conditionA.warmup],
    ["conditionA.correlationDirection", conditionA.correlationDirection],
    ["conditionA.outlierCountry", conditionA.outlierCountry],
    ["conditionA.clusterLocation", conditionA.clusterLocation],
    ["conditionA.populationPattern", conditionA.populationPattern],
    ["conditionA.smallPopHighExp", conditionA.smallPopHighExp],
    ["conditionB.warmup", conditionB.warmup],
    ["conditionB.correlationDirection", conditionB.correlationDirection],
    ["conditionB.lowArrivalsHighExp", conditionB.lowArrivalsHighExp],
    ["conditionB.populationPattern", conditionB.populationPattern],
    ["conditionB.inconsistentCountry", conditionB.inconsistentCountry],
    ["conditionB.largePopLowArrivals", conditionB.largePopLowArrivals],
    ["comparison.trend", comparison.trend],
    ["comparison.outliers", comparison.outliers],
    ["comparison.population", comparison.population],
    ["comparison.clutter", comparison.clutter],
    ["comparison.preference", comparison.preference],
    ["comparison.explanation", comparison.explanation],
    ["finalComment", payload.finalComment]
  ].filter(([, value]) => !hasText(value));

  if (missingTextFields.length > 0) {
    return {
      ok: false,
      error: `Missing required text field(s): ${missingTextFields.map(([name]) => name).join(", ")}`
    };
  }

  if (takenCourse === null) {
    return { ok: false, error: "demographics.takenCourse must be a boolean." };
  }

  if (populationInconsistency === null) {
    return { ok: false, error: "conditionB.populationInconsistency must be a boolean." };
  }

  if ([aPatternEase, aOutlierEase, aPopulationEase, bPatternEase, bOutlierEase, bPopulationEase].some((v) => v === null)) {
    return { ok: false, error: "Likert fields must be integers between 1 and 5." };
  }

  if (!clientTimestamp) {
    return { ok: false, error: "timestamp must be a valid date string." };
  }

  return {
    ok: true,
    normalized: {
      demographics: {
        age: normalizeText(demographics.age),
        major: normalizeText(demographics.major),
        takenCourse
      },
      conditionA: {
        warmup: normalizeText(conditionA.warmup),
        correlationDirection: normalizeText(conditionA.correlationDirection),
        outlierCountry: normalizeText(conditionA.outlierCountry),
        clusterLocation: normalizeText(conditionA.clusterLocation),
        populationPattern: normalizeText(conditionA.populationPattern),
        smallPopHighExp: normalizeText(conditionA.smallPopHighExp),
        patternEase: aPatternEase,
        outlierEase: aOutlierEase,
        populationEase: aPopulationEase
      },
      conditionB: {
        warmup: normalizeText(conditionB.warmup),
        correlationDirection: normalizeText(conditionB.correlationDirection),
        lowArrivalsHighExp: normalizeText(conditionB.lowArrivalsHighExp),
        populationPattern: normalizeText(conditionB.populationPattern),
        populationInconsistency,
        inconsistentCountry: normalizeText(conditionB.inconsistentCountry),
        largePopLowArrivals: normalizeText(conditionB.largePopLowArrivals),
        patternEase: bPatternEase,
        outlierEase: bOutlierEase,
        populationEase: bPopulationEase
      },
      comparison: {
        trend: normalizeText(comparison.trend),
        outliers: normalizeText(comparison.outliers),
        population: normalizeText(comparison.population),
        clutter: normalizeText(comparison.clutter),
        preference: normalizeText(comparison.preference),
        explanation: normalizeText(comparison.explanation)
      },
      finalComment: normalizeText(payload.finalComment),
      timestamp: clientTimestamp
    }
  };
}

async function ensureSchema() {
  if (schemaReady) {
    return schemaReady;
  }

  const db = getPool();
  schemaReady = (async () => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS questionnaire_responses (
        id BIGSERIAL PRIMARY KEY,
        submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        client_timestamp TIMESTAMPTZ NOT NULL,

        demographics JSONB NOT NULL,
        condition_a JSONB NOT NULL,
        condition_b JSONB NOT NULL,
        comparison JSONB NOT NULL,
        final_comment TEXT NOT NULL,

        age TEXT NOT NULL,
        major TEXT NOT NULL,
        taken_course BOOLEAN NOT NULL,

        condition_a_pattern_ease SMALLINT NOT NULL CHECK (condition_a_pattern_ease BETWEEN 1 AND 5),
        condition_a_outlier_ease SMALLINT NOT NULL CHECK (condition_a_outlier_ease BETWEEN 1 AND 5),
        condition_a_population_ease SMALLINT NOT NULL CHECK (condition_a_population_ease BETWEEN 1 AND 5),

        condition_b_pattern_ease SMALLINT NOT NULL CHECK (condition_b_pattern_ease BETWEEN 1 AND 5),
        condition_b_outlier_ease SMALLINT NOT NULL CHECK (condition_b_outlier_ease BETWEEN 1 AND 5),
        condition_b_population_ease SMALLINT NOT NULL CHECK (condition_b_population_ease BETWEEN 1 AND 5),

        participant_id BIGINT,
        condition_order TEXT
      );
    `);

    // Add columns if table already exists without them
    await db.query(`
      ALTER TABLE questionnaire_responses
        ADD COLUMN IF NOT EXISTS participant_id BIGINT,
        ADD COLUMN IF NOT EXISTS condition_order TEXT;
    `);

    // Participant counter table
    await db.query(`
      CREATE TABLE IF NOT EXISTS participant_counter (
        id BIGSERIAL PRIMARY KEY,
        registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_questionnaire_ease_fields
      ON questionnaire_responses (
        condition_a_pattern_ease,
        condition_a_outlier_ease,
        condition_a_population_ease,
        condition_b_pattern_ease,
        condition_b_outlier_ease,
        condition_b_population_ease
      );
    `);
  })();

  return schemaReady;
}

module.exports = {
  getPool,
  ensureSchema,
  validatePayload
};

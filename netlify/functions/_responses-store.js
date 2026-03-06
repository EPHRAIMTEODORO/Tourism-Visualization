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
    ["conditionA.correlationDirection", conditionA.correlationDirection],
    ["conditionA.outlierCountry", conditionA.outlierCountry],
    ["conditionA.clusterLocation", conditionA.clusterLocation],
    ["conditionA.largestPopulation", conditionA.largestPopulation],
    ["conditionB.highImpactCountry", conditionB.highImpactCountry],
    ["conditionB.largestPopulation", conditionB.largestPopulation],
    ["conditionB.inconsistentCountry", conditionB.inconsistentCountry],
    ["conditionB.correlationDirection", conditionB.correlationDirection],
    ["comparison.easierPattern", comparison.easierPattern],
    ["comparison.easierOutlier", comparison.easierOutlier],
    ["comparison.easierPopulation", comparison.easierPopulation],
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
        correlationDirection: normalizeText(conditionA.correlationDirection),
        outlierCountry: normalizeText(conditionA.outlierCountry),
        clusterLocation: normalizeText(conditionA.clusterLocation),
        largestPopulation: normalizeText(conditionA.largestPopulation),
        patternEase: aPatternEase,
        outlierEase: aOutlierEase,
        populationEase: aPopulationEase
      },
      conditionB: {
        highImpactCountry: normalizeText(conditionB.highImpactCountry),
        largestPopulation: normalizeText(conditionB.largestPopulation),
        populationInconsistency,
        inconsistentCountry: normalizeText(conditionB.inconsistentCountry),
        correlationDirection: normalizeText(conditionB.correlationDirection),
        patternEase: bPatternEase,
        outlierEase: bOutlierEase,
        populationEase: bPopulationEase
      },
      comparison: {
        easierPattern: normalizeText(comparison.easierPattern),
        easierOutlier: normalizeText(comparison.easierOutlier),
        easierPopulation: normalizeText(comparison.easierPopulation),
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
        condition_b_population_ease SMALLINT NOT NULL CHECK (condition_b_population_ease BETWEEN 1 AND 5)
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

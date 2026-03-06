function getRadioValue(form, name) {
  const checked = form.querySelector(`input[name="${name}"]:checked`);
  return checked ? checked.value : "";
}

function getTextValue(id) {
  const element = document.getElementById(id);
  return element ? element.value.trim() : "";
}

function isFieldComplete(form, field) {
  if (field.type === "radio") {
    return !!form.querySelector(`input[name="${field.name}"]:checked`);
  }

  return field.value.trim().length > 0;
}

const SUBMIT_ENDPOINT = "/api/responses";
const CONDITION_ORDER_KEY = "questionnaire_condition_order";

function parseYesNoToBoolean(value) {
  if (value === "Yes") return true;
  if (value === "No") return false;
  return null;
}

function getConditionOrder() {
  const stored = sessionStorage.getItem(CONDITION_ORDER_KEY);

  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (
        Array.isArray(parsed) &&
        parsed.length === 2 &&
        parsed.includes("section-4") &&
        parsed.includes("section-5")
      ) {
        return parsed;
      }
    } catch (error) {
      console.warn("Invalid stored condition order, generating a new one.", error);
    }
  }

  const randomized = Math.random() < 0.5
    ? ["section-4", "section-5"]
    : ["section-5", "section-4"];

  sessionStorage.setItem(CONDITION_ORDER_KEY, JSON.stringify(randomized));
  return randomized;
}

function applyConditionOrder(form) {
  const section4 = document.getElementById("section-4");
  const section5 = document.getElementById("section-5");
  const section6 = document.getElementById("section-6");

  if (!form || !section4 || !section5 || !section6) {
    return;
  }

  const sectionById = {
    "section-4": section4,
    "section-5": section5
  };

  getConditionOrder().forEach((sectionId) => {
    form.insertBefore(sectionById[sectionId], section6);
  });
}

window.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("participant-form");
  const submitButton = document.getElementById("submit-button");
  const validationMessage = document.getElementById("validation-message");
  const thankYou = document.getElementById("thank-you");

  const practiceContinue = document.getElementById("practice-continue");
  const practiceResponse = document.getElementById("practice-response");
  const practiceFeedback = document.getElementById("practice-feedback");

  if (!form || !submitButton) {
    return;
  }

  applyConditionOrder(form);

  const requiredFields = [...form.querySelectorAll("[required]")];

  const updateSubmitState = () => {
    const isComplete = requiredFields.every((field) => isFieldComplete(form, field));
    submitButton.disabled = !isComplete;

    if (isComplete) {
      validationMessage.textContent = "";
    }
  };

  practiceContinue?.addEventListener("click", () => {
    if (!practiceResponse || !practiceResponse.value.trim()) {
      practiceFeedback.textContent = "Please enter a country to complete the practice trial.";
      return;
    }

    practiceFeedback.textContent = "Practice complete. This answer is not recorded.";
  });

  form.addEventListener("input", updateSubmitState);
  form.addEventListener("change", updateSubmitState);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const complete = requiredFields.every((field) => isFieldComplete(form, field));
    if (!complete) {
      validationMessage.textContent = "Please answer all required questions before submitting.";
      form.reportValidity();
      updateSubmitState();
      return;
    }

    const responses = {
      demographics: {
        age: getRadioValue(form, "age"),
        major: getRadioValue(form, "major"),
        takenCourse: parseYesNoToBoolean(getRadioValue(form, "course"))
      },
      conditionA: {
        correlationDirection: getRadioValue(form, "conditionA-correlation"),
        outlierCountry: getTextValue("condition-a-position-outlier"),
        clusterLocation: getRadioValue(form, "conditionA-cluster"),
        largestPopulation: getTextValue("condition-a-largest-pop"),
        patternEase: Number(getRadioValue(form, "conditionA-pattern-ease")),
        outlierEase: Number(getRadioValue(form, "conditionA-outlier-ease")),
        populationEase: Number(getRadioValue(form, "conditionA-population-ease"))
      },
      conditionB: {
        highImpactCountry: getTextValue("condition-b-high-impact"),
        largestPopulation: getTextValue("condition-b-largest-pop"),
        populationInconsistency: parseYesNoToBoolean(getRadioValue(form, "conditionB-inconsistency")),
        inconsistentCountry: getTextValue("condition-b-inconsistency-country"),
        correlationDirection: getRadioValue(form, "conditionB-correlation"),
        patternEase: Number(getRadioValue(form, "conditionB-pattern-ease")),
        outlierEase: Number(getRadioValue(form, "conditionB-outlier-ease")),
        populationEase: Number(getRadioValue(form, "conditionB-population-ease"))
      },
      comparison: {
        easierPattern: getRadioValue(form, "comparison-patterns"),
        easierOutlier: getRadioValue(form, "comparison-outliers"),
        easierPopulation: getRadioValue(form, "comparison-population"),
        explanation: getTextValue("comparison-explanation")
      },
      finalComment: getTextValue("final-response"),
      timestamp: new Date().toISOString()
    };

    submitButton.disabled = true;
    validationMessage.textContent = "Submitting responses...";

    try {
      const response = await fetch(SUBMIT_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(responses)
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      console.log("Participant responses:", responses);

      form.hidden = true;
      if (thankYou) {
        thankYou.hidden = false;
        thankYou.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch (error) {
      console.error("Submission failed:", error);
      validationMessage.textContent = "Submission failed. Please try again.";
      updateSubmitState();
    }
  });

  updateSubmitState();
});

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

const SUBMIT_ENDPOINT = "/.netlify/functions/submit-response";

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
        tookDataVizOrStatisticsCourse: getRadioValue(form, "course")
      },
      conditionA: {
        identifiedCountry: getTextValue("condition-a-country"),
        relationshipDescription: getRadioValue(form, "conditionA-relationship"),
        easeOfUse: Number(getRadioValue(form, "conditionA-ease"))
      },
      conditionB: {
        identifiedCountry: getTextValue("condition-b-country"),
        relationshipDescription: getRadioValue(form, "conditionB-relationship"),
        easeOfUse: Number(getRadioValue(form, "conditionB-ease"))
      },
      comparison: {
        easierVisualization: getRadioValue(form, "comparison-choice"),
        explanation: getTextValue("comparison-explanation")
      },
      final: {
        confusionFeedback: getTextValue("final-response")
      }
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

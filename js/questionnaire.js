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

  if (!form || !submitButton) {
    return;
  }

  // Intro → Demographics → Main Content
  const introPage = document.getElementById("intro-page");
  const demographicsPage = document.getElementById("demographics-page");
  const mainContent = document.getElementById("main-content");
  const introBegin = document.getElementById("intro-begin");
  const demographicsNext = document.getElementById("demographics-next");
  const demographicsForm = document.getElementById("demographics-form");
  const demographicsMessage = document.getElementById("demographics-message");

  const progressBar = document.getElementById("q-progress");
  const progressFill = document.getElementById("q-progress-fill");
  const progressLabel = document.getElementById("q-progress-label");
  const TOTAL_STEPS = 5; // demographics(1) + 4 questionnaire steps

  function updateProgress(stepNum) {
    if (progressFill) progressFill.style.width = `${(stepNum / TOTAL_STEPS) * 100}%`;
    if (progressLabel) progressLabel.textContent = `Step ${stepNum} / ${TOTAL_STEPS}`;
  }

  // Token validation (disabled — users can proceed without a token)
  const tokenInput = document.getElementById("token-input");
  const tokenError = document.getElementById("token-error");
  let tokenValidated = true;

  if (tokenInput) {
    tokenInput.addEventListener("input", () => {
      tokenInput.value = tokenInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
      tokenInput.classList.remove("token-valid", "token-invalid");
      tokenError.textContent = "";
      tokenValidated = false;
      introBegin.disabled = true;

      if (tokenInput.value.length === 6) {
        validateToken(tokenInput.value);
      }
    });
  }

  async function validateToken(code) {
    try {
      const res = await fetch("/api/validate-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: code })
      });
      const data = await res.json();

      if (res.ok) {
        tokenInput.classList.add("token-valid");
        tokenError.textContent = "";
        tokenValidated = true;
        introBegin.disabled = false;
        sessionStorage.setItem("studyToken", code);
      } else {
        tokenInput.classList.add("token-invalid");
        tokenError.textContent = data.error || "Invalid token.";
        tokenValidated = false;
        introBegin.disabled = true;
      }
    } catch {
      tokenError.textContent = "Connection error. Please try again.";
    }
  }

  if (introBegin) {
    introBegin.addEventListener("click", () => {
      introPage.hidden = true;
      demographicsPage.hidden = false;
      if (progressBar) progressBar.hidden = false;
      updateProgress(1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // Enable Next button when all demographics fields are filled
  if (demographicsForm && demographicsNext) {
    const demoFields = [...demographicsForm.querySelectorAll("[required]")];

    const updateDemoState = () => {
      const complete = demoFields.every(f => isFieldComplete(demographicsForm, f));
      demographicsNext.disabled = !complete;
      if (complete) demographicsMessage.textContent = "";
    };

    demographicsForm.addEventListener("input", updateDemoState);
    demographicsForm.addEventListener("change", updateDemoState);

    demographicsNext.addEventListener("click", async () => {
      const complete = demoFields.every(f => isFieldComplete(demographicsForm, f));
      if (!complete) {
        demographicsMessage.textContent = "Please answer all questions.";
        return;
      }

      demographicsNext.disabled = true;
      demographicsMessage.textContent = "Loading...";

      try {
        // Register participant and get condition order
        const studyToken = sessionStorage.getItem("studyToken") || "";
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: studyToken })
        });
        if (!res.ok) throw new Error("Registration failed");
        const { participantId, conditionOrder } = await res.json();

        // Store for submission
        sessionStorage.setItem("participantId", String(participantId));
        sessionStorage.setItem("conditionOrder", conditionOrder);

        // Apply condition order based on ID
        const section4 = document.getElementById("section-4");
        const section5 = document.getElementById("section-5");

        if (conditionOrder === "bubble-first" && section4 && section5) {
          // Swap step numbers
          section4.dataset.qStep = "2";
          section5.dataset.qStep = "1";
          // Swap Next-button targets so the flow is step 1→2→3
          const btn4 = section4.querySelector(".q-next");
          const btn5 = section5.querySelector(".q-next");
          if (btn4) btn4.dataset.qNext = "3";
          if (btn5) btn5.dataset.qNext = "2";
          // Swap active class
          section4.classList.remove("q-step--active");
          section5.classList.add("q-step--active");
          // Reorder DOM
          sessionStorage.setItem(CONDITION_ORDER_KEY, JSON.stringify(["section-5", "section-4"]));
          applyConditionOrder(form);
        } else {
          sessionStorage.setItem(CONDITION_ORDER_KEY, JSON.stringify(["section-4", "section-5"]));
          applyConditionOrder(form);
        }

      } catch (error) {
        console.error("Registration error:", error);
        // Fallback to random order
        sessionStorage.removeItem("participantId");
        sessionStorage.removeItem("conditionOrder");
      }

      demographicsMessage.textContent = "";
      demographicsPage.hidden = true;
      mainContent.hidden = false;
      updateProgress(2);
      window.scrollTo({ top: 0, behavior: "smooth" });

      // Switch chart panel if bubble-first
      const order = sessionStorage.getItem("conditionOrder");
      if (order === "bubble-first" && typeof switchChartPanel === "function") {
        switchChartPanel("bubble");
      }

      // Show tutorial overlay
      const tutorialOverlay = document.getElementById("tutorial-overlay");
      if (tutorialOverlay) tutorialOverlay.hidden = false;
    });
  }

  // Tutorial dismiss
  const tutorialConfirm = document.getElementById("tutorial-confirm");
  if (tutorialConfirm) {
    tutorialConfirm.addEventListener("click", () => {
      const tutorialOverlay = document.getElementById("tutorial-overlay");
      if (tutorialOverlay) tutorialOverlay.hidden = true;
    });
  }

  // Map section IDs to which chart panel to show
  const sectionChartMap = {
    "section-4": "standard",  // Condition A → Standard Scatter
    "section-5": "bubble"     // Condition B → Bubble Scatter
  };

  // Questionnaire step navigation
  function goToQStep(stepNum) {
    document.querySelectorAll('.q-step').forEach(el => {
      el.classList.remove('q-step--active');
    });
    const target = document.querySelector(`.q-step[data-q-step="${stepNum}"]`);
    if (target) {
      target.classList.add('q-step--active');
      // Scroll questionnaire area to top
      const qArea = document.querySelector('.questionnaire-area');
      if (qArea) qArea.scrollTop = 0;

      updateProgress(stepNum + 1); // +1 because demographics is step 1

      // Auto-switch chart panel based on active section
      const sectionId = target.id;
      const chartType = sectionChartMap[sectionId];
      if (chartType && typeof switchChartPanel === "function") {
        switchChartPanel(chartType);
      }
    }
  }

  function validateCurrentStep(stepEl) {
    // Clear previous highlights
    stepEl.querySelectorAll('.q-block--incomplete').forEach(el => el.classList.remove('q-block--incomplete'));
    stepEl.querySelectorAll('.q-incomplete-msg').forEach(el => el.remove());

    const blocks = stepEl.querySelectorAll('.q-block');
    let allComplete = true;

    blocks.forEach(block => {
      const required = [...block.querySelectorAll('[required]')];
      if (required.length === 0) return;

      const complete = required.every(f => isFieldComplete(stepEl, f));
      if (!complete) {
        block.classList.add('q-block--incomplete');
        if (!block.querySelector('.q-incomplete-msg')) {
          const msg = document.createElement('p');
          msg.className = 'q-incomplete-msg';
          msg.textContent = 'Please answer this question.';
          block.appendChild(msg);
        }
        allComplete = false;
      }
    });

    return allComplete;
  }

  // Clear highlights on input
  form.addEventListener('input', (e) => {
    const block = e.target.closest('.q-block');
    if (block) {
      block.classList.remove('q-block--incomplete');
      const msg = block.querySelector('.q-incomplete-msg');
      if (msg) msg.remove();
    }
  });
  form.addEventListener('change', (e) => {
    const block = e.target.closest('.q-block');
    if (block) {
      block.classList.remove('q-block--incomplete');
      const msg = block.querySelector('.q-incomplete-msg');
      if (msg) msg.remove();
    }
  });

  document.querySelectorAll('.q-next').forEach(btn => {
    btn.addEventListener('click', () => {
      const currentStep = btn.closest('.q-step');
      if (!validateCurrentStep(currentStep)) {
        // Scroll to first incomplete
        const first = currentStep.querySelector('.q-block--incomplete');
        if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      goToQStep(Number(btn.dataset.qNext));
    });
  });

  const requiredFields = [...form.querySelectorAll("[required]")];

  const updateSubmitState = () => {
    const isComplete = requiredFields.every((field) => isFieldComplete(form, field));
    submitButton.disabled = !isComplete;

    if (isComplete) {
      validationMessage.textContent = "";
    }
  };

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

    const dForm = demographicsForm || form;
    const responses = {
      demographics: {
        age: getRadioValue(dForm, "age"),
        major: getRadioValue(dForm, "major"),
        takenCourse: parseYesNoToBoolean(getRadioValue(dForm, "course"))
      },
      conditionA: {
        warmup: getTextValue("conditionA-warmup"),
        correlationDirection: getRadioValue(form, "conditionA-correlation"),
        outlierCountry: getTextValue("conditionA-outlier"),
        clusterLocation: getRadioValue(form, "conditionA-cluster"),
        populationPattern: getRadioValue(form, "conditionA-pop-pattern"),
        smallPopHighExp: getTextValue("conditionA-small-pop-high-exp"),
        patternEase: Number(getRadioValue(form, "conditionA-pattern-ease")),
        outlierEase: Number(getRadioValue(form, "conditionA-outlier-ease")),
        populationEase: Number(getRadioValue(form, "conditionA-population-ease"))
      },
      conditionB: {
        warmup: getTextValue("conditionB-warmup"),
        correlationDirection: getRadioValue(form, "conditionB-correlation"),
        lowArrivalsHighExp: getTextValue("conditionB-low-arrivals-high-exp"),
        populationPattern: getRadioValue(form, "conditionB-pop-pattern"),
        populationInconsistency: parseYesNoToBoolean(getRadioValue(form, "conditionB-inconsistency")),
        inconsistentCountry: getTextValue("conditionB-inconsistency-country"),
        largePopLowArrivals: getTextValue("conditionB-large-pop-low-arrivals"),
        patternEase: Number(getRadioValue(form, "conditionB-pattern-ease")),
        outlierEase: Number(getRadioValue(form, "conditionB-outlier-ease")),
        populationEase: Number(getRadioValue(form, "conditionB-population-ease"))
      },
      comparison: {
        trend: getRadioValue(form, "comparison-trend"),
        outliers: getRadioValue(form, "comparison-outliers"),
        population: getRadioValue(form, "comparison-population"),
        clutter: getRadioValue(form, "comparison-clutter"),
        preference: getRadioValue(form, "comparison-preference"),
        explanation: getTextValue("comparison-explanation")
      },
      finalComment: getTextValue("final-response"),
      participantId: Number(sessionStorage.getItem("participantId")) || null,
      conditionOrder: sessionStorage.getItem("conditionOrder") || "unknown",
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

      // Hide everything and show debrief page
      const mainContent = document.getElementById("main-content");
      const progressBar = document.getElementById("q-progress");
      const debriefPage = document.getElementById("debrief-page");

      if (mainContent) mainContent.hidden = true;
      if (progressBar) progressBar.hidden = true;
      if (debriefPage) {
        debriefPage.hidden = false;
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (error) {
      console.error("Submission failed:", error);
      validationMessage.textContent = "Submission failed. Please try again.";
      updateSubmitState();
    }
  });

  updateSubmitState();
});

/* =========================================
    BELONG — INTERACTIONS
======================================== */

const modal = document.getElementById("cityModal");
const roleScreen = document.getElementById("roleScreen");
const cityInput = document.getElementById("cityInput");
const modalCityInput = document.getElementById("modalCityInput");
const modalTitle = document.getElementById("modalTitle");
const modalDescription = document.getElementById("modalDescription");

const profileScreen = document.getElementById("profileScreen");
const personalityScreen = document.getElementById("personalityScreen");
const localProfileScreen = document.getElementById("localProfileScreen");

const questionTitle = document.getElementById("questionTitle");
const questionSubtitle = document.getElementById("questionSubtitle");
const questionOptions = document.getElementById("questionOptions");
const questionCounter = document.getElementById("questionCounter");
const progressFill = document.getElementById("progressFill");
const nextQuestionBtn = document.getElementById("nextQuestionBtn");

const localQuestionTitle = document.getElementById("localQuestionTitle");
const localQuestionSubtitle = document.getElementById("localQuestionSubtitle");
const localQuestionOptions = document.getElementById("localQuestionOptions");
const localQuestionCounter = document.getElementById("localQuestionCounter");
const localProgressFill = document.getElementById("localProgressFill");
const localNextBtn = document.getElementById("localNextBtn");

const identityName = document.getElementById("identityName");
const identityDescription = document.getElementById("identityDescription");
const identityTags = document.getElementById("identityTags");

const localNameField = document.getElementById("localNameField");
const localNameInput = document.getElementById("localNameInput");
const localNameError = document.getElementById("localNameError");

let selectedRole = null;
let questions = [];
let currentQuestion = 0;
let selectedAnswer = [];
let answers = [];

async function loadQuestions(role) {
    try {
        const response = await fetch(`http://localhost:5000/api/questions?role=${role}`);
        const data = await response.json();
        if (!data.success) throw new Error("Failed to load questions.");
        return data.questions;
    } catch (error) {
        console.error(error);
        return [];
    }
}

function renderQuestion() {
    const question = questions[currentQuestion];
    questionTitle.textContent = question.questionText;
    questionSubtitle.textContent = question.subtitle;
    questionCounter.textContent = `${currentQuestion + 1} / ${questions.length}`;
    progressFill.style.width = `${((currentQuestion + 1) / questions.length) * 100}%`;
    questionOptions.innerHTML = "";
    selectedAnswer = [];
    nextQuestionBtn.disabled = true;
    nextQuestionBtn.classList.remove("active");

    question.options.forEach((option) => {
        const button = document.createElement("button");
        button.className = "question-option";
        button.innerHTML = `
            <span class="option-emoji">${option.emoji}</span>
            <span class="option-title">${option.title}</span>
            <span class="option-description">${option.description}</span>
        `;
        button.addEventListener("click", () => {
            if (button.classList.contains("selected")) {
                button.classList.remove("selected");
                selectedAnswer = selectedAnswer.filter(a => a.optionId !== option.id);
            } else {
                button.classList.add("selected");
                selectedAnswer.push({ optionId: option.id, title: option.title });
            }
            nextQuestionBtn.disabled = selectedAnswer.length === 0;
            nextQuestionBtn.classList.toggle("active", selectedAnswer.length > 0);
        });
        questionOptions.appendChild(button);
    });
}

function startProfile() {
    roleScreen.classList.add("hidden");
    profileScreen.classList.remove("hidden");
    currentQuestion = 0;
    answers = [];
    if (questions.length === 0) return;
    renderQuestion();
}

function showPersonality() {
    profileScreen.classList.add("hidden");
    personalityScreen.classList.remove("hidden");

    const personalityLabel = personalityScreen.querySelector(".identity-label");
    if (personalityLabel) {
        personalityLabel.textContent = selectedRole === "local" ? "YOUR LOCAL PERSONALITY" : "YOUR TRAVEL PERSONALITY";
    }

    const findLocalsBtn = document.getElementById("findLocalsBtn");
    if (findLocalsBtn) {
        findLocalsBtn.innerHTML = selectedRole === "local" ? `Show my city <span>→</span>` : `Find my locals <span>→</span>`;
    }

    const traitCounts = {};
    answers.forEach(answer => {
        answer.options.forEach(selectedOption => {
            const question = questions.find(q => q.id === answer.questionId);
            if (!question) return;
            const option = question.options.find(o => o.id === selectedOption.optionId);
            if (!option || !option.traitTags) return;
            const traits = option.traitTags.split(",").map(t => t.trim()).filter(Boolean);
            traits.forEach(trait => { traitCounts[trait] = (traitCounts[trait] || 0) + 1; });
        });
    });

    const sortedTraits = Object.entries(traitCounts).sort((a, b) => b[1] - a[1]);
    let primaryTrait = sortedTraits.length > 0 ? sortedTraits[0][0] : "exploration";

    const travellerIdentityMap = {
        food: { name: "The Flavour Chaser", description: "You believe one of the best ways to understand a place is to taste it." },
        photography: { name: "The Hidden-Eye Explorer", description: "You notice the little details, moments and stories that most travellers walk past." },
        history: { name: "The Story Collector", description: "You don't just visit places. You want to understand the stories behind them." },
        nature: { name: "The Wild-Seeker", description: "Give you a trail, a landscape and some open space and you are already interested." },
        music: { name: "The City Spark", description: "You experience places through their sounds, energy and moments happening around you." },
        conversation: { name: "The People Person", description: "For you, the people you meet can become the most memorable part of a journey." },
        culture: { name: "The Culture Seeker", description: "You want to experience what makes a place different, meaningful and alive." },
        exploration: { name: "The Curious Wanderer", description: "You are naturally curious and always want to see what is around the next corner." },
        social: { name: "The City Connector", description: "You naturally look for people, conversations and the energy that makes a city feel alive." },
        peaceful: { name: "The Quiet Wanderer", description: "You enjoy slowing down, noticing your surroundings and finding your own pace." },
        spontaneous: { name: "The Free-Spirit Explorer", description: "You don't need every moment planned. Sometimes the best experiences happen unexpectedly." }
    };

    const localIdentityMap = {
        food: { name: "The Local Food Insider", description: "You know that the best way to introduce someone to your city is often through its food." },
        hidden_places: { name: "The Hidden-Spot Keeper", description: "You know the corners of your city that most visitors would never discover on their own." },
        history: { name: "The City Storyteller", description: "You enjoy sharing the stories, history and little details that give your city its character." },
        culture: { name: "The Culture Keeper", description: "You love showing people the traditions, places and experiences that make your city unique." },
        nature: { name: "The Quiet-Side Guide", description: "You know where people can escape the noise and discover a calmer side of your city." },
        exploration: { name: "The Neighbourhood Explorer", description: "You enjoy discovering the places and experiences that make everyday life in your city interesting." },
        social: { name: "The City Connector", description: "You know where the people, conversations, music and energy of your city come alive." },
        conversation: { name: "The People Connector", description: "You enjoy meeting people and making a city feel more welcoming through genuine connection." },
        local_life: { name: "The Local-Life Insider", description: "You understand the everyday rhythms, neighbourhoods and little details that visitors rarely see." }
    };

    const identityMap = selectedRole === "local" ? localIdentityMap : travellerIdentityMap;
    const identity = identityMap[primaryTrait] || identityMap["exploration"];

    identityName.textContent = identity.name;
    identityDescription.textContent = identity.description;
    identityTags.innerHTML = sortedTraits.slice(0, 4).map(([trait]) => `<span class="identity-tag">${trait.replaceAll("_", " ")}</span>`).join("");
}

async function searchLocals(city, travellerProfileId) {
    try {
        let url = `/api/locals?travellerCity=${encodeURIComponent(city)}`;
        if (travellerProfileId) {
            url += `&travellerProfileId=${encodeURIComponent(travellerProfileId)}`;
        }
        const res = await fetch(url);
        const data = await res.json();
        return data.locals || [];
    } catch (err) {
        console.error(err);
        return [];
    }
}

function showLocalRecommendations(locals) {
    let existing = document.querySelector(".reco-section");
    if (existing) existing.remove();
    const div = document.createElement("div");
    div.className = "reco-section";
    div.innerHTML = `
        <h3 class="reco-title">Recommended locals:</h3>
        <div class="reco-list">
            ${locals.length === 0 ? "<p class=\"reco-empty\">No locals found in that city yet.</p>" : locals.map(l => `
                <div class="reco-card">
                    <div class="reco-header">
                        <h4 class="reco-name">${l.name || "Local in " + (l.city ? l.city.charAt(0).toUpperCase() + l.city.slice(1) : "")}</h4>
                        <span class="reco-city">${l.city}</span>
                    </div>
                    <div class="reco-expertise">
                        ${l.expertise.map(e => `<span class="reco-tag">${e}</span>`).join('')}
                    </div>
                    <p class="reco-reason">${l.matchReason.startsWith("Expertise:") ? "" : "<strong>Why:</strong> "}${l.matchReason}</p>
                </div>
            `).join('')}
        </div>
    `;
    personalityScreen.appendChild(div);
}

// Event listeners
document.getElementById("exploreBtn").addEventListener("click", () => {
    const city = cityInput.value.trim();
    if (city) openModal(`Let's explore ${city}.`, "Next, we'll learn what kind of traveller you are and find locals who match your vibe.");
    else openModal("Where are you heading?", "Start with a city. We'll take it from there.");
});

document.getElementById("joinBtn").addEventListener("click", () => openModal("Your Belong starts here.", "Profile creation will be our next step."));
document.getElementById("signInBtn").addEventListener("click", () => openModal("Welcome back.", "Sign-in will be connected when we build the account system."));
document.getElementById("ctaBtn").addEventListener("click", () => openModal("Where are you heading?", "Tell us a city and we'll start your Belong journey."));
document.getElementById("closeModal").addEventListener("click", closeModal);
document.getElementById("modalOverlay").addEventListener("click", closeModal);
document.getElementById("mobileMenuBtn").addEventListener("click", () => openModal("Belong", "Mobile navigation will expand as we add more features."));
document.getElementById("customizeBtn").addEventListener("click", () => alert("Next feature: Customize your Belong identity."));

document.getElementById("continueBtn").addEventListener("click", () => {
    const city = modalCityInput.value.trim();
    if (!city) { modalCityInput.focus(); return; }
    modal.classList.add("hidden");
    roleScreen.classList.remove("hidden");
});

document.getElementById("travellerRoleBtn").addEventListener("click", async () => {
    selectedRole = "traveller";
    questions = await loadQuestions("traveller");
    currentQuestion = 0; answers = [];
    document.querySelectorAll(".role-option").forEach(o => o.classList.remove("is-selected"));
    document.getElementById("travellerRoleBtn").classList.add("is-selected");
    localNameField.classList.add("hidden");
    localNameInput.value = "";
    localNameError.classList.add("hidden");
    startProfile();
});

document.getElementById("localRoleBtn").addEventListener("click", async () => {
    selectedRole = "local";
    questions = await loadQuestions("local");
    currentQuestion = 0; answers = [];
    document.querySelectorAll(".role-option").forEach(o => o.classList.remove("is-selected"));
    document.getElementById("localRoleBtn").classList.add("is-selected");
    localNameInput.value = "";
    localNameError.classList.add("hidden");
    localNameField.classList.remove("hidden");
    startProfile();
});

localNameInput.addEventListener("input", () => {
    localNameError.classList.add("hidden");
    localNameField.classList.remove("is-invalid");
});

document.getElementById("profileBack").addEventListener("click", () => profileScreen.classList.add("hidden"));
document.getElementById("findLocalsBtn").addEventListener("click", async () => {
    const city = modalCityInput.value.trim() || cityInput.value.trim();
    if (!city) return;
    const locals = await searchLocals(city, window.travellerProfileId);
    showLocalRecommendations(locals);
});

nextQuestionBtn.addEventListener("click", () => {
    if (selectedAnswer.length === 0) return;
    const isLastQuestion = currentQuestion === questions.length - 1;
    if (isLastQuestion && selectedRole === "local" && !localNameInput.value.trim()) {
        localNameError.classList.remove("hidden");
        localNameField.classList.add("is-invalid");
        localNameInput.focus();
        return;
    }
    answers.push({ questionId: questions[currentQuestion].id, options: selectedAnswer });
    if (!isLastQuestion) {
        currentQuestion++;
        renderQuestion();
    } else {
        saveProfile();
    }
});

function openModal(title, description) {
    modalTitle.textContent = title;
    modalDescription.textContent = description;
    modal.classList.remove("hidden");
    setTimeout(() => modalCityInput.focus(), 100);
}

function closeModal() { modal.classList.add("hidden"); }

async function saveProfile() {
    try {
        const res = await fetch("http://localhost:5000/api/profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: null,
                role: selectedRole,
                displayName: selectedRole === "local" ? localNameInput.value.trim() : null,
                city: modalCityInput.value.trim() || cityInput.value.trim(),
                answers: answers
            })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        if (data.profileId && selectedRole === "traveller") {
            window.travellerProfileId = data.profileId;
        }
        showPersonality();
    } catch (err) { console.error(err); }
}

window.addEventListener("load", () => {
    if (typeof gsap === "undefined") return;
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.from(".navbar", { y: -20, opacity: 0, duration: 0.7 })
      .from(".eyebrow", { y: 20, opacity: 0, duration: 0.6 }, "-=0.35")
      .from(".hero h1", { y: 30, opacity: 0, duration: 0.9 }, "-=0.35")
      .from(".hero-description", { y: 25, opacity: 0, duration: 0.7 }, "-=0.45")
      .from(".search-box", { y: 25, opacity: 0, scale: 0.98, duration: 0.7 }, "-=0.4")
      .from(".small-note", { y: 12, opacity: 0, duration: 0.5 }, "-=0.35")
      .from(".hero-visual", { x: 45, opacity: 0, duration: 1 }, "-=0.8")
      .from(".floating-card", { y: 18, opacity: 0, stagger: 0.15, duration: 0.6 }, "-=0.55");
    gsap.to(".visual-background", { y: -10, rotation: 14, duration: 4, ease: "sine.inOut", repeat: -1, yoyo: true });
    gsap.to(".travel-scene", { y: -6, duration: 4.5, ease: "sine.inOut", repeat: -1, yoyo: true });
    gsap.to(".sun", { x: 8, y: -6, duration: 5, ease: "sine.inOut", repeat: -1, yoyo: true });
    gsap.to(".traveller-one", { y: -5, duration: 2.8, ease: "sine.inOut", repeat: -1, yoyo: true });
    gsap.to(".traveller-two", { y: -7, duration: 3.4, ease: "sine.inOut", repeat: -1, yoyo: true });
});

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const elements = {
  loading: $("#loading"),
  landing: $("#landing"),
  quiz: $("#quiz"),
  results: $("#results"),
  start: $("#start-button"),
  fresh: $("#fresh-button"),
  backHome: $("#back-home"),
  resultHome: $("#result-home"),
  submit: $("#submit-button"),
  retry: $("#retry-button"),
  previous: $("#previous-button"),
  next: $("#next-button"),
  year: $("#quiz-year"),
  answeredCount: $("#answered-count"),
  progressPercent: $("#progress-percent"),
  progressBar: $("#progress-bar"),
  questionGrid: $("#question-grid"),
  questionPosition: $("#question-position"),
  questionText: $("#question-text"),
  bonusNote: $("#bonus-note"),
  options: $("#options"),
  toast: $("#toast"),
  reviewList: $("#review-list"),
};

let bank;
let selectedYear = 110;
let activeExam;
let answers = {};
let currentIndex = 0;
let currentResults = [];
let reviewFilter = "all";

const storageKey = (year) => `architect-law-quiz:${year}`;

function showView(view) {
  [elements.landing, elements.quiz, elements.results].forEach((section) => section.classList.add("is-hidden"));
  view.classList.remove("is-hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => elements.toast.classList.remove("is-visible"), 1600);
}

function getSaved(year = selectedYear) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(year)) || "null");
  } catch {
    return null;
  }
}

function updateStartState() {
  const saved = getSaved();
  const count = saved ? Object.keys(saved.answers || {}).length : 0;
  elements.start.querySelector("span:first-child").textContent = count ? `繼續作答（已答 ${count} 題）` : "開始作答";
  elements.fresh.classList.toggle("is-hidden", !count);
}

function selectYear(year) {
  selectedYear = Number(year);
  $$(".year-option").forEach((button) => {
    const selected = Number(button.dataset.year) === selectedYear;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });
  updateStartState();
}

function saveProgress() {
  localStorage.setItem(storageKey(selectedYear), JSON.stringify({ answers, currentIndex, updatedAt: Date.now() }));
}

function startQuiz({ fresh = false } = {}) {
  activeExam = bank.years.find((item) => item.year === selectedYear);
  const saved = fresh ? null : getSaved();
  answers = saved?.answers || {};
  currentIndex = Math.min(saved?.currentIndex || 0, activeExam.questions.length - 1);
  elements.year.textContent = selectedYear;
  showView(elements.quiz);
  renderQuestion();
  if (saved && Object.keys(answers).length) showToast("已恢復上次作答進度");
}

function answeredTotal() {
  return Object.keys(answers).filter((key) => answers[key]).length;
}

function renderProgress() {
  const count = answeredTotal();
  const percent = Math.round((count / activeExam.questions.length) * 100);
  elements.answeredCount.textContent = count;
  elements.progressPercent.textContent = `${percent}%`;
  elements.progressBar.style.width = `${percent}%`;
}

function renderGrid() {
  elements.questionGrid.innerHTML = activeExam.questions.map((question, index) => {
    const classes = [answers[question.number] ? "is-answered" : "", index === currentIndex ? "is-current" : ""].filter(Boolean).join(" ");
    return `<button type="button" class="${classes}" data-index="${index}" aria-label="第 ${question.number} 題${answers[question.number] ? "，已作答" : ""}" ${index === currentIndex ? 'aria-current="true"' : ""}>${question.number}</button>`;
  }).join("");
}

function renderQuestion() {
  const question = activeExam.questions[currentIndex];
  const number = String(question.number).padStart(2, "0");
  elements.questionPosition.textContent = `QUESTION ${number} / ${activeExam.questionCount}`;
  elements.questionText.textContent = `${question.number}. ${question.stem}`;
  elements.bonusNote.classList.toggle("is-hidden", !question.bonus);
  elements.options.innerHTML = Object.entries(question.options).map(([letter, text]) => {
    const selected = answers[question.number] === letter;
    return `
      <label class="option-label ${selected ? "is-selected" : ""}">
        <input type="radio" name="answer" value="${letter}" ${selected ? "checked" : ""} />
        <span class="option-letter">${letter}</span>
        <span>${escapeHtml(text)}</span>
      </label>`;
  }).join("");
  elements.previous.disabled = currentIndex === 0;
  elements.previous.style.opacity = currentIndex === 0 ? ".45" : "1";
  elements.next.textContent = currentIndex === activeExam.questionCount - 1 ? "回到第一題 ↺" : "下一題 →";
  renderProgress();
  renderGrid();
}

function chooseAnswer(letter) {
  const question = activeExam.questions[currentIndex];
  answers[question.number] = letter;
  saveProgress();
  renderQuestion();
}

function goTo(index) {
  currentIndex = Math.max(0, Math.min(index, activeExam.questions.length - 1));
  saveProgress();
  renderQuestion();
  $(".question-card").scrollIntoView({ behavior: "smooth", block: "start" });
}

function buildResults() {
  currentResults = activeExam.questions.map((question) => {
    const selected = answers[question.number] || null;
    const correct = question.bonus || question.accepted.includes(selected);
    return { question, selected, correct };
  });

  const correctCount = currentResults.filter((item) => item.correct).length;
  const wrongCount = currentResults.filter((item) => item.selected && !item.correct).length;
  const unanswered = currentResults.filter((item) => !item.selected && !item.question.bonus).length;
  const attempted = activeExam.questionCount - unanswered;
  const score = correctCount * activeExam.pointsPerQuestion;
  const accuracy = attempted ? Math.round((correctCount / attempted) * 100) : 0;

  $("#score-value").textContent = Number.isInteger(score) ? score : score.toFixed(2).replace(/0$/, "");
  $("#correct-count").textContent = correctCount;
  $("#wrong-count").textContent = wrongCount;
  $("#unanswered-result").textContent = unanswered;
  $("#accuracy-value").textContent = `${accuracy}%`;
  $("#result-message").textContent = score >= 80 ? "表現穩健，法規脈絡已掌握得相當扎實。" : score >= 60 ? "已有不錯基礎，從錯題回顧補強薄弱章節。" : "先從錯題找出規則，再回頭重做會進步得很快。";
  reviewFilter = "all";
  $$(".filter-button").forEach((button) => button.classList.toggle("is-active", button.dataset.filter === "all"));
  renderReview();
}

function submitQuiz() {
  const unanswered = activeExam.questions.filter((question) => !answers[question.number] && !question.bonus).length;
  const prompt = unanswered ? `還有 ${unanswered} 題未作答，確定要交卷評分嗎？` : "確定要交卷評分嗎？";
  if (!window.confirm(prompt)) return;
  buildResults();
  localStorage.removeItem(storageKey(selectedYear));
  showView(elements.results);
}

function reviewStatus(item) {
  if (item.question.bonus) return { className: "correct", label: "送分題" };
  if (!item.selected) return { className: "unanswered", label: "未作答" };
  if (item.correct) return { className: "correct", label: "答對" };
  return { className: "wrong", label: "答錯" };
}

function renderReview() {
  const filtered = currentResults.filter((item) => {
    if (reviewFilter === "wrong") return item.selected && !item.correct;
    if (reviewFilter === "unanswered") return !item.selected && !item.question.bonus;
    return true;
  });

  elements.reviewList.innerHTML = filtered.length ? filtered.map((item) => {
    const status = reviewStatus(item);
    const official = item.question.bonus ? "一律給分" : `${item.question.accepted.join("／")} · ${escapeHtml(item.question.options[item.question.accepted[0]])}`;
    const selected = item.selected ? `${item.selected} · ${escapeHtml(item.question.options[item.selected])}` : "未作答";
    return `
      <article class="review-item is-${status.className}">
        <div class="review-title">
          <span class="review-number">${item.question.number}</span>
          <h3>${escapeHtml(item.question.stem)}</h3>
          <span class="status-pill ${status.className}">${status.label}</span>
        </div>
        <div class="review-answer">
          <span>你的答案：<strong>${selected}</strong></span>
          <span>官方答案：<strong>${official}</strong></span>
        </div>
      </article>`;
  }).join("") : '<p class="empty-state">這個篩選條件下沒有題目。</p>';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
}

function returnHome() {
  showView(elements.landing);
  updateStartState();
}

async function init() {
  try {
    const response = await fetch("questions.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    bank = await response.json();
    updateStartState();
    elements.loading.classList.add("is-hidden");
  } catch (error) {
    elements.loading.innerHTML = `<p>題庫載入失敗，請重新整理頁面。<br><small>${escapeHtml(error.message)}</small></p>`;
  }
}

$$('.year-option').forEach((button) => button.addEventListener("click", () => selectYear(button.dataset.year)));
elements.start.addEventListener("click", () => startQuiz());
elements.fresh.addEventListener("click", () => {
  if (!window.confirm("確定清除目前年度的作答紀錄嗎？")) return;
  localStorage.removeItem(storageKey(selectedYear));
  startQuiz({ fresh: true });
});
elements.backHome.addEventListener("click", returnHome);
elements.resultHome.addEventListener("click", returnHome);
elements.submit.addEventListener("click", submitQuiz);
elements.retry.addEventListener("click", () => startQuiz({ fresh: true }));
elements.previous.addEventListener("click", () => goTo(currentIndex - 1));
elements.next.addEventListener("click", () => goTo(currentIndex === activeExam.questionCount - 1 ? 0 : currentIndex + 1));
elements.options.addEventListener("change", (event) => chooseAnswer(event.target.value));
elements.questionGrid.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-index]");
  if (button) goTo(Number(button.dataset.index));
});
$$('.filter-button').forEach((button) => button.addEventListener("click", () => {
  reviewFilter = button.dataset.filter;
  $$('.filter-button').forEach((item) => item.classList.toggle("is-active", item === button));
  renderReview();
}));
document.addEventListener("keydown", (event) => {
  if (elements.quiz.classList.contains("is-hidden")) return;
  if (["A", "B", "C", "D"].includes(event.key.toUpperCase())) chooseAnswer(event.key.toUpperCase());
  if (event.key === "ArrowLeft") goTo(currentIndex - 1);
  if (event.key === "ArrowRight") goTo(currentIndex + 1);
});

init();

/* ---------- Question bank (a random 5 are picked every run) ---------- */
const QUESTION_BANK = [
  { q: "Which method selects an element by ID in JavaScript?", options: ["getElementById()", "querySelectorAll()", "getElementsByClassName()", "getElementByName()"], answer: "getElementById()" },
  { q: "Which HTML attribute is used to link CSS?", options: ["href", "rel", "src", "link"], answer: "rel" },
  { q: "Which method removes the last element of an array?", options: ["shift()", "pop()", "splice()", "slice()"], answer: "pop()" },
  { q: "Which JS array method adds an element to the end?", options: ["push()", "unshift()", "concat()", "pop()"], answer: "push()" },
  { q: "Which CSS property changes text color?", options: ["font-color", "text-style", "color", "background"], answer: "color" },
  { q: "Which JS keyword declares a block-scoped variable?", options: ["var", "let", "const", "both let and const"], answer: "both let and const" },
  { q: "Which Bootstrap class creates a responsive fixed-width container?", options: [".container", ".wrapper", ".box", ".grid"], answer: ".container" },
  { q: "Which HTML tag is used for the largest heading?", options: ["<head>", "<h6>", "<h1>", "<header>"], answer: "<h1>" },
  { q: "Which CSS layout module is one-dimensional (row or column)?", options: ["Grid", "Flexbox", "Float", "Table"], answer: "Flexbox" },
  { q: "Which operator checks both value and type in JavaScript?", options: ["==", "=", "===", "!="], answer: "===" },
  { q: "Which event fires when a user clicks an element?", options: ["onhover", "onclick", "onpress", "onselect"], answer: "onclick" },
  { q: "Which idea is used to make a layout adapt to screen size?", options: ["Media queries / breakpoints", "Inline alerts", "Lazy loading", "Cookies"], answer: "Media queries / breakpoints" }
];

const TOTAL_QUESTIONS = 5;
const TIME_PER_QUESTION = 15; // seconds

/* ---------- State ---------- */
let questions = [], current = 0, score = 0, timeLeft = TIME_PER_QUESTION, timerId = null, answered = false;
let results = []; // {q, your, correct, ok}

/* ---------- Elements ---------- */
const $ = id => document.getElementById(id);
const progressBar = $("progressBar"), qCount = $("qCount"), timerEl = $("timer"), qText = $("qText"),
      optionsEl = $("options"), nextBtn = $("nextBtn"), quizCard = $("quizCard"), resultCard = $("resultCard"),
      scoreText = $("scoreText"), resultBody = $("resultBody");

/* ---------- Helpers ---------- */
function shuffle(arr) {            // Fisher-Yates
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- Quiz flow ---------- */
function startQuiz() {
  questions = shuffle(QUESTION_BANK).slice(0, TOTAL_QUESTIONS).map(item => ({ ...item, options: shuffle(item.options) }));
  current = 0; score = 0; results = [];
  quizCard.classList.remove("d-none");
  resultCard.classList.add("d-none");
  buildProgress();
  showQuestion();
}

function buildProgress() {
  progressBar.innerHTML = "";
  questions.forEach(() => {
    const s = document.createElement("div");
    s.className = "seg";
    progressBar.appendChild(s);
  });
}

function updateProgress() {
  [...progressBar.children].forEach((seg, i) => {
    seg.classList.toggle("done", i < current);
    seg.classList.toggle("current", i === current);
  });
  progressBar.setAttribute("aria-valuenow", current);
}

function showQuestion() {
  answered = false;
  const item = questions[current];
  qCount.textContent = `Question ${current + 1} / ${questions.length}`;
  qText.textContent = item.q;
  nextBtn.disabled = true;
  nextBtn.innerHTML = current === questions.length - 1 ? 'Finish <i class="bi bi-check-lg"></i>' : 'Next <i class="bi bi-arrow-right"></i>';
  updateProgress();

  optionsEl.innerHTML = "";
  item.options.forEach(opt => {
    const b = document.createElement("button");
    b.className = "opt";
    b.textContent = opt;
    b.addEventListener("click", () => selectAnswer(opt));
    optionsEl.appendChild(b);
  });
  startTimer();
}

function startTimer() {
  clearInterval(timerId);
  timeLeft = TIME_PER_QUESTION;
  renderTimer();
  timerId = setInterval(() => {
    timeLeft--;
    renderTimer();
    if (timeLeft <= 0) { clearInterval(timerId); selectAnswer(null); } // time up
  }, 1000);
}

function renderTimer() {
  timerEl.textContent = `Time Left: ${timeLeft}s`;
  timerEl.classList.toggle("safe", timeLeft > 5);
}

function selectAnswer(choice) {
  if (answered) return;
  answered = true;
  clearInterval(timerId);

  const item = questions[current];
  const ok = choice === item.answer;
  if (ok) score++;
  results.push({ q: item.q, your: choice ?? "Not Answered", correct: item.answer, ok });

  [...optionsEl.children].forEach(btn => {
    btn.disabled = true;
    if (btn.textContent === item.answer) btn.classList.add("correct");
    else if (btn.textContent === choice) btn.classList.add("wrong");
  });
  nextBtn.disabled = false;
  nextBtn.focus();
}

nextBtn.addEventListener("click", () => {
  current++;
  if (current < questions.length) showQuestion();
  else showResult();
});

/* ---------- Result ---------- */
function showResult() {
  clearInterval(timerId);
  current = questions.length;
  updateProgress();
  quizCard.classList.add("d-none");
  resultCard.classList.remove("d-none");
  scoreText.textContent = `Score: ${score} / ${questions.length}`;
  resultBody.innerHTML = "";
  results.forEach((r, i) => {
    const tr = document.createElement("tr");
    [i + 1, r.q, r.your, r.correct].forEach(v => { const td = document.createElement("td"); td.textContent = v; tr.appendChild(td); });
    const st = document.createElement("td");
    st.className = "status " + (r.ok ? "ok" : "bad");
    st.textContent = r.ok ? "Correct" : "Incorrect";
    tr.appendChild(st);
    resultBody.appendChild(tr);
  });
}

/* ---------- PDF download (jsPDF + AutoTable) ---------- */
$("pdfBtn").addEventListener("click", () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(20);
  doc.text("Quiz Result", 14, 22);
  doc.setFontSize(13);
  doc.text(`Score: ${score} / ${questions.length}`, 14, 33);
  doc.autoTable({
    startY: 40,
    head: [["#", "Question", "Your Answer", "Correct Answer", "Status"]],
    body: results.map((r, i) => [i + 1, r.q, r.your, r.correct, r.ok ? "Correct" : "Incorrect"]),
    headStyles: { fillColor: [221, 221, 221], textColor: 20 },
    columnStyles: { 0: { cellWidth: 10 }, 4: { cellWidth: 26 } },
    didParseCell: d => {
      if (d.section === "body" && d.column.index === 4) {
        d.cell.styles.fillColor = d.cell.raw === "Correct" ? [25, 135, 84] : [220, 53, 69];
        d.cell.styles.textColor = 255;
      }
    }
  });
  doc.save("Quiz_Result.pdf");
});

$("restartBtn").addEventListener("click", startQuiz);

/* ---------- Dark / light mode ---------- */
function applyTheme(t) {
  document.documentElement.setAttribute("data-bs-theme", t);
  $("themeIcon").className = t === "dark" ? "bi bi-moon-stars-fill" : "bi bi-sun-fill";
  try { localStorage.setItem("quiz-theme", t); } catch (e) {}
}
$("themeBtn").addEventListener("click", () =>
  applyTheme(document.documentElement.getAttribute("data-bs-theme") === "dark" ? "light" : "dark"));
(function initTheme() {
  let t = "light";
  try { t = localStorage.getItem("quiz-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); } catch (e) {}
  applyTheme(t);
})();

startQuiz();
# 日本語 Hub - Japanese Study Repository

Welcome to your personal Japanese study space! This repository hosts interactive HTML study sheets that track vocabulary, natural grammar patterns, shadowing practices, and quizzes.

All lessons are dynamically compiled into a modern, glassmorphic study dashboard hosted on **GitHub Pages**.

---

## 🚀 How It Works

1. **Write Lessons:** You write standard HTML study pages inside the `lessons/` directory (e.g., `lessons/inflation.html`).
2. **Build & Auto-Instrument:** A TypeScript script runs on push (or locally) to extract metadata from your HTML pages. In addition to updating the dashboard, it **automatically instruments** the new HTML files with CSS & JS helpers for interactive study features.
3. **Build-Time AI Enrichment:** During compilation, if you have configured an LLM API key, the builder uses OpenAI or Gemini to generate context-specific **Parallel Reading Challenges** and **Pragmatics breakdowns**, appending them statically to the lesson files.
4. **Deploy Dashboard:** GitHub Actions runs the compiler automatically on push and deploys the updated homepage and instrumented lessons to **GitHub Pages**.

---

## 🎧 Interactive Study Features

Every compiled lesson is automatically equipped with these features in the browser:

* **Context-Aware Vocabulary Tooltips:** Hovering or tapping any highlighted vocabulary word inside sentence blocks immediately displays a glassmorphic floating tooltip containing its reading, translation, and usage notes, preventing the need to scroll back to the vocab table.
* **A-B Shadowing Loop:** Dual buttons (`[A]` and `[B]`) are injected into the custom WAV player's timeline. You can set boundaries to isolate and continuously loop specific audio segments for focused shadowing practice.
* **Self-Listening Playback:** Click the mic icon next to any Japanese text (`class="jp"`) to record your own pronunciation. A play button will appear to let you listen to your own recording alongside the native audio for side-by-side comparison.
* **Voice Coach (Speech-to-Text):** Validates your pronunciation and displays a color-coded visual diff showing exactly what characters you matched (green), mismatched (red), or added.
* **Furigana & Reading Masking:** A toggle button in the floating panel masks readings in vocabulary tables (blurs them). Hovering or tapping reveals them—ideal for active recall.
* **Text-To-Speech (TTS):** Elegant audio play buttons are injected next to Japanese text (`class="jp"`) if no native audio wave is available.

---

## 🤖 Build-Time AI Lesson Enrichment

When you compile the project, the builder automatically scans each lesson file. If a lesson doesn't have AI material yet, it uses an LLM to generate two premium sections and injects them statically:

1. **Parallel Reading Challenge:** An authentic story or dialogue (80–120 words) naturally incorporating the lesson's target vocabulary, accompanied by a revealable English translation and interactive multiple-choice comprehension check questions.
2. **Formality & Social Register Breakdown:** A 3-column analysis outlining the conversational tone (Teineigo, Keigo, casual), relationship dynamics (who you can say these lines to), and specific grammar nuances.

### 🔑 Local API Configuration

We support both **OpenAI** and **Google Gemini** endpoints. To configure:

1. Create your local environment file:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and fill in your keys and preferred model:
   ```env
   # Option A: OpenAI (gpt-4o-mini is default)
   OPENAI_API_KEY=sk-proj-YourKeyHere
   AI_MODEL=gpt-4o

   # Option B: Gemini (gemini-2.5-flash is default)
   # GEMINI_API_KEY=AIzaSy...
   # AI_MODEL=gemini-2.5-flash
   ```

*Note: If no API key is present in `.env`, the compiler runs normally and falls back to generating a local offline mock card for the Keikyu lesson, keeping local runs fully testable.*

---

## 📝 Guide: Adding a New Lesson

### Step 1: Create the HTML File
Create a new `.html` file inside the `lessons/` directory (e.g., `lessons/family-conversation.html`). Use this template:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Talking about Family - Japanese Study File</title>
</head>
<body>
  <main class="wrap">
    <section class="card">
      <div class="pill">Japanese lesson review</div>
      <h1>家族との会話</h1>
      
      <p class="muted">Session date: 2026-06-17. Level: beginner to lower-intermediate. Focus: natural family phrasing, casual particles, and speaking naturally about siblings.</p>
      
      <span class="tag">family</span>
      <span class="tag">casual speaking</span>
    </section>

    <!-- Vocab table (parser automatically extracts this for tooltips & AI prompt) -->
    <section class="card">
      <h2>Vocabulary</h2>
      <table>
        <thead>
          <tr>
            <th>Kanji</th>
            <th>Reading</th>
            <th>Meaning</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>きょうだい</td>
            <td>兄弟</td>
            <td>siblings</td>
            <td>Often written in hiragana.</td>
          </tr>
        </tbody>
      </table>
    </section>
  </main>
</body>
</html>
```

### Step 2: Push Your Changes
To push your new lesson online and update the GitHub Pages site, run:
```bash
git add lessons/family-conversation.html
git commit -m "feat: add family conversation lesson"
git push origin main
```

---

## ⚠️ DOs and DON'Ts

### 👍 DOs
* **DO** write your vocabulary in clean tables containing Kanji, Reading, Meaning, and Notes headers. The compiler parses these dynamically to highlight your vocabulary across reading sentences and inject hover tooltips.
* **DO** place your target speaking sentences in blocks containing `class="jp"`. This allows the text-to-speech engine and the speech-recognition diff tool to target them.
* **DO** use the pre-commit hook. It compiles the index and injects local configs automatically so you never push raw un-instrumented lessons.
* **DO** keep your `.env` file private. It is added to `.gitignore` so your API keys are never checked into public version control.

### 👎 DON'Ts
* **DON'T** manually inject references to `lesson-common.css` or `lesson-common.js` in your HTML heads/bodies. The builder handles this automatically during compilation.
* **DON'T** change the H1 tag structure. The parser relies on `<h1>` tags to generate the topic header on the main dashboard index page.
* **DON'T** write raw LLM requests in client-side script tags. Doing so would expose your API keys to the browser, allowing others to steal them. Keep AI tasks inside the build-time compiler.

---

## 🛠️ Local Development Setup

To run the compilation tool locally, install the [Bun](https://bun.sh) runtime:

### ⚓ Git Hooks (Auto-build on commit)
To automatically compile and stage your manual lesson additions every time you commit:
```bash
sh scripts/setup-hooks.sh
```
This hook will run the compiler, auto-inject the interactive features (TTS, Voice Coach, loops) and run the build-time AI generator before committing.

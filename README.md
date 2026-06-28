# 日本語 Hub - Japanese Study Repository

Welcome to your personal Japanese study space! This repository hosts interactive HTML study sheets that track vocabulary, natural grammar patterns, shadowing practices, and quizzes. 

All lessons are dynamically compiled into a modern study dashboard hosted on **GitHub Pages**.

---

## 🚀 How It Works

1. **Write Lessons:** You write standard HTML study pages inside the `lessons/` directory (e.g., `lessons/inflation.html`).
2. **Build & Auto-Instrument:** A TypeScript script runs on push (or locally) to extract metadata from your HTML pages. In addition to updating the dashboard, it **automatically instruments** the new HTML files with CSS & JS helpers for interactive study (Text-to-Speech, Speech Recognition, and Furigana/Reading masking).
3. **Deploy Dashboard:** GitHub Actions runs the compiler automatically on push and deploys the updated glassmorphic dashboard homepage and instrumented lessons to **GitHub Pages**.

---

## 🎧 Interactive Study Features

Every compiled lesson is automatically equipped with these features in the browser:
* **Furigana & Reading Masking:** A toggle button in the floating panel masks readings in vocabulary tables (blurs them). Hovering or tapping reveals them—ideal for active recall.
* **Text-To-Speech (TTS):** Elegant audio play buttons are injected next to Japanese text (`class="jp"`). Click to hear the natural pronunciation.
* **Voice Coach (Speech-to-Text):** Click the mic icon next to any Japanese text to speak. The helper transcribes your speech and displays a visual diff showing exactly what characters you matched (green), mismatched (red), or added.
* **Audio Wave Player Integration:** If a matching `.wav` file is present in `voice_lessons/`, a custom player card is injected at the top of the lesson with playback speed controls (`0.75x`, `1.0x`, `1.25x`) for shadowing.

---

## 📝 Guide: Adding a New Lesson

Follow these steps to add a new study sheet and update your online dashboard:

### Step 1: Create the HTML File
Create a new `.html` file inside the `lessons/` directory (e.g., `lessons/family-conversation.html`).

To make sure the dashboard parses your lesson metadata correctly, use the following structure in your HTML file:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <!-- 1. The dashboard will use this title if there's no H1 tag -->
  <title>Talking about Family - Japanese Study File</title>
  <style>
    /* Add any custom CSS styling here */
  </style>
</head>
<body>
  <main class="wrap">
    <section class="card">
      <div class="pill">Japanese lesson review</div>
      <!-- 2. This will be the main Topic Title shown on the dashboard -->
      <h1>家族との会話</h1>
      
      <!-- 3. This paragraph MUST contain the Session Date and Focus description -->
      <p class="muted">Session date: 2026-06-17. Level: beginner to lower-intermediate. Focus: natural family phrasing, casual particles, and speaking naturally about siblings.</p>
      
      <!-- 4. These tags will be extracted and show up in the category filter -->
      <span class="tag">family</span>
      <span class="tag">casual speaking</span>
      <span class="tag">pronunciation</span>
    </section>

    <!-- Rest of your lesson content goes here -->
  </main>
</body>
</html>
```

### Step 2: Preview Your Dashboard Locally (Optional)
If you want to verify the dashboard layout and check your new lesson locally before pushing:
1. Compile the local dashboard:
   ```bash
   bun run build-index.ts
   ```
2. Open the newly updated `index.html` file in your browser to view the changes.
*(Note: `index.html` is in your `.gitignore` and won't get committed to git, keeping your commit log clean!)*

### Step 3: Push Your Changes
To push your new lesson online and update the GitHub Pages site, run:
```bash
git add lessons/family-conversation.html
git commit -m "feat: add family conversation lesson"
git push origin main
```

The GitHub Actions pipeline will pick up your push, build the dashboard automatically, and deploy the updated site in about 30 seconds.

> [!NOTE]
> Because GitHub Actions rebuilds the site on push, you do **not** need to run `bun run build-index.ts` locally unless you want to preview the dashboard and interactive tools in your browser before committing.

---

## 🛠️ Local Development Setup

To run the compilation tool locally, you need the [Bun](https://bun.sh) runtime:

### Installation
If you haven't installed Bun yet, run:
```bash
# Via Homebrew (macOS)
brew install bun

# Via cURL (macOS/Linux)
curl -fsSL https://bun.sh/install | bash
```

### Rebuilding the Index
```bash
bun run build-index.ts
```

### ⚓ Git Hooks (Auto-build on commit)
To automatically compile and stage your manual lesson additions every time you commit, install the pre-commit hook:
```bash
sh scripts/setup-hooks.sh
```
This hook will run the compiler, auto-inject the interactive features (TTS, Voice Coach) into your manual HTML lessons, and stage them automatically before committing.

# 日本語 Hub - Japanese Study Repository

Welcome to your personal Japanese study space! This repository hosts interactive HTML study sheets that track vocabulary, natural grammar patterns, shadowing practices, and quizzes. 

All lessons are dynamically compiled into a modern study dashboard hosted on **GitHub Pages**.

---

## 🚀 How It Works

1. **Write Lessons:** You write standard HTML study pages inside the `lessons/` directory (e.g., `lessons/inflation.html`).
2. **Build Automatically:** A TypeScript script runs on push to extract metadata from your HTML pages (such as topics, level, study focus, session date, and tags).
3. **Deploy Dashboard:** GitHub Actions runs the compiler and deploys a glassmorphic dashboard homepage containing live search, category tagging, theme toggles, and study progress tracking.

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

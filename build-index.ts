import { Glob } from "bun";
import { join } from "node:path";

interface LessonMetadata {
  filename: string;
  title: string;
  topic: string;
  date: string;
  parsedDate: Date | null;
  level: string;
  focus: string;
  tags: string[];
}

function findMatchingAudio(lessonFilename: string, audioFiles: string[]): string | null {
  const cleanName = lessonFilename.toLowerCase();
  for (const audio of audioFiles) {
    const base = audio.split("/").pop()?.replace(".wav", "").toLowerCase();
    if (!base) continue;
    
    // Direct match: if base audio name matches or is part of the lesson file name
    if (cleanName.includes(base)) {
      return `../${audio}`;
    }
    // Heuristics for variations (e.g. hot-weather.wav mapping to heat lessons)
    if (base === "hot-weather" && (cleanName.includes("heat") || cleanName.includes("hot"))) {
      return `../${audio}`;
    }
    // Heuristics for vocab-1.wav mapping to inflation lesson
    if (base === "vocab-1" && cleanName.includes("inflation")) {
      return `../${audio}`;
    }
  }
  return null;
}

function extractVocabulary(content: string, filename: string, lessonTitle: string): { id: string; kanji: string; reading: string; meaning: string; lessonTitle: string; lessonUrl: string; }[] {
  const vocabList: { id: string; kanji: string; reading: string; meaning: string; lessonTitle: string; lessonUrl: string; }[] = [];
  
  const tableRegex = /<table>([\s\S]*?)<\/table>/gi;
  let tableMatch;
  
  while ((tableMatch = tableRegex.exec(content)) !== null) {
    const tableHtml = tableMatch[1];
    
    // Check if this table contains column headers like Japanese/Meaning
    const hasJapaneseHeader = /<th>\s*(Japanese|日本語|Word|語彙|表現)\s*<\/th>/i.test(tableHtml);
    const hasMeaningHeader = /<th>\s*(Meaning|意味|Translation|English|訳)\s*<\/th>/i.test(tableHtml);
    
    if (!hasJapaneseHeader && !hasMeaningHeader) {
      continue;
    }
    
    // Find column indexes
    const thRegex = /<th>([\s\S]*?)<\/th>/gi;
    let thMatch;
    const headers: string[] = [];
    while ((thMatch = thRegex.exec(tableHtml)) !== null) {
      headers.push(thMatch[1].replace(/<\/?[^>]+(>|$)/g, "").trim().toLowerCase());
    }
    
    let kanjiIndex = 0;
    let readingIndex = 1;
    let meaningIndex = 2;
    
    if (headers.length > 0) {
      const kIdx = headers.findIndex(h => h.includes("japanese") || h.includes("日本語") || h.includes("word") || h.includes("vocab") || h.includes("表現") || h === "語彙");
      const rIdx = headers.findIndex(h => h.includes("reading") || h.includes("読み") || h.includes("発音") || h === "かな" || h === "ふりがな" || h === "ひらがな");
      const mIdx = headers.findIndex(h => h.includes("meaning") || h.includes("意味") || h.includes("translation") || h.includes("english") || h.includes("訳") || h.includes("解説"));
      
      if (kIdx !== -1) kanjiIndex = kIdx;
      if (rIdx !== -1) readingIndex = rIdx;
      if (mIdx !== -1) meaningIndex = mIdx;
    }
    
    const tbodyMatch = tableHtml.match(/<tbody>([\s\S]*?)<\/tbody>/i);
    const rowsHtml = tbodyMatch ? tbodyMatch[1] : tableHtml;
    
    const trRegex = /<tr>([\s\S]*?)<\/tr>/gi;
    let trMatch;
    
    while ((trMatch = trRegex.exec(rowsHtml)) !== null) {
      const rowHtml = trMatch[1];
      if (rowHtml.includes("</th>")) continue;
      
      const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let tdMatch;
      const cells: string[] = [];
      while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
        cells.push(tdMatch[1]);
      }
      
      if (cells.length > Math.max(kanjiIndex, meaningIndex)) {
        const kanji = cells[kanjiIndex].replace(/<\/?[^>]+(>|$)/g, "").trim();
        const reading = cells[readingIndex] ? cells[readingIndex].replace(/<\/?[^>]+(>|$)/g, "").trim() : "";
        const meaning = cells[meaningIndex].replace(/<\/?[^>]+(>|$)/g, "").trim();
        
        if (kanji && meaning) {
          const id = `${filename}:${kanji}`;
          vocabList.push({
            id,
            kanji,
            reading: reading === "-" ? "" : reading,
            meaning,
            lessonTitle,
            lessonUrl: filename
          });
        }
      }
    }
  }
  
  return vocabList;
}

async function buildDashboard() {
  console.log("Starting Japanese Learning Hub dashboard compilation...");
  
  const glob = new Glob("lessons/*.html");
  const lessons: LessonMetadata[] = [];
  const vocabularies: any[] = [];
  
  // Scan directory for audio files
  const audioGlob = new Glob("voice_lessons/*.wav");
  const audioFiles: string[] = [];
  for await (const audioFile of audioGlob.scan(".")) {
    audioFiles.push(audioFile);
  }
  
  // Scan directory for HTML files
  for await (const file of glob.scan(".")) {
    try {
      const rawContent = await Bun.file(file).text();
      let content = rawContent;

      // Automatically inject/update CSS, JS, and window.LESSON_AUDIO config
      const audioFile = findMatchingAudio(file, audioFiles);
      
      const audioConfigRegex = /<script>\s*window\.LESSON_AUDIO\s*=[\s\S]*?<\/script>/i;
      const audioScript = audioFile ? `<script>window.LESSON_AUDIO = "${audioFile}";</script>` : '';
      
      if (audioConfigRegex.test(content)) {
        content = content.replace(audioConfigRegex, audioScript);
      } else if (audioScript) {
        content = content.replace("</head>", `  ${audioScript}\n</head>`);
      }
      
      if (!content.includes("lesson-common.css")) {
        content = content.replace("</head>", '  <link rel="stylesheet" href="../lesson-common.css">\n</head>');
      }
      
      if (!content.includes("lesson-common.js")) {
        content = content.replace("</body>", '  <script src="../lesson-common.js"></script>\n</body>');
      }
      
      if (content !== rawContent) {
        await Bun.write(file, content);
        console.log(`Instrumented lesson with helper files and configs: ${file}`);
      }
      
      // 1. Extract HTML Title
      const titleMatch = content.match(/<title>([\s\S]*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].replace("- Japanese Study File", "").trim() : file;
      
      // 2. Extract H1 Header
      const h1Match = content.match(/<h1>([\s\S]*?)<\/h1>/i);
      const topic = h1Match ? h1Match[1].trim() : title;
      
      // 3. Extract Session Date
      const dateMatch = content.match(/(?:Session date:|Saved lesson from)\s*([a-zA-Z0-9\-\s,]+?)(?:\.|\s*JST|\s*Level)/i);
      const dateStr = dateMatch ? dateMatch[1].trim() : "Unknown Date";
      
      // Parse date for sorting
      let parsedDate: Date | null = null;
      if (dateStr !== "Unknown Date") {
        parsedDate = new Date(dateStr);
        if (isNaN(parsedDate.getTime())) {
          // Try parsing YYYY-MM-DD
          const ymd = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
          if (ymd) {
            parsedDate = new Date(parseInt(ymd[1]), parseInt(ymd[2]) - 1, parseInt(ymd[3]));
          }
        }
      }
      
      // 4. Extract Level
      const levelMatch = content.match(/Level:\s*([^<.]+?)(?:\.|\s*Focus)/i);
      let level = levelMatch ? levelMatch[1].trim() : "";
      
      // 5. Extract Focus
      const focusMatch = content.match(/Focus:\s*([^<.]+)/i);
      const focus = focusMatch ? focusMatch[1].trim() : "";
      
      // 6. Extract Tags
      const tags: string[] = [];
      const tagRegex = /<span class="(?:tag|warning-pill)">([^<]+)<\/span>/g;
      let tagMatch;
      while ((tagMatch = tagRegex.exec(content)) !== null) {
        const val = tagMatch[1].trim();
        // Skip tags that match level information to keep them distinct
        if (!val.toLowerCase().includes("beginner") && !val.toLowerCase().includes("intermediate")) {
          tags.push(val);
        } else if (!level) {
          level = val;
        }
      }
      
      // If Level wasn't found in metadata, check for tags or assign default
      if (!level) {
        level = "beginner to lower-intermediate";
      }
      
      // Fallback tags from focus if none explicitly defined
      if (tags.length === 0 && focus) {
        const generatedTags = focus
          .split(/,|\band\b/)
          .map(t => t.trim())
          .filter(t => t.length > 0 && t.length < 30);
        tags.push(...generatedTags);
      }
      
      lessons.push({
        filename: file,
        title,
        topic,
        date: dateStr,
        parsedDate,
        level,
        focus,
        tags
      });
      
      // Extract vocabularies from lesson content
      const lessonVocabs = extractVocabulary(content, file, topic);
      vocabularies.push(...lessonVocabs);
      
      console.log(`Parsed successfully: ${file} ("${topic}") - found ${lessonVocabs.length} vocab words`);
    } catch (err) {
      console.error(`Error parsing file ${file}:`, err);
    }
  }
  
  // Sort lessons: Newest date first, then alphabetical
  lessons.sort((a, b) => {
    if (a.parsedDate && b.parsedDate) {
      return b.parsedDate.getTime() - a.parsedDate.getTime();
    }
    if (a.parsedDate) return -1;
    if (b.parsedDate) return 1;
    return a.topic.localeCompare(b.topic);
  });
  
  console.log(`Extracted ${vocabularies.length} total vocabulary items across all lessons.`);
  
  // Generate the index.html contents
  const dashboardHtml = generateDashboardHtml(lessons, vocabularies);
  
  await Bun.write("index.html", dashboardHtml);
  console.log(`\nSuccessfully compiled dashboard. index.html updated with ${lessons.length} lessons.`);
}

function generateDashboardHtml(lessons: LessonMetadata[], vocabBank: any[]): string {
  const allTags = Array.from(new Set(lessons.flatMap(l => l.tags))).sort();
  
  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>日本語 Hub - Japanese Learning Dashboard</title>
  
  <!-- SEO & Icons -->
  <meta name="description" content="Interactive dashboard to track and study Japanese vocabulary, grammar, and natural phrasing lessons.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  
  <style>
    /* Premium CSS Design System */
    :root[data-theme="light"] {
      --bg: #f8fafc;
      --card: #ffffff;
      --card-hover: #ffffff;
      --border: rgba(226, 232, 240, 0.8);
      --border-hover: rgba(15, 118, 110, 0.4);
      --text: #0f172a;
      --text-muted: #64748b;
      --primary: #0f766e;
      --primary-rgb: 15, 118, 110;
      --accent: #14b8a6;
      --accent-soft: #f0fdfa;
      --badge-completed: #10b981;
      --badge-completed-soft: #ecfdf5;
      --badge-progress: #3b82f6;
      --badge-progress-soft: #eff6ff;
      --badge-unstarted: #94a3b8;
      --badge-unstarted-soft: #f8fafc;
      --glass-bg: rgba(255, 255, 255, 0.7);
      --glass-border: rgba(226, 232, 240, 0.6);
      --shadow: 0 4px 20px -2px rgba(148, 163, 184, 0.12), 0 2px 8px -1px rgba(148, 163, 184, 0.08);
      --shadow-hover: 0 20px 25px -5px rgba(15, 118, 110, 0.08), 0 8px 10px -6px rgba(15, 118, 110, 0.04);
    }
    
    :root[data-theme="dark"] {
      --bg: #0b0f19;
      --card: #121826;
      --card-hover: #161e30;
      --border: rgba(255, 255, 255, 0.06);
      --border-hover: rgba(20, 184, 166, 0.3);
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #14b8a6;
      --primary-rgb: 20, 184, 166;
      --accent: #2dd4bf;
      --accent-soft: rgba(20, 184, 166, 0.1);
      --badge-completed: #34d399;
      --badge-completed-soft: rgba(52, 211, 153, 0.1);
      --badge-progress: #60a5fa;
      --badge-progress-soft: rgba(96, 165, 250, 0.1);
      --badge-unstarted: #64748b;
      --badge-unstarted-soft: rgba(100, 116, 139, 0.1);
      --glass-bg: rgba(18, 24, 38, 0.85);
      --glass-border: rgba(255, 255, 255, 0.05);
      --shadow: 0 4px 24px -2px rgba(0, 0, 0, 0.3), 0 2px 10px -1px rgba(0, 0, 0, 0.2);
      --shadow-hover: 0 20px 25px -5px rgba(20, 184, 166, 0.12), 0 8px 10px -6px rgba(20, 184, 166, 0.06);
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      line-height: 1.5;
      padding-bottom: 80px;
      transition: background-color 0.4s ease, color 0.4s ease;
    }
    
    /* Header & Navigation */
    header {
      position: sticky;
      top: 0;
      z-index: 100;
      background: var(--glass-bg);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--glass-border);
      padding: 16px 24px;
      transition: background-color 0.4s ease, border-color 0.4s ease;
    }
    
    .nav-container {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .logo {
      font-family: 'Outfit', sans-serif;
      font-size: 1.6rem;
      font-weight: 800;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
    }
    
    .logo span {
      background: linear-gradient(135deg, var(--primary), var(--accent));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    
    .nav-actions {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    
    .theme-toggle {
      background: transparent;
      border: 1px solid var(--border);
      border-radius: 50%;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: var(--text);
      transition: all 0.2s ease;
    }
    
    .theme-toggle:hover {
      border-color: var(--primary);
      background: var(--accent-soft);
    }
    
    /* Hero Section */
    .hero {
      max-width: 1200px;
      margin: 40px auto 30px;
      padding: 0 24px;
    }
    
    .hero h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 2.8rem;
      font-weight: 800;
      line-height: 1.2;
      margin-bottom: 12px;
    }
    
    .hero p {
      color: var(--text-muted);
      font-size: 1.15rem;
      max-width: 600px;
    }
    
    /* Stats Panel */
    .stats-panel {
      max-width: 1200px;
      margin: 0 auto 40px;
      padding: 0 24px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
    }
    
    .stat-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 20px;
      box-shadow: var(--shadow);
      display: flex;
      flex-direction: column;
      gap: 8px;
      position: relative;
      overflow: hidden;
      transition: all 0.3s ease;
    }
    
    .stat-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 4px;
      height: 100%;
      background: linear-gradient(to bottom, var(--primary), var(--accent));
    }
    
    .stat-label {
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .stat-value {
      font-family: 'Outfit', sans-serif;
      font-size: 2.2rem;
      font-weight: 700;
    }
    
    .progress-bar-container {
      width: 100%;
      height: 8px;
      background: var(--border);
      border-radius: 999px;
      margin-top: 8px;
      overflow: hidden;
    }
    
    .progress-bar {
      height: 100%;
      background: linear-gradient(90deg, var(--primary), var(--accent));
      border-radius: 999px;
      width: 0%;
      transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    /* Main Layout Grid */
    .main-content {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 24px;
      display: grid;
      grid-template-columns: 280px 1fr;
      gap: 32px;
    }
    
    /* Sidebar Filter Section */
    .sidebar {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    
    .filter-widget {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 20px;
      box-shadow: var(--shadow);
    }
    
    .filter-title {
      font-family: 'Outfit', sans-serif;
      font-size: 1.1rem;
      font-weight: 600;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .filter-clear {
      font-size: 0.8rem;
      color: var(--primary);
      text-decoration: none;
      cursor: pointer;
      font-weight: 500;
    }
    
    .filter-clear:hover {
      text-decoration: underline;
    }
    
    .search-wrapper {
      position: relative;
    }
    
    .search-input {
      width: 100%;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px 16px 12px 40px;
      color: var(--text);
      font-family: inherit;
      font-size: 0.95rem;
      transition: all 0.2s ease;
    }
    
    .search-input:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.15);
    }
    
    .search-icon {
      position: absolute;
      left: 14px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
      pointer-events: none;
      width: 16px;
      height: 16px;
    }
    
    .status-filters {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .status-btn {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid transparent;
      background: transparent;
      color: var(--text);
      cursor: pointer;
      text-align: left;
      font-family: inherit;
      font-size: 0.9rem;
      transition: all 0.2s ease;
    }
    
    .status-btn:hover {
      background: var(--border);
    }
    
    .status-btn.active {
      background: var(--accent-soft);
      border-color: rgba(var(--primary-rgb), 0.2);
      font-weight: 500;
    }
    
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
      margin-right: 8px;
    }
    
    .status-dot.completed { background-color: var(--badge-completed); }
    .status-dot.progress { background-color: var(--badge-progress); }
    .status-dot.unstarted { background-color: var(--badge-unstarted); }
    
    .count-badge {
      font-size: 0.8rem;
      padding: 2px 6px;
      border-radius: 6px;
      background: var(--border);
      color: var(--text-muted);
    }
    
    .tag-cloud {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    
    .tag-pill {
      font-size: 0.8rem;
      padding: 6px 12px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .tag-pill:hover {
      border-color: var(--primary);
      color: var(--text);
    }
    
    .tag-pill.active {
      background: linear-gradient(135deg, var(--primary), var(--accent));
      border-color: transparent;
      color: white;
      font-weight: 500;
      box-shadow: 0 4px 10px -2px rgba(var(--primary-rgb), 0.3);
    }
    
    /* Lesson Cards Grid */
    .lessons-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    
    .lessons-header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    
    .lessons-count {
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--text);
    }
    
    .sort-select {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 8px 12px;
      color: var(--text);
      font-family: inherit;
      font-size: 0.85rem;
      cursor: pointer;
      outline: none;
    }
    
    .sort-select:focus {
      border-color: var(--primary);
    }
    
    .lesson-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 20px;
    }
    
    .lesson-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 24px;
      box-shadow: var(--shadow);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 16px;
      transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
      position: relative;
      text-decoration: none;
      color: inherit;
    }
    
    .lesson-card:hover {
      transform: translateY(-4px);
      border-color: var(--border-hover);
      box-shadow: var(--shadow-hover);
    }
    
    .card-top {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    
    .card-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.85rem;
      color: var(--text-muted);
    }
    
    .lesson-date {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .lesson-level {
      font-weight: 500;
      text-transform: capitalize;
    }
    
    .lesson-topic {
      font-family: 'Outfit', sans-serif;
      font-size: 1.35rem;
      font-weight: 700;
      line-height: 1.3;
      margin-top: 4px;
      color: var(--text);
      transition: color 0.2s ease;
    }
    
    .lesson-card:hover .lesson-topic {
      color: var(--primary);
    }
    
    .lesson-focus {
      font-size: 0.9rem;
      color: var(--text-muted);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      margin-top: 4px;
    }
    
    .card-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }
    
    .card-tag {
      font-size: 0.75rem;
      padding: 3px 8px;
      border-radius: 999px;
      background: var(--accent-soft);
      color: var(--primary);
      border: 1px solid rgba(var(--primary-rgb), 0.08);
    }
    
    .card-footer {
      border-top: 1px solid var(--border);
      padding-top: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: relative;
      z-index: 10;
    }
    
    .status-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.8rem;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .status-badge.completed {
      background: var(--badge-completed-soft);
      color: var(--badge-completed);
    }
    
    .status-badge.progress {
      background: var(--badge-progress-soft);
      color: var(--badge-progress);
    }
    
    .status-badge.unstarted {
      background: var(--badge-unstarted-soft);
      color: var(--badge-unstarted);
    }
    
    .status-selector {
      position: absolute;
      bottom: 48px;
      left: 0;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      padding: 6px;
      display: none;
      flex-direction: column;
      gap: 4px;
      z-index: 50;
      min-width: 140px;
    }
    
    .status-selector.open {
      display: flex;
    }
    
    .status-option {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.85rem;
      background: transparent;
      border: none;
      color: var(--text);
      text-align: left;
      font-family: inherit;
      transition: background-color 0.2s ease;
    }
    
    .status-option:hover {
      background: var(--border);
    }
    
    .study-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      background: linear-gradient(135deg, var(--primary), var(--accent));
      color: white;
      text-decoration: none;
      padding: 8px 14px;
      border-radius: 10px;
      font-size: 0.85rem;
      font-weight: 600;
      box-shadow: 0 4px 12px -2px rgba(var(--primary-rgb), 0.2);
      transition: all 0.2s ease;
    }
    
    .study-btn:hover {
      box-shadow: 0 6px 16px -2px rgba(var(--primary-rgb), 0.3);
      opacity: 0.95;
    }
    
    /* Empty State */
    .empty-state {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 48px;
      text-align: center;
      box-shadow: var(--shadow);
      display: none;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
    
    .empty-state.visible {
      display: flex;
    }
    
    .empty-state h3 {
      font-family: 'Outfit', sans-serif;
      font-size: 1.4rem;
      font-weight: 600;
    }
    
    .empty-state p {
      color: var(--text-muted);
      max-width: 400px;
    }
    
    /* Responsive Queries */
    @media (max-width: 900px) {
      .main-content {
        grid-template-columns: 1fr;
      }
      
      .sidebar {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 16px;
      }
    }
    
    @media (max-width: 600px) {
      .hero h1 {
        font-size: 2.2rem;
      }
      
      .sidebar {
        grid-template-columns: 1fr;
      }
      
      .lesson-grid {
        grid-template-columns: 1fr;
      }
    }
    
    /* SRS stat card hover */
    #srsCard:hover {
      transform: translateY(-4px);
      border-color: var(--primary);
      box-shadow: var(--shadow-hover);
    }
    
    /* SRS Modal Overlay */
    .srs-modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(11, 15, 25, 0.65);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      z-index: 1000;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.35s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .srs-modal-backdrop.active {
      opacity: 1;
      pointer-events: auto;
    }
    .srs-modal-content {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 24px;
      width: 90%;
      max-width: 480px;
      padding: 28px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.3);
      display: flex;
      flex-direction: column;
      gap: 20px;
      position: relative;
      z-index: 1010;
      transform: translateY(20px) scale(0.95);
      transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .srs-modal-backdrop.active .srs-modal-content {
      transform: translateY(0) scale(1);
    }
    
    /* Progress Bar */
    .srs-progress-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.85rem;
      color: var(--text-muted);
    }
    .srs-progress-track {
      width: 100%;
      height: 6px;
      background: var(--border);
      border-radius: 3px;
      overflow: hidden;
      margin-top: 6px;
    }
    .srs-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--primary), var(--accent));
      width: 0%;
      transition: width 0.3s ease;
    }
    
    /* Close Button */
    .srs-close-btn {
      background: transparent;
      border: none;
      cursor: pointer;
      color: var(--text-muted);
      padding: 6px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }
    .srs-close-btn:hover {
      background: var(--border);
      color: var(--text);
    }
    
    /* 3D Flashcard Container */
    .flashcard-container {
      perspective: 1000px;
      width: 100%;
      height: 240px;
      cursor: pointer;
    }
    .flashcard-inner {
      width: 100%;
      height: 100%;
      position: relative;
      transform-style: preserve-3d;
      transition: transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .flashcard-container.flipped .flashcard-inner {
      transform: rotateY(180deg);
    }
    .flashcard-front, .flashcard-back {
      position: absolute;
      width: 100%;
      height: 100%;
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
      border-radius: 20px;
      border: 1px solid var(--border);
      padding: 24px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-sizing: border-box;
    }
    .flashcard-front {
      background: linear-gradient(135deg, var(--card), var(--card-hover));
      color: var(--text);
    }
    .flashcard-back {
      background: linear-gradient(135deg, var(--card-hover), var(--card));
      color: var(--text);
      transform: rotateY(180deg);
    }
    
    /* Card Content details */
    .card-tag-badge {
      align-self: flex-start;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 4px 8px;
      border-radius: 6px;
      background: var(--accent-soft);
      color: var(--primary);
    }
    .card-vocab-text {
      font-family: 'Outfit', sans-serif;
      font-size: 2.2rem;
      font-weight: 700;
      text-align: center;
      margin: auto 0;
    }
    .card-prompt-text {
      text-align: center;
      font-size: 0.8rem;
      color: var(--text-muted);
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    
    /* Back side details */
    .card-reading-text {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--primary);
      text-align: center;
    }
    .card-meaning-text {
      font-size: 1.4rem;
      font-weight: 700;
      text-align: center;
      margin: 10px 0;
    }
    
    /* Card play btn */
    .card-speak-btn {
      background: var(--accent-soft);
      color: var(--primary);
      border: none;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      position: absolute;
      top: 16px;
      right: 16px;
      z-index: 5;
      transition: transform 0.2s, background-color 0.2s;
    }
    .card-speak-btn:hover {
      transform: scale(1.1);
      background: var(--border);
    }
    
    /* Rating Buttons bar */
    .rating-bar {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      width: 100%;
    }
    .rating-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 10px 4px;
      border-radius: 12px;
      border: 1px solid var(--border);
      background: var(--card);
      cursor: pointer;
      font-family: inherit;
      transition: all 0.2s ease;
    }
    .rating-btn:hover {
      transform: translateY(-2px);
    }
    .rating-score {
      font-size: 1rem;
      font-weight: 700;
    }
    .rating-label {
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--text-muted);
    }
    
    /* Specific rating colors */
    .rating-btn[data-rating="0"] { border-color: rgba(239, 68, 68, 0.4); }
    .rating-btn[data-rating="0"]:hover { background: rgba(239, 68, 68, 0.1); }
    .rating-btn[data-rating="3"] { border-color: rgba(245, 158, 11, 0.4); }
    .rating-btn[data-rating="3"]:hover { background: rgba(245, 158, 11, 0.1); }
    .rating-btn[data-rating="4"] { border-color: rgba(59, 130, 246, 0.4); }
    .rating-btn[data-rating="4"]:hover { background: rgba(59, 130, 246, 0.1); }
    .rating-btn[data-rating="5"] { border-color: rgba(16, 185, 129, 0.4); }
    .rating-btn[data-rating="5"]:hover { background: rgba(16, 185, 129, 0.1); }
    
    /* Reveal Answer Button styling */
    .reveal-btn-container {
      width: 100%;
    }
    .reveal-action-btn {
      width: 100%;
      background: linear-gradient(135deg, var(--primary), var(--accent));
      color: white;
      border: none;
      border-radius: 12px;
      padding: 12px;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .reveal-action-btn:hover {
      opacity: 0.95;
    }
    
    /* Congratulation screen */
    .srs-finished-screen {
      display: none;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 16px;
      padding: 20px 0;
    }
    .srs-finished-screen h4 {
      font-family: 'Outfit', sans-serif;
      font-size: 1.6rem;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .srs-finished-screen p {
      color: var(--text-muted);
      max-width: 320px;
      font-size: 0.95rem;
    }
    .finished-btn {
      background: linear-gradient(135deg, var(--primary), var(--accent));
      color: white;
      border: none;
      border-radius: 12px;
      padding: 12px 24px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
      margin-top: 10px;
    }
    .finished-btn:hover {
      opacity: 0.95;
    }
  </style>
  <style>
</head>
<body>
  
  <header>
    <div class="nav-container">
      <a href="#" class="logo">
        <span>日本語 Hub</span>
      </a>
      <div class="nav-actions">
        <button class="theme-toggle" id="themeToggle" title="Toggle Theme" aria-label="Toggle Theme">
          <!-- Sun Icon -->
          <svg id="sunIcon" style="display:none;" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="M4.93 4.93l1.41 1.41"></path><path d="M17.66 17.66l1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="M6.34 17.66l-1.41 1.41"></path><path d="M19.07 4.93l-1.41 1.41"></path></svg>
          <!-- Moon Icon -->
          <svg id="moonIcon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg>
        </button>
      </div>
    </div>
  </header>
  
  <main>
    <section class="hero">
      <h1>Japanese Study Hub</h1>
      <p>Master vocabulary, grammar, and natural speaking nuances using interactive study sessions. Track your progress below.</p>
    </section>
    
    <section class="stats-panel">
      <div class="stat-card">
        <span class="stat-label">Total Lessons</span>
        <span class="stat-value" id="statTotal">0</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Lessons Completed</span>
        <span class="stat-value" id="statCompleted">0</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Overall Progress</span>
        <span class="stat-value" id="statPercent">0%</span>
        <div class="progress-bar-container">
          <div class="progress-bar" id="progressBar"></div>
        </div>
      </div>
      <div class="stat-card" id="srsCard" style="cursor: pointer; transition: all 0.3s ease;" onclick="openSrsSession()">
        <span class="stat-label">SRS Review Due</span>
        <span class="stat-value" id="srsDueCount">0</span>
        <span class="stat-label" id="srsActionText" style="color: var(--primary); font-size: 0.8rem; font-weight: 700; margin-top: 4px; display: flex; align-items: center; gap: 4px;">
          Start Review
          <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
        </span>
      </div>
    </section>
    
    <div class="main-content">
      
      <!-- Filters Sidebar -->
      <aside class="sidebar">
        
        <div class="filter-widget">
          <div class="filter-title">
            <span>Search Lessons</span>
          </div>
          <div class="search-wrapper">
            <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" id="searchInput" class="search-input" placeholder="Search title, level, focus...">
          </div>
        </div>
        
        <div class="filter-widget">
          <div class="filter-title">
            <span>Status Filter</span>
            <span class="filter-clear" onclick="clearStatusFilter()" id="clearStatusBtn" style="display:none;">Clear</span>
          </div>
          <div class="status-filters">
            <button class="status-btn" onclick="toggleStatusFilter('completed')" id="btnCompleted">
              <span><span class="status-dot completed"></span>Completed</span>
              <span class="count-badge" id="countCompleted">0</span>
            </button>
            <button class="status-btn" onclick="toggleStatusFilter('progress')" id="btnProgress">
              <span><span class="status-dot progress"></span>In Progress</span>
              <span class="count-badge" id="countProgress">0</span>
            </button>
            <button class="status-btn" onclick="toggleStatusFilter('unstarted')" id="btnUnstarted">
              <span><span class="status-dot unstarted"></span>Not Started</span>
              <span class="count-badge" id="countUnstarted">0</span>
            </button>
          </div>
        </div>
        
        <div class="filter-widget">
          <div class="filter-title">
            <span>Categories</span>
            <span class="filter-clear" onclick="clearTagFilter()" id="clearTagBtn" style="display:none;">Clear</span>
          </div>
          <div class="tag-cloud">
            ${allTags.map(tag => `<button class="tag-pill" onclick="toggleTagFilter('${tag}')" data-tag="${tag}">${tag}</button>`).join('\n            ')}
          </div>
        </div>
        
      </aside>
      
      <!-- Lessons Grid Container -->
      <section class="lessons-container">
        
        <div class="lessons-header-bar">
          <span class="lessons-count" id="lessonsCount">Showing ${lessons.length} lessons</span>
          <select id="sortSelect" class="sort-select" onchange="sortLessons()">
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="alphabetical">Alphabetical</option>
          </select>
        </div>
        
        <div class="lesson-grid" id="lessonGrid">
          <!-- Lesson cards injected by JS -->
        </div>
        
        <!-- Empty State -->
        <div class="empty-state" id="emptyState">
          <h3>No lessons found</h3>
          <p>Try refining your search query or removing some filters to see matching lessons.</p>
        </div>
        
      </section>
      
    </div>
  </main>
  
  <!-- SRS Flashcard Modal -->
  <div class="srs-modal-backdrop" id="srsModal">
    <div class="srs-modal-content">
      <!-- Active Card Session -->
      <div id="srsPracticeScreen" style="display: flex; flex-direction: column; gap: 20px; width: 100%;">
        <div class="srs-progress-header">
          <span id="srsProgressText">Card 1 of 1</span>
          <button class="srs-close-btn" onclick="closeSrsSession()" title="Exit reviews">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="srs-progress-track">
          <div class="srs-progress-fill" id="srsProgressFill"></div>
        </div>
        
        <!-- 3D Card Container -->
        <div class="flashcard-container" id="srsFlashcard" onclick="flipCard()">
          <div class="flashcard-inner">
            <!-- Front -->
            <div class="flashcard-front">
              <button class="card-speak-btn" onclick="speakSrsCard(event)" title="Listen">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
              </button>
              <span class="card-tag-badge" id="cardLessonTitle">Lesson</span>
              <div class="card-vocab-text" id="cardKanji">漢字</div>
              <div class="card-prompt-text">Reveal Answer</div>
            </div>
            <!-- Back -->
            <div class="flashcard-back">
              <button class="card-speak-btn" onclick="speakSrsCard(event)" title="Listen">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
              </button>
              <div class="card-reading-text" id="cardReading">かな</div>
              <div class="card-meaning-text" id="cardMeaning">Meaning</div>
              <div class="card-prompt-text">Rate recall below</div>
            </div>
          </div>
        </div>
        
        <!-- Reveal/Flips controls -->
        <div class="reveal-btn-container" id="srsRevealBtn">
          <button class="reveal-action-btn" onclick="flipCard()">Reveal Answer</button>
        </div>
        
        <!-- Rating controls (shown when card is flipped) -->
        <div class="rating-bar" id="srsRatingBar" style="display: none;">
          <button class="rating-btn" data-rating="0" onclick="rateCard(0)">
            <span class="rating-score">0</span>
            <span class="rating-label">Forgot</span>
          </button>
          <button class="rating-btn" data-rating="3" onclick="rateCard(3)">
            <span class="rating-score">3</span>
            <span class="rating-label">Hard</span>
          </button>
          <button class="rating-btn" data-rating="4" onclick="rateCard(4)">
            <span class="rating-score">4</span>
            <span class="rating-label">Good</span>
          </button>
          <button class="rating-btn" data-rating="5" onclick="rateCard(5)">
            <span class="rating-score">5</span>
            <span class="rating-label">Easy</span>
          </button>
        </div>
      </div>
      
      <!-- Finished Session Screen -->
      <div id="srsFinishedScreen" class="srs-finished-screen">
        <div style="font-size: 3rem;">🎉</div>
        <h4>Session Complete!</h4>
        <p id="reviewedCountText">You reviewed X cards.</p>
        <p>Keep up the great work! Your vocabulary schedule has been updated.</p>
        <button class="finished-btn" onclick="closeSrsSession()">Back to Dashboard</button>
      </div>
    </div>
  </div>
  
  <script>
    // Embedded Data from Server Scan
    const LESSONS = ${JSON.stringify(lessons)};
    const VOCAB_BANK = ${JSON.stringify(vocabBank)};
    
    // UI State Management
    let userProgress = {}; // filename -> 'unstarted' | 'progress' | 'completed'
    let activeTag = null;
    let activeStatus = null;
    let searchQuery = '';
    
    // SRS State Management
    let srsProgress = {}; // vocabId -> { interval, repetition, efactor, nextReviewDate, lastReviewed }
    let currentSrsQueue = [];
    let currentSrsIndex = 0;
    
    // Load SRS State
    function loadSrsProgress() {
      const saved = localStorage.getItem('japanese-srs-progress');
      if (saved) {
        try {
          srsProgress = JSON.parse(saved);
        } catch (e) {
          srsProgress = {};
        }
      }
    }
    
    // Get due flashcards based on SM-2 algorithm
    function getDueCards() {
      const today = new Date();
      today.setHours(0,0,0,0);
      
      return VOCAB_BANK.filter(vocab => {
        const state = srsProgress[vocab.id];
        // If card has never been reviewed, it is new and due!
        if (!state) return true;
        
        const nextReview = new Date(state.nextReviewDate);
        nextReview.setHours(0,0,0,0);
        return nextReview.getTime() <= today.getTime();
      });
    }
    
    // SM-2 Spaced Repetition Algorithm
    function scheduleSrsCard(vocabId, score) {
      let state = srsProgress[vocabId];
      if (!state) {
        state = {
          interval: 0,
          repetition: 0,
          efactor: 2.5,
          nextReviewDate: new Date().toISOString(),
          lastReviewed: new Date().toISOString()
        };
      }
      
      let { interval, repetition, efactor } = state;
      
      // Efactor update based on SM-2 recall rating
      efactor = efactor + (0.1 - (5 - score) * (0.08 + (5 - score) * 0.02));
      if (efactor < 1.3) efactor = 1.3;
      
      if (score < 3) {
        // Forgot vocabulary: reset repetitions and schedule for tomorrow
        repetition = 0;
        interval = 1;
      } else {
        // Correct response
        if (repetition === 0) {
          interval = 1;
        } else if (repetition === 1) {
          interval = 4; // 4 days instead of 6 to encourage earlier reinforcement
        } else {
          interval = Math.round(interval * efactor);
        }
        repetition++;
      }
      
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + interval);
      nextDate.setHours(0,0,0,0);
      
      srsProgress[vocabId] = {
        interval,
        repetition,
        efactor,
        nextReviewDate: nextDate.toISOString(),
        lastReviewed: new Date().toISOString()
      };
      
      localStorage.setItem('japanese-srs-progress', JSON.stringify(srsProgress));
    }
    
    // Get Lesson Status Helper
    function getLessonStatus(filename) {
      return userProgress[filename] || 'unstarted';
    }
    
    // Elements
    const themeToggle = document.getElementById('themeToggle');
    const sunIcon = document.getElementById('sunIcon');
    const moonIcon = document.getElementById('moonIcon');
    const searchInput = document.getElementById('searchInput');
    const lessonGrid = document.getElementById('lessonGrid');
    const emptyState = document.getElementById('emptyState');
    const lessonsCount = document.getElementById('lessonsCount');
    const sortSelect = document.getElementById('sortSelect');
    
    // Stats elements
    const statTotal = document.getElementById('statTotal');
    const statCompleted = document.getElementById('statCompleted');
    const statPercent = document.getElementById('statPercent');
    const progressBar = document.getElementById('progressBar');
    const countCompleted = document.getElementById('countCompleted');
    const countProgress = document.getElementById('countProgress');
    const countUnstarted = document.getElementById('countUnstarted');
    const clearTagBtn = document.getElementById('clearTagBtn');
    const clearStatusBtn = document.getElementById('clearStatusBtn');
    
    // SRS Elements
    const srsModal = document.getElementById('srsModal');
    const srsDueCount = document.getElementById('srsDueCount');
    const srsActionText = document.getElementById('srsActionText');
    const srsPracticeScreen = document.getElementById('srsPracticeScreen');
    const srsFinishedScreen = document.getElementById('srsFinishedScreen');
    
    // Update SRS card due count
    function updateSrsCardStats() {
      loadSrsProgress();
      const due = getDueCards();
      srsDueCount.textContent = due.length;
      if (due.length > 0) {
        srsActionText.innerHTML = 'Start Review <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>';
      } else {
        srsActionText.textContent = "All Done! 🎉";
      }
    }
    
    // Open review modal and load queue
    function openSrsSession() {
      loadSrsProgress();
      currentSrsQueue = getDueCards();
      
      // Shuffle the queue to randomize words
      currentSrsQueue.sort(() => Math.random() - 0.5);
      
      currentSrsIndex = 0;
      
      if (currentSrsQueue.length === 0) {
        alert("You have no cards due for review today!");
        return;
      }
      
      srsFinishedScreen.style.display = 'none';
      srsPracticeScreen.style.display = 'flex';
      srsModal.classList.add('active');
      
      renderCurrentCard();
    }
    
    // Close review modal
    function closeSrsSession() {
      srsModal.classList.remove('active');
      updateSrsCardStats();
    }
    
    // Render vocabulary on the active card
    function renderCurrentCard() {
      const card = currentSrsQueue[currentSrsIndex];
      
      // Update progress bar
      document.getElementById('srsProgressText').textContent = 'Card ' + (currentSrsIndex + 1) + ' of ' + currentSrsQueue.length;
      document.getElementById('srsProgressFill').style.width = ((currentSrsIndex / currentSrsQueue.length) * 100) + '%';
      
      // Inject Card Contents
      document.getElementById('cardKanji').textContent = card.kanji;
      document.getElementById('cardReading').textContent = card.reading;
      document.getElementById('cardMeaning').textContent = card.meaning;
      document.getElementById('cardLessonTitle').textContent = card.lessonTitle;
      
      // Reset card flip and buttons visibility
      document.getElementById('srsFlashcard').classList.remove('flipped');
      document.getElementById('srsRevealBtn').style.display = 'block';
      document.getElementById('srsRatingBar').style.display = 'none';
    }
    
    // Flip Card logic
    function flipCard(event) {
      if (event) {
        event.stopPropagation();
      }
      const flashcard = document.getElementById('srsFlashcard');
      const isFlipped = flashcard.classList.toggle('flipped');
      
      if (isFlipped) {
        document.getElementById('srsRevealBtn').style.display = 'none';
        document.getElementById('srsRatingBar').style.display = 'grid';
      } else {
        document.getElementById('srsRevealBtn').style.display = 'block';
        document.getElementById('srsRatingBar').style.display = 'none';
      }
    }
    
    // Speak vocabulary utilizing Web Speech Synthesis ja-JP
    function speakSrsCard(event) {
      if (event) {
        event.stopPropagation();
        event.preventDefault();
      }
      const card = currentSrsQueue[currentSrsIndex];
      if (!window.speechSynthesis) return;
      
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(card.kanji);
      utterance.lang = 'ja-JP';
      
      const voices = window.speechSynthesis.getVoices();
      const jaVoice = voices.find(v => v.lang === 'ja-JP' || v.lang.startsWith('ja'));
      if (jaVoice) {
        utterance.voice = jaVoice;
      }
      
      window.speechSynthesis.speak(utterance);
    }
    
    // Submit recall rating
    function rateCard(score) {
      const card = currentSrsQueue[currentSrsIndex];
      scheduleSrsCard(card.id, score);
      
      currentSrsIndex++;
      if (currentSrsIndex < currentSrsQueue.length) {
        setTimeout(renderCurrentCard, 200);
      } else {
        document.getElementById('srsProgressFill').style.width = '100%';
        setTimeout(showFinishedScreen, 300);
      }
    }
    
    // Show finished summary screen
    function showFinishedScreen() {
      srsPracticeScreen.style.display = 'none';
      srsFinishedScreen.style.display = 'flex';
      document.getElementById('reviewedCountText').textContent = 'You reviewed ' + currentSrsQueue.length + ' vocabulary items.';
      updateSrsCardStats();
    }
    
    // Initialize LocalStorage and UI
    function init() {
      // Parse serialized date strings back to Date objects
      LESSONS.forEach(l => {
        if (l.parsedDate && typeof l.parsedDate === 'string') {
          l.parsedDate = new Date(l.parsedDate);
        }
      });

      // 1. Theme Configuration
      const savedTheme = localStorage.getItem('theme') || 'dark';
      setTheme(savedTheme);
      
      themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setTheme(nextTheme);
      });
      
      // 2. Load Progress
      const savedProgress = localStorage.getItem('japanese-lessons-progress');
      if (savedProgress) {
        try {
          userProgress = JSON.parse(savedProgress);
        } catch (e) {
          userProgress = {};
        }
      }
      
      // Initialize missing states to 'unstarted'
      LESSONS.forEach(l => {
        if (!userProgress[l.filename]) {
          userProgress[l.filename] = 'unstarted';
        }
      });
      
      // 3. Search events
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        render();
      });
      
      // Prefetch synthesis voices
      if (window.speechSynthesis) {
        window.speechSynthesis.getVoices();
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
          window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
        }
      }
      
      // Initial render & stats calculation
      updateStats();
      updateSrsCardStats();
      render();
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
    
    // Theme Handler
    function setTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
      if (theme === 'dark') {
        sunIcon.style.display = 'block';
        moonIcon.style.display = 'none';
      } else {
        sunIcon.style.display = 'none';
        moonIcon.style.display = 'block';
      }
    }
    
    // Update dashboard statistics
    function updateStats() {
      const total = LESSONS.length;
      let completedCount = 0;
      let progressCount = 0;
      let unstartedCount = 0;
      
      LESSONS.forEach(l => {
        const state = getLessonStatus(l.filename);
        if (state === 'completed') completedCount++;
        else if (state === 'progress') progressCount++;
        else unstartedCount++;
      });
      
      statTotal.textContent = total;
      statCompleted.textContent = completedCount;
      
      const percent = total > 0 ? Math.round((completedCount / total) * 100) : 0;
      statPercent.textContent = percent + '%';
      progressBar.style.width = percent + '%';
      
      countCompleted.textContent = completedCount;
      countProgress.textContent = progressCount;
      countUnstarted.textContent = unstartedCount;
    }
    
    // Set Lesson Progress State
    function setLessonStatus(filename, status, event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      
      userProgress[filename] = status;
      localStorage.setItem('japanese-lessons-progress', JSON.stringify(userProgress));
      
      // Close dropdown
      const selector = document.getElementById('select-' + filename.replace(/[^a-zA-Z0-9]/g, ''));
      if (selector) selector.classList.remove('open');
      
      updateStats();
      render();
    }
    
    // Toggle selector dropdown
    function toggleSelector(filename, event) {
      event.preventDefault();
      event.stopPropagation();
      
      const safeId = filename.replace(/[^a-zA-Z0-9]/g, '');
      const currentOpen = document.querySelector('.status-selector.open');
      const targetSelector = document.getElementById('select-' + safeId);
      
      if (currentOpen && currentOpen !== targetSelector) {
        currentOpen.classList.remove('open');
      }
      
      if (targetSelector) {
        targetSelector.classList.toggle('open');
      }
      
      // Close dropdown when clicking outside
      const closeHandler = (e) => {
        if (!targetSelector.contains(e.target) && !e.target.closest('.status-badge')) {
          targetSelector.classList.remove('open');
          document.removeEventListener('click', closeHandler);
        }
      };
      
      document.addEventListener('click', closeHandler);
    }
    
    // Toggle tag filters
    function toggleTagFilter(tag) {
      if (activeTag === tag) {
        activeTag = null;
        clearTagFilter();
      } else {
        activeTag = tag;
        clearTagBtn.style.display = 'inline';
        
        // Update styling
        document.querySelectorAll('.tag-pill').forEach(btn => {
          if (btn.getAttribute('data-tag') === tag) {
            btn.classList.add('active');
          } else {
            btn.classList.remove('active');
          }
        });
        render();
      }
    }
    
    function clearTagFilter() {
      activeTag = null;
      clearTagBtn.style.display = 'none';
      document.querySelectorAll('.tag-pill').forEach(btn => btn.classList.remove('active'));
      render();
    }
    
    // Toggle progress filters
    function toggleStatusFilter(status) {
      if (activeStatus === status) {
        clearStatusFilter();
      } else {
        activeStatus = status;
        clearStatusBtn.style.display = 'inline';
        
        // Update styling
        document.getElementById('btnCompleted').classList.toggle('active', status === 'completed');
        document.getElementById('btnProgress').classList.toggle('active', status === 'progress');
        document.getElementById('btnUnstarted').classList.toggle('active', status === 'unstarted');
        render();
      }
    }
    
    function clearStatusFilter() {
      activeStatus = null;
      clearStatusBtn.style.display = 'none';
      document.getElementById('btnCompleted').classList.remove('active');
      document.getElementById('btnProgress').classList.remove('active');
      document.getElementById('btnUnstarted').classList.remove('active');
      render();
    }
    
    function sortLessons() {
      render();
    }
    
    // Render the grid matching active filters
    function render() {
      let filtered = [...LESSONS];
      
      // 1. Tag filtering
      if (activeTag) {
        filtered = filtered.filter(l => l.tags.includes(activeTag));
      }
      
      // 2. Status filtering
      if (activeStatus) {
        filtered = filtered.filter(l => getLessonStatus(l.filename) === activeStatus);
      }
      
      // 3. Search filtering
      if (searchQuery) {
        filtered = filtered.filter(l => 
          l.title.toLowerCase().includes(searchQuery) ||
          l.topic.toLowerCase().includes(searchQuery) ||
          (l.focus || '').toLowerCase().includes(searchQuery) ||
          l.level.toLowerCase().includes(searchQuery) ||
          l.tags.some(t => t.toLowerCase().includes(searchQuery))
        );
      }
      
      // 4. Sorting
      const sortBy = sortSelect.value;
      if (sortBy === 'alphabetical') {
        filtered.sort((a, b) => a.topic.localeCompare(b.topic));
      } else if (sortBy === 'oldest') {
        filtered.sort((a, b) => {
          if (a.parsedDate && b.parsedDate) return a.parsedDate.getTime() - b.parsedDate.getTime();
          if (a.parsedDate) return 1;
          if (b.parsedDate) return -1;
          return a.topic.localeCompare(b.topic);
        });
      } else { // default: 'newest'
        filtered.sort((a, b) => {
          if (a.parsedDate && b.parsedDate) return b.parsedDate.getTime() - a.parsedDate.getTime();
          if (a.parsedDate) return -1;
          if (b.parsedDate) return 1;
          return a.topic.localeCompare(b.topic);
        });
      }
      
      // Update count text
      lessonsCount.textContent = \`Showing \${filtered.length} of \${LESSONS.length} lessons\`;
      
      // Build HTML
      if (filtered.length === 0) {
        lessonGrid.innerHTML = '';
        emptyState.classList.add('visible');
      } else {
        emptyState.classList.remove('visible');
        
        lessonGrid.innerHTML = filtered.map(l => {
          const status = getLessonStatus(l.filename);
          const safeId = l.filename.replace(/[^a-zA-Z0-9]/g, '');
          
          let statusText = 'Not Started';
          let statusIcon = '◯';
          if (status === 'completed') {
            statusText = 'Completed';
            statusIcon = '●';
          } else if (status === 'progress') {
            statusText = 'In Progress';
            statusIcon = '◑';
          }
          
          const tagsHtml = l.tags.map(t => \`<span class="card-tag">\${t}</span>\`).join('');
          
          return \`
            <article class="lesson-card">
              <div class="card-top">
                <div class="card-meta">
                  <span class="lesson-date">
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    \${l.date}
                  </span>
                  <span class="lesson-level">\${l.level}</span>
                </div>
                <h3 class="lesson-topic">\${l.topic}</h3>
                <p class="lesson-focus">\${l.focus || l.title}</p>
                <div class="card-tags">\${tagsHtml}</div>
              </div>
              
              <div class="card-footer">
                <div style="position: relative;">
                  <button class="status-badge \${status}" onclick="toggleSelector('\${l.filename}', event)">
                    <span>\${statusIcon}</span>
                    <span>\${statusText}</span>
                  </button>
                  
                  <div class="status-selector" id="select-\${safeId}">
                    <button class="status-option" onclick="setLessonStatus('\${l.filename}', 'unstarted', event)">
                      <span class="status-dot unstarted"></span> Not Started
                    </button>
                    <button class="status-option" onclick="setLessonStatus('\${l.filename}', 'progress', event)">
                      <span class="status-dot progress"></span> In Progress
                    </button>
                    <button class="status-option" onclick="setLessonStatus('\${l.filename}', 'completed', event)">
                      <span class="status-dot completed"></span> Completed
                    </button>
                  </div>
                </div>
                
                <a href="\${l.filename}" class="study-btn">
                  Study
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                </a>
              </div>
            </article>
          \`;
        }).join('');
      }
    }
  </script>
</body>
</html>`;
}

// Run compilation
buildDashboard().catch(console.error);

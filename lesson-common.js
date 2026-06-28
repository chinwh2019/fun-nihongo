/* ==========================================
   日本語 Hub - Enhanced Lesson Functionality
   ========================================== */

(function() {
  // Global states
  let currentTargetText = '';
  let recognition = null;
  let voiceCoachSheet = null;
  let voiceCoachBackdrop = null;

  // Initialize features once DOM is ready
  function init() {
    // 1. Inject Floating Control Panel
    injectControlPanel();

    // 2. Wrap .jp elements and add speech/TTS triggers
    instrumentJapaneseText();

    // 3. Inject Audio Player if voice lesson is available
    if (window.LESSON_AUDIO) {
      injectAudioPlayer();
    }

    // 4. Load initial Reading Toggle preference
    const hideReadingsPref = localStorage.getItem('japanese-hide-readings') === 'true';
    if (hideReadingsPref) {
      document.body.classList.add('hide-readings');
      updateReadingBtnUI(true);
    }
  }

  // Inject Floating Control Bar (top-right of viewport)
  function injectControlPanel() {
    if (document.getElementById('lesson-control-bar')) return;

    const controlBar = document.createElement('div');
    controlBar.id = 'lesson-control-bar';
    controlBar.className = 'lesson-control-bar';
    controlBar.innerHTML = `
      <!-- Dashboard Link -->
      <a href="../index.html" class="control-btn" data-tooltip="Back to Dashboard">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
      </a>
      <div class="control-divider"></div>
      <!-- Reading Toggle -->
      <button class="control-btn" id="reading-toggle-btn" data-tooltip="Mask Readings">
        <svg id="eye-open-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
        <svg id="eye-closed-icon" style="display:none;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
      </button>
    `;

    document.body.appendChild(controlBar);

    // Bind event
    const readingBtn = document.getElementById('reading-toggle-btn');
    readingBtn.addEventListener('click', toggleReadings);
  }

  // Toggle Readings/Furigana logic
  function toggleReadings() {
    const isCurrentlyHidden = document.body.classList.toggle('hide-readings');
    localStorage.setItem('japanese-hide-readings', isCurrentlyHidden);
    updateReadingBtnUI(isCurrentlyHidden);
  }

  function updateReadingBtnUI(isHidden) {
    const openIcon = document.getElementById('eye-open-icon');
    const closedIcon = document.getElementById('eye-closed-icon');
    const btn = document.getElementById('reading-toggle-btn');
    
    if (isHidden) {
      openIcon.style.display = 'none';
      closedIcon.style.display = 'block';
      btn.setAttribute('data-tooltip', 'Reveal Readings');
    } else {
      openIcon.style.display = 'block';
      closedIcon.style.display = 'none';
      btn.setAttribute('data-tooltip', 'Mask Readings');
    }
  }

  // Instrument Japanese text (.jp elements) with voice and speech features
  function instrumentJapaneseText() {
    const jpElements = document.querySelectorAll('.jp');
    jpElements.forEach(el => {
      // Avoid processing nested elements or already wrapped ones
      if (el.querySelector('.jp-container') || el.classList.contains('jp-container')) return;

      const originalHtml = el.innerHTML;
      el.innerHTML = '';

      // Create the inner container wrapper to keep the parent's block/inline display intact
      const container = document.createElement('span');
      container.className = 'jp-container';

      const textSpan = document.createElement('span');
      textSpan.className = 'jp-text';
      textSpan.innerHTML = originalHtml;

      const actionsWrapper = document.createElement('span');
      actionsWrapper.className = 'jp-actions-wrapper';

      // TTS (Speech Synthesis) Trigger
      const playBtn = document.createElement('button');
      playBtn.className = 'jp-action-btn play-btn';
      playBtn.setAttribute('title', 'Listen to Pronunciation');
      playBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>`;
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        speakText(textSpan.textContent);
      });

      // Mic (Speech Recognition) Trigger
      const micBtn = document.createElement('button');
      micBtn.className = 'jp-action-btn mic-btn';
      micBtn.setAttribute('title', 'Practice Speaking');
      micBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>`;
      micBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openVoiceCoach(textSpan.textContent);
      });

      actionsWrapper.appendChild(playBtn);
      actionsWrapper.appendChild(micBtn);

      container.appendChild(textSpan);
      container.appendChild(actionsWrapper);
      el.appendChild(container);
    });
  }

  // Text-To-Speech Playback
  function speakText(text) {
    if (!window.speechSynthesis) {
      alert("Text-to-speech is not supported in your browser.");
      return;
    }

    // Cancel current playbacks
    window.speechSynthesis.cancel();

    // Clean text from inline annotations/HTML tags
    const cleanText = text.replace(/<[^>]*>/g, '').trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'ja-JP';

    // Set voice matching ja-JP
    const voices = window.speechSynthesis.getVoices();
    const jaVoice = voices.find(v => v.lang === 'ja-JP' || v.lang.startsWith('ja'));
    if (jaVoice) {
      utterance.voice = jaVoice;
    }

    window.speechSynthesis.speak(utterance);
  }

  // Speech Recognition / Voice Coach Modal injection
  function injectVoiceCoachElements() {
    if (document.getElementById('voice-coach-sheet')) return;

    voiceCoachBackdrop = document.createElement('div');
    voiceCoachBackdrop.className = 'voice-coach-backdrop';
    document.body.appendChild(voiceCoachBackdrop);

    voiceCoachSheet = document.createElement('div');
    voiceCoachSheet.id = 'voice-coach-sheet';
    voiceCoachSheet.className = 'voice-coach-sheet';
    voiceCoachSheet.innerHTML = `
      <div class="voice-coach-header">
        <h3>Voice Coach</h3>
        <button class="close-coach-btn" id="close-coach-btn">
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="voice-coach-body">
        <div class="target-phrase-card">
          <div class="label">Target Japanese Phrase</div>
          <div class="phrase" id="coach-target-phrase"></div>
        </div>
        <div class="recording-status-box">
          <button class="recording-mic-btn" id="coach-mic-btn">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"/></svg>
          </button>
          <span class="status-label-text" id="coach-status-label">Click mic and speak</span>
        </div>
        <div class="transcription-result-box" id="coach-result-box" style="display:none;">
          <div class="result-row">
            <div class="row-label">We heard</div>
            <div class="value" id="coach-transcription"></div>
          </div>
          <div class="result-row" style="text-align: center;">
            <span class="score-badge" id="coach-score-badge">0% Match</span>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(voiceCoachSheet);

    // Bind modal actions
    document.getElementById('close-coach-btn').addEventListener('click', closeVoiceCoach);
    voiceCoachBackdrop.addEventListener('click', closeVoiceCoach);
    document.getElementById('coach-mic-btn').addEventListener('click', toggleRecording);
  }

  function openVoiceCoach(text) {
    injectVoiceCoachElements();
    currentTargetText = text.trim();
    
    document.getElementById('coach-target-phrase').textContent = currentTargetText;
    document.getElementById('coach-result-box').style.display = 'none';
    document.getElementById('coach-status-label').textContent = 'Click mic and speak';
    document.getElementById('coach-mic-btn').className = 'recording-mic-btn';
    
    voiceCoachBackdrop.classList.add('active');
    voiceCoachSheet.classList.add('active');
  }

  function closeVoiceCoach() {
    if (recognition) {
      recognition.abort();
    }
    if (voiceCoachSheet) {
      voiceCoachBackdrop.classList.remove('active');
      voiceCoachSheet.classList.remove('active');
    }
  }

  // Toggle Recording logic
  function toggleRecording() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech Recognition API is not supported in this browser. Please use Google Chrome or Apple Safari.");
      return;
    }

    const micBtn = document.getElementById('coach-mic-btn');
    const statusLabel = document.getElementById('coach-status-label');
    const resultBox = document.getElementById('coach-result-box');

    if (recognition && micBtn.classList.contains('recording')) {
      recognition.stop();
      return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      micBtn.classList.add('recording');
      statusLabel.textContent = 'Listening... Speak now!';
      resultBox.style.display = 'none';
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      
      const normalizedTarget = normalizeJapanese(currentTargetText);
      const normalizedTranscript = normalizeJapanese(transcript);

      const { html, accuracy } = diffStrings(normalizedTarget, normalizedTranscript);

      document.getElementById('coach-transcription').innerHTML = html || transcript;
      
      const scoreBadge = document.getElementById('coach-score-badge');
      scoreBadge.textContent = `${accuracy}% Match`;

      if (accuracy >= 80) {
        scoreBadge.className = 'score-badge excellent';
        playSound(true);
      } else {
        scoreBadge.className = 'score-badge needs-work';
        playSound(false);
      }

      resultBox.style.display = 'block';
      statusLabel.textContent = 'Done! Click mic to retry';
    };

    recognition.onerror = (e) => {
      console.error("Speech Recognition Error:", e);
      statusLabel.textContent = 'Error matched: ' + e.error;
      micBtn.classList.remove('recording');
    };

    recognition.onend = () => {
      micBtn.classList.remove('recording');
    };

    recognition.start();
  }

  // Normalize Japanese for string diffing
  function normalizeJapanese(str) {
    return str
      .replace(/<rt>.*?<\/rt>/g, '') // remove ruby readings
      .replace(/<\/?[^>]+(>|$)/g, "") // remove HTML
      .replace(/[、。？！，．？\s\(\)（）\-\_\+\=\[\]\{\}“”’‘「」『』]/g, '') // strip punctuation
      .toLowerCase()
      .trim();
  }

  // LCS Dynamic programming character diff
  function diffStrings(target, input) {
    const t = Array.from(target);
    const i = Array.from(input);
    const m = t.length;
    const n = i.length;

    const dp = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));

    for (let x = 1; x <= m; x++) {
      for (let y = 1; y <= n; y++) {
        if (t[x - 1] === i[y - 1]) {
          dp[x][y] = dp[x - 1][y - 1] + 1;
        } else {
          dp[x][y] = Math.max(dp[x - 1][y], dp[x][y - 1]);
        }
      }
    }

    let x = m;
    let y = n;
    const result = [];

    while (x > 0 || y > 0) {
      if (x > 0 && y > 0 && t[x - 1] === i[y - 1]) {
        result.unshift({ type: 'match', char: t[x - 1] });
        x--;
        y--;
      } else if (y > 0 && (x === 0 || dp[x][y - 1] >= dp[x - 1][y])) {
        result.unshift({ type: 'extra', char: i[y - 1] });
        y--;
      } else {
        result.unshift({ type: 'missing', char: t[x - 1] });
        x--;
      }
    }

    const matches = result.filter(r => r.type === 'match').length;
    const accuracy = Math.round((matches / Math.max(1, m)) * 100);

    let html = '';
    result.forEach(r => {
      if (r.type === 'match') {
        html += `<span class="diff-match">${r.char}</span>`;
      } else if (r.type === 'extra') {
        html += `<span class="diff-extra">${r.char}</span>`;
      } else {
        html += `<span class="diff-mismatch">${r.char}</span>`;
      }
    });

    return { html, accuracy };
  }

  // Web Audio success/failure chimes
  function playSound(success) {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (success) {
        // Success: Happy double chime
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08); // E5
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else {
        // Soft error buzz
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(196.00, ctx.currentTime); // G3
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (err) {
      console.warn("Web Audio API not allowed/supported:", err);
    }
  }

  // Custom HTML5 Native Audio Player Injection (for Wave Files)
  function injectAudioPlayer() {
    const mainContainer = document.querySelector('main.wrap') || document.body;
    if (!mainContainer) return;

    const playerCard = document.createElement('div');
    playerCard.className = 'lesson-audio-player-card';
    playerCard.innerHTML = `
      <div class="player-main-controls">
        <button class="player-btn" id="audio-play-btn" title="Play/Pause Recording">
          <!-- Play Icon -->
          <svg id="play-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          <!-- Pause Icon -->
          <svg id="pause-icon" style="display:none;" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
        </button>
      </div>
      <div class="player-timeline-container">
        <span id="player-time-current">0:00</span>
        <input type="range" class="player-slider" id="player-time-slider" min="0" max="100" value="0">
        <span id="player-time-duration">0:00</span>
      </div>
      <div class="player-speed-selector">
        <button class="speed-option-btn" data-speed="0.75">0.75x</button>
        <button class="speed-option-btn active" data-speed="1.0">1.0x</button>
        <button class="speed-option-btn" data-speed="1.25">1.25x</button>
      </div>
      <audio id="lesson-native-audio" src="${window.LESSON_AUDIO}" preload="metadata"></audio>
    `;

    // Insert at top of main container, before the first actual content card
    const firstSection = mainContainer.querySelector('section:nth-of-type(2)');
    if (firstSection) {
      mainContainer.insertBefore(playerCard, firstSection);
    } else {
      mainContainer.appendChild(playerCard);
    }

    const audio = document.getElementById('lesson-native-audio');
    const playBtn = document.getElementById('audio-play-btn');
    const playIcon = document.getElementById('play-icon');
    const pauseIcon = document.getElementById('pause-icon');
    const slider = document.getElementById('player-time-slider');
    const timeCurrent = document.getElementById('player-time-current');
    const timeDuration = document.getElementById('player-time-duration');
    const speedButtons = playerCard.querySelectorAll('.speed-option-btn');

    function formatTime(secs) {
      const m = Math.floor(secs / 60);
      const s = Math.floor(secs % 60).toString().padStart(2, '0');
      return `${m}:${s}`;
    }

    // Set Duration text when meta is loaded
    audio.addEventListener('loadedmetadata', () => {
      slider.max = Math.floor(audio.duration);
      timeDuration.textContent = formatTime(audio.duration);
    });

    // Fallback if metadata is already loaded
    if (audio.readyState >= 1) {
      slider.max = Math.floor(audio.duration);
      timeDuration.textContent = formatTime(audio.duration);
    }

    // Update timelines
    audio.addEventListener('timeupdate', () => {
      if (!slider.dragging) {
        slider.value = Math.floor(audio.currentTime);
        timeCurrent.textContent = formatTime(audio.currentTime);
      }
    });

    audio.addEventListener('ended', () => {
      playIcon.style.display = 'block';
      pauseIcon.style.display = 'none';
      audio.currentTime = 0;
    });

    // Button interactions
    playBtn.addEventListener('click', () => {
      if (audio.paused) {
        audio.play();
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
      } else {
        audio.pause();
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
      }
    });

    slider.addEventListener('input', () => {
      slider.dragging = true;
      timeCurrent.textContent = formatTime(slider.value);
    });

    slider.addEventListener('change', () => {
      audio.currentTime = slider.value;
      slider.dragging = false;
    });

    // Speed Rate adjustments
    speedButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const speed = parseFloat(btn.getAttribute('data-speed'));
        audio.playbackRate = speed;
        speedButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  // Load voices before hand to avoid delay on speech click in Chrome/Safari
  if (window.speechSynthesis) {
    window.speechSynthesis.getVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
  }

  // Launch on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

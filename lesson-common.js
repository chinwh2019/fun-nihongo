/* ==========================================
   日本語 Hub - Enhanced Lesson Functionality
   ========================================== */

(function() {
  // Global states
  let currentTargetText = '';
  let recognition = null;
  let voiceCoachSheet = null;
  let voiceCoachBackdrop = null;
  let mediaRecorder = null;
  let audioChunks = [];
  let recordedAudioUrl = null;
  let userAudioElement = null;

  // Initialize features once DOM is ready
  function init() {
    // 1. Parse Vocab Table
    const vocabMap = parseVocabTable();

    // 2. Inject Floating Control Panel
    injectControlPanel();

    // 3. Wrap .jp elements and add speech/TTS triggers
    instrumentJapaneseText(vocabMap);

    // 4. Set up vocab tooltip listeners
    setupVocabTooltipListeners(vocabMap);

    // 5. Inject Audio Player if voice lesson is available
    if (window.LESSON_AUDIO) {
      injectAudioPlayer();
    }

    // 6. Load initial Reading Toggle preference
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
  function instrumentJapaneseText(vocabMap) {
    const jpElements = document.querySelectorAll('.jp');
    jpElements.forEach(el => {
      // Avoid processing nested elements or already wrapped ones
      if (el.querySelector('.jp-container') || el.classList.contains('jp-container')) return;

      // Highlight vocabulary inside the element before wrapping it
      if (vocabMap) {
        highlightVocabInElement(el, vocabMap);
      }

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
            <div class="coach-play-btn-row">
              <button class="coach-play-btn" id="coach-play-recording-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                Listen to My Attempt
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(voiceCoachSheet);

    // Bind modal actions
    document.getElementById('close-coach-btn').addEventListener('click', closeVoiceCoach);
    voiceCoachBackdrop.addEventListener('click', closeVoiceCoach);
    document.getElementById('coach-mic-btn').addEventListener('click', toggleRecording);

    // Bind Play user recording action
    const playRecBtn = document.getElementById('coach-play-recording-btn');
    if (playRecBtn) {
      playRecBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (recordedAudioUrl) {
          if (userAudioElement) {
            userAudioElement.pause();
          }
          userAudioElement = new Audio(recordedAudioUrl);
          userAudioElement.play().catch(err => console.warn("Failed to play user recording:", err));
        }
      });
    }
  }

  function openVoiceCoach(text) {
    injectVoiceCoachElements();
    currentTargetText = text.trim();
    
    document.getElementById('coach-target-phrase').textContent = currentTargetText;
    document.getElementById('coach-result-box').style.display = 'none';
    document.getElementById('coach-status-label').textContent = 'Click mic and speak';
    document.getElementById('coach-mic-btn').className = 'recording-mic-btn';
    
    const playRecBtn = document.getElementById('coach-play-recording-btn');
    if (playRecBtn) {
      playRecBtn.style.display = 'none';
    }

    voiceCoachBackdrop.classList.add('active');
    voiceCoachSheet.classList.add('active');
  }

  function closeVoiceCoach() {
    if (recognition) {
      recognition.abort();
    }
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    if (userAudioElement) {
      userAudioElement.pause();
      userAudioElement = null;
    }
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
      recordedAudioUrl = null;
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
    const playRecBtn = document.getElementById('coach-play-recording-btn');

    if (recognition && micBtn.classList.contains('recording')) {
      recognition.stop();
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
      return;
    }

    if (playRecBtn) {
      playRecBtn.style.display = 'none';
    }
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
      recordedAudioUrl = null;
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    let micStream = null;

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
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
    };

    recognition.onend = () => {
      micBtn.classList.remove('recording');
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
    };

    // Ask for microphone access and start recording
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        micStream = stream;
        audioChunks = [];
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.push(event.data);
          }
        };
        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          recordedAudioUrl = URL.createObjectURL(audioBlob);
          if (playRecBtn) {
            playRecBtn.style.display = 'inline-flex';
          }
          // release standard media tracks
          micStream.getTracks().forEach(track => track.stop());
        };
        
        mediaRecorder.start();
        recognition.start();
      })
      .catch(err => {
        console.error("Microphone access failed:", err);
        statusLabel.textContent = "Mic access denied or unavailable";
        micBtn.classList.remove('recording');
      });
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

    let loopStart = null;
    let loopEnd = null;

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
      <div class="player-loop-controls">
        <button class="loop-btn" id="loop-a-btn" title="Set Start Loop (A)">A</button>
        <button class="loop-btn" id="loop-b-btn" title="Set End Loop (B)">B</button>
        <button class="loop-btn" id="loop-clear-btn" title="Clear Loop" style="display:none;">Clear</button>
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

    const loopABtn = document.getElementById('loop-a-btn');
    const loopBBtn = document.getElementById('loop-b-btn');
    const loopClearBtn = document.getElementById('loop-clear-btn');

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

      // A-B Looping logic
      if (!slider.dragging) {
        if (loopStart !== null && audio.currentTime < loopStart) {
          audio.currentTime = loopStart;
        }
        if (loopStart !== null && loopEnd !== null && audio.currentTime >= loopEnd) {
          audio.currentTime = loopStart;
        }
      }
    });

    audio.addEventListener('ended', () => {
      playIcon.style.display = 'block';
      pauseIcon.style.display = 'none';
      audio.currentTime = loopStart !== null ? loopStart : 0;
      if (loopStart !== null) {
        audio.play().catch(e => console.warn(e));
      }
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

    // Loop point event listeners
    loopABtn.addEventListener('click', () => {
      loopStart = audio.currentTime;
      loopABtn.classList.add('active');
      loopABtn.textContent = `A: ${formatTime(loopStart)}`;
      loopClearBtn.style.display = 'inline-block';
    });

    loopBBtn.addEventListener('click', () => {
      if (loopStart === null) {
        alert("Please set Loop Start (A) first!");
        return;
      }
      if (audio.currentTime <= loopStart) {
        alert("Loop End must be after Loop Start!");
        return;
      }
      loopEnd = audio.currentTime;
      loopBBtn.classList.add('active');
      loopBBtn.textContent = `B: ${formatTime(loopEnd)}`;
      loopClearBtn.style.display = 'inline-block';
    });

    loopClearBtn.addEventListener('click', () => {
      loopStart = null;
      loopEnd = null;
      loopABtn.classList.remove('active');
      loopBBtn.classList.remove('active');
      loopABtn.textContent = 'A';
      loopBBtn.textContent = 'B';
      loopClearBtn.style.display = 'none';
    });
  }

  // Load voices before hand to avoid delay on speech click in Chrome/Safari
  if (window.speechSynthesis) {
    window.speechSynthesis.getVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
  }

  // Parse vocabulary table from DOM
  function parseVocabTable() {
    const vocabMap = {};
    const tables = document.querySelectorAll('table');
    
    tables.forEach(table => {
      let kanjiIdx = 0;
      let readingIdx = 1;
      let meaningIdx = 2;
      let noteIdx = 3;

      const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim().toLowerCase());
      if (headers.length > 0) {
        const k = headers.findIndex(h => h.includes("japanese") || h.includes("日本語") || h.includes("word") || h.includes("vocab") || h.includes("表現") || h === "語彙");
        const r = headers.findIndex(h => h.includes("reading") || h.includes("読み") || h.includes("発音") || h === "かな" || h === "ふりがな" || h === "ひらがな");
        const m = headers.findIndex(h => h.includes("meaning") || h.includes("意味") || h.includes("translation") || h.includes("english") || h.includes("訳") || h.includes("解説"));
        const n = headers.findIndex(h => h.includes("note") || h.includes("ノート") || h.includes("メモ") || h.includes("useful") || h.includes("補足"));
        if (k !== -1) kanjiIdx = k;
        if (r !== -1) readingIdx = r;
        if (m !== -1) meaningIdx = m;
        if (n !== -1) noteIdx = n;
      }

      const rows = table.querySelectorAll('tbody tr');
      rows.forEach(row => {
        const cells = Array.from(row.querySelectorAll('td'));
        if (cells.length > Math.max(kanjiIdx, meaningIdx)) {
          const kanji = cells[kanjiIdx].textContent.trim();
          const reading = cells[readingIdx] ? cells[readingIdx].textContent.trim() : '';
          const meaning = cells[meaningIdx].textContent.trim();
          const note = cells[noteIdx] ? cells[noteIdx].textContent.trim() : '';

          if (kanji && meaning) {
            vocabMap[kanji] = { reading, meaning, note };
          }
        }
      });
    });
    
    return vocabMap;
  }

  // Highlight vocabulary keywords inside elements
  function highlightVocabInElement(element, vocabMap) {
    const words = Object.keys(vocabMap).sort((a, b) => b.length - a.length);
    if (words.length === 0) return;

    const walk = (node) => {
      if (node.nodeType === 3) {
        const text = node.nodeValue;
        let matchWord = null;
        let matchIndex = -1;
        
        for (const word of words) {
          const index = text.indexOf(word);
          if (index !== -1) {
            matchWord = word;
            matchIndex = index;
            break;
          }
        }
        
        if (matchWord !== null) {
          const beforeText = text.substring(0, matchIndex);
          const afterText = text.substring(matchIndex + matchWord.length);
          const parent = node.parentNode;
          
          // Skip if parent is already a highlight, ruby, rt, rp, button, or link
          if (parent && (
            parent.classList.contains('vocab-highlight') || 
            parent.tagName === 'RUBY' || 
            parent.tagName === 'RT' || 
            parent.tagName === 'RP' || 
            parent.tagName === 'BUTTON' || 
            parent.tagName === 'A'
          )) {
            return;
          }
          
          const beforeNode = document.createTextNode(beforeText);
          const afterNode = document.createTextNode(afterText);
          
          const highlightSpan = document.createElement('span');
          highlightSpan.className = 'vocab-highlight';
          highlightSpan.setAttribute('data-word', matchWord);
          highlightSpan.textContent = matchWord;
          
          parent.insertBefore(beforeNode, node);
          parent.insertBefore(highlightSpan, node);
          parent.insertBefore(afterNode, node);
          parent.removeChild(node);
          
          walk(afterNode);
        }
      } else if (node.nodeType === 1) {
        const ignoreTags = ['RUBY', 'RT', 'RP', 'BUTTON', 'A', 'SCRIPT', 'STYLE'];
        if (!ignoreTags.includes(node.tagName) && !node.classList.contains('vocab-highlight')) {
          const children = Array.from(node.childNodes);
          children.forEach(child => walk(child));
        }
      }
    };

    walk(element);
  }

  // Floating Tooltip controls
  function injectVocabTooltipBox() {
    if (document.getElementById('vocab-tooltip-box')) return;
    const tooltip = document.createElement('div');
    tooltip.id = 'vocab-tooltip-box';
    tooltip.className = 'vocab-tooltip-box';
    document.body.appendChild(tooltip);
  }

  function showTooltip(targetEl, word, vocabData) {
    injectVocabTooltipBox();
    const tooltip = document.getElementById('vocab-tooltip-box');
    
    let html = `<div class="vocab-tooltip-title">${word}</div>`;
    if (vocabData.reading && vocabData.reading !== '-') {
      html += `<div class="vocab-tooltip-reading">【${vocabData.reading}】</div>`;
    }
    html += `<div class="vocab-tooltip-meaning">${vocabData.meaning}</div>`;
    if (vocabData.note) {
      html += `<div class="vocab-tooltip-note">${vocabData.note}</div>`;
    }
    tooltip.innerHTML = html;
    
    const rect = targetEl.getBoundingClientRect();
    tooltip.classList.add('active'); // Needs to be active to calculate correct height/width
    const tooltipHeight = tooltip.offsetHeight || 60;
    const tooltipWidth = tooltip.offsetWidth || 180;
    
    let top = window.scrollY + rect.top - tooltipHeight - 10;
    let left = window.scrollX + rect.left + (rect.width / 2) - (tooltipWidth / 2);
    
    if (rect.top - tooltipHeight - 10 < 0) {
      top = window.scrollY + rect.bottom + 10;
    }
    if (left < 10) {
      left = 10;
    }
    if (left + tooltipWidth > window.innerWidth - 10) {
      left = window.innerWidth - tooltipWidth - 10;
    }
    
    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
  }

  function hideTooltip() {
    const tooltip = document.getElementById('vocab-tooltip-box');
    if (tooltip) {
      tooltip.classList.remove('active');
    }
  }

  function setupVocabTooltipListeners(vocabMap) {
    const highlights = document.querySelectorAll('.vocab-highlight');
    highlights.forEach(el => {
      const word = el.getAttribute('data-word');
      const data = vocabMap[word];
      if (!data) return;

      el.addEventListener('mouseenter', () => showTooltip(el, word, data));
      el.addEventListener('mouseleave', hideTooltip);

      el.addEventListener('touchstart', (e) => {
        e.stopPropagation();
        showTooltip(el, word, data);
      });
    });

    document.addEventListener('touchstart', hideTooltip);
  }

  // Handle MCQ option checks locally
  window.checkOption = function(btn, isCorrect) {
    if (isCorrect) {
      btn.style.background = 'rgba(16, 185, 129, 0.15)'; // soft green
      btn.style.color = '#059669';
      btn.style.borderColor = '#10b981';
      btn.style.fontWeight = '700';
      if (!btn.innerHTML.includes('✓')) {
        btn.innerHTML += ' <span style="float: right;">✓</span>';
      }
    } else {
      btn.style.background = 'rgba(239, 68, 68, 0.15)'; // soft red
      btn.style.color = '#dc2626';
      btn.style.borderColor = '#ef4444';
      btn.style.fontWeight = '700';
      if (!btn.innerHTML.includes('✗')) {
        btn.innerHTML += ' <span style="float: right;">✗</span>';
      }
    }
    
    // Disable all options in the same grid/parent to prevent re-clicks
    const parent = btn.parentNode;
    if (parent) {
      Array.from(parent.querySelectorAll('.option-btn')).forEach(child => {
        child.disabled = true;
        child.style.cursor = 'not-allowed';
      });
    }
  };

  // Launch on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

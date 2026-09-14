import React, { useState, useEffect, useRef, useCallback } from "react";
import "./App.css";

// Difficulty-based word banks used for randomized text generation
const WORDBANKS = {
  low: [
    "hi", "run", "sky", "cup", "top", "pen", "box", "key", "car", "joy",
    "win", "map", "cat", "dog", "red", "sun", "hot", "fly", "tap", "day",
    "fan", "hat", "ice", "jam", "net", "cow", "lip", "eye", "sit", "yes"
  ],
  medium: [
    "typing", "mobile", "speed", "finger", "screen", "button", "smooth",
    "coding", "cursor", "target", "matrix", "layout", "laptop", "action",
    "future", "system", "design", "device", "player", "master"
  ],
  high: [
    "speed and accuracy work together for high productivity.",
    "clean and readable code makes every software project better.",
    "consistent touch typing practice sharpens hand coordination.",
    "focus on accurate keystrokes and fast speed will follow naturally.",
    "modern web applications require high performance and clean UI."
  ]
};

// Layout blueprint for the on-screen virtual keyboard
const KEYBOARD_LAYOUT = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["shift", "z", "x", "c", "v", "b", "n", "m", "backspace"],
  [",", " ", "."]
];

// Non-printable control keys to ignore so they do not count as invalid characters
const IGNORED_KEYS = new Set([
  "Enter", "Control", "Alt", "CapsLock", "Tab", "Meta", "Escape",
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
  "PageUp", "PageDown", "Home", "End", "Insert", "ContextMenu",
  "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12"
]);

// Default session length in seconds
const TOTAL_TIME = 60;

export default function App() {
  // Application State
  const [level, setLevel] = useState("low");
  const [targetText, setTargetText] = useState("");
  const [typedString, setTypedString] = useState("");
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTestEnded, setIsTestEnded] = useState(false);
  const [isShiftActive, setIsShiftActive] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isLightMode, setIsLightMode] = useState(false);
  const [pressedKey, setPressedKey] = useState(null);

  // References for mutable browser APIs and active DOM nodes
  const audioCtxRef = useRef(null);
  const activeCharRef = useRef(null);
  const timerRef = useRef(null);

  // Initialize or resume the Web Audio Context for synthesized sound feedback
  const initAudio = () => {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtxRef.current = new AudioContextClass();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
  };

  // Generate synthesizer beeps for correct letters, spaces, and errors
  const playKeySound = (type = "normal") => {
    if (!soundEnabled || !audioCtxRef.current) return;

    try {
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;

      if (type === "space") {
        // Low pitch tone for spacebar
        osc.type = "sine";
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.04);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);
        osc.start(now);
        osc.stop(now + 0.04);
      } else if (type === "error") {
        // Harsh descending tone for incorrect inputs
        osc.type = "triangle";
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.linearRampToValueAtTime(90, now + 0.07);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.07);
        osc.start(now);
        osc.stop(now + 0.07);
      } else {
        // Crisp high frequency click for valid keystrokes
        osc.type = "sine";
        osc.frequency.setValueAtTime(650, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.03);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.03);
        osc.start(now);
        osc.stop(now + 0.03);
      }
    } catch (err) {
      console.warn("Audio playback issue:", err);
    }
  };

  // Assemble randomized sentences or word sequences based on the current level
  const generateBatch = useCallback((selectedLevel) => {
    const list = WORDBANKS[selectedLevel];
    if (selectedLevel === "high") {
      return list[Math.floor(Math.random() * list.length)] + " ";
    }

    const words = [];
    for (let i = 0; i < 12; i++) {
      words.push(list[Math.floor(Math.random() * list.length)]);
    }
    return words.join(" ") + " ";
  }, []);

  // Reset all state variables back to their initial test configuration
  const resetTest = useCallback((newLevel = level) => {
    clearInterval(timerRef.current);
    setTimeLeft(TOTAL_TIME);
    setIsPlaying(false);
    setIsTestEnded(false);
    setTypedString("");
    setIsShiftActive(false);

    // Seed the text area with two initial batches
    const initialText = generateBatch(newLevel) + generateBatch(newLevel);
    setTargetText(initialText);
  }, [level, generateBatch]);

  // Handle switching difficulty tabs
  const handleLevelChange = (newLevel, e) => {
    // Unfocus the button to avoid accidental re-triggering when pressing Enter
    if (e?.target) e.target.blur();
    setLevel(newLevel);
    resetTest(newLevel);
  };

  // Initial mount configuration
  useEffect(() => {
    resetTest();
  }, [resetTest]);

  // Start the 60-second countdown timer
  const startTimer = useCallback(() => {
    if (isPlaying || isTestEnded) return;

    initAudio();
    setIsPlaying(true);

    timerRef.current = setInterval(() => {
      setTimeLeft((prevTime) => {
        if (prevTime <= 1) {
          clearInterval(timerRef.current);
          setIsPlaying(false);
          setIsTestEnded(true);
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);
  }, [isPlaying, isTestEnded]);

  // Clean up active timer on component unmount
  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  // Ensure active typing cursor remains visible via auto-scrolling
  useEffect(() => {
    if (activeCharRef.current) {
      activeCharRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [typedString]);

  // Infinite text scroll: append additional content when approaching the end of the text
  useEffect(() => {
    if (targetText.length > 0 && targetText.length - typedString.length <= 15) {
      setTargetText((prevText) => prevText + generateBatch(level));
    }
  }, [typedString, targetText, level, generateBatch]);

  // Handle all valid keystrokes from physical or on-screen keyboards
  const processKeyInput = useCallback((keyVal) => {
    if (!keyVal || isTestEnded) return;

    initAudio();

    // Start timer upon the first character stroke if not already running
    if (!isPlaying) {
      startTimer();
    }

    // Toggle shift state
    if (keyVal === "shift") {
      setIsShiftActive((prev) => !prev);
      return;
    }

    // Handle backspace removal
    if (keyVal === "backspace") {
      setTypedString((prev) => {
        if (prev.length > 0) {
          playKeySound("normal");
          return prev.slice(0, -1);
        }
        return prev;
      });
      return;
    }

    // Reject multi-character string inputs that slipped through
    if (keyVal.length !== 1) return;

    const formattedChar = isShiftActive ? keyVal.toUpperCase() : keyVal;
    const expectedChar = targetText[typedString.length];

    // Check accuracy and play respective audio feedback
    if (formattedChar === expectedChar) {
      playKeySound(formattedChar === " " ? "space" : "normal");
    } else {
      playKeySound("error");
    }

    // Append new character to progress
    setTypedString((prev) => prev + formattedChar);

    // Auto-disable shift after one uppercase letter
    if (isShiftActive) {
      setIsShiftActive(false);
    }
  }, [isPlaying, isTestEnded, isShiftActive, targetText, typedString, startTimer]);

  // Attach global keyboard listeners for physical hardware interaction
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isTestEnded) return;

      // Ignore modifiers, navigation arrows, function keys, and Enter
      if (IGNORED_KEYS.has(e.key)) {
        e.preventDefault();
        return;
      }

      let key = e.key;
      if (key === "Backspace") key = "backspace";
      if (key === "Shift") key = "shift";

      // Prevent page scrolling on spacebar and backspace navigations
      if (key === " " || key === "backspace") {
        e.preventDefault();
      }

      // Visual press highlight effect
      setPressedKey(key.toLowerCase());
      setTimeout(() => setPressedKey(null), 90);

      processKeyInput(key);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isTestEnded, processKeyInput]);

  // Statistical calculations (WPM and Accuracy)
  const elapsedSeconds = TOTAL_TIME - timeLeft;
  const typedLength = typedString.length;
  let correctCount = 0;

  for (let i = 0; i < typedLength; i++) {
    if (typedString[i] === targetText[i]) {
      correctCount++;
    }
  }

  const timeInMinutes = elapsedSeconds > 0 ? elapsedSeconds / 60 : 0;
  const netWpm = timeInMinutes > 0 ? Math.max(0, Math.round((correctCount / 5) / timeInMinutes)) : 0;
  const accuracy = typedLength > 0 ? Math.max(0, Math.round((correctCount / typedLength) * 100)) : 100;

  // Identify next character required for keyboard hint illumination
  const nextChar = !isTestEnded && typedString.length < targetText.length
    ? targetText[typedString.length].toLowerCase()
    : "";

  return (
    <div className={`app-root ${isLightMode ? "light-mode" : ""}`}>
      <main className="app-card">
        
        {/* Navigation & Preferences Header */}
        <header className="app-topbar">
          <div className="brand">
            <span className="brand-dot"></span>
            <span className="brand-title">TypePro</span>
          </div>

          <div className="topbar-actions">
            <nav className="level-selector" role="tablist">
              {["low", "medium", "high"].map((lvl) => (
                <button
                  key={lvl}
                  className={`level-btn ${level === lvl ? "active" : ""}`}
                  onClick={(e) => handleLevelChange(lvl, e)}
                >
                  {lvl === "low" ? "Easy" : lvl === "medium" ? "Medium" : "Hard"}
                </button>
              ))}
            </nav>

            {/* Dark / Light Mode Switcher */}
            <button
              className="theme-toggle"
              title="Toggle Theme"
              onClick={(e) => {
                e.target.blur();
                setIsLightMode((prev) => !prev);
              }}
            >
              {isLightMode ? "🌙" : "☀️"}
            </button>
          </div>
        </header>

        {/* Real-time Metrics Grid */}
        <section className="stats-grid">
          <div className="stat-card">
            <span className="label">Time Left</span>
            <span className="value">{timeLeft}<small>s</small></span>
          </div>
          <div className="stat-card accent">
            <span className="label">Speed</span>
            <span className="value">{netWpm} <small>WPM</small></span>
          </div>
          <div className="stat-card">
            <span className="label">Accuracy</span>
            <span className="value">{accuracy}<small>%</small></span>
          </div>
        </section>

        {/* Text Area Display */}
        <section className="display-box">
          <div className="text-display">
            {targetText.split("").map((char, index) => {
              const isTyped = index < typedString.length;
              const isCurrent = index === typedString.length;
              const isCorrect = isTyped && typedString[index] === char;
              const isIncorrect = isTyped && typedString[index] !== char;

              let charClass = "char";
              if (isCurrent) charClass += " current";
              if (isCorrect) charClass += " correct";
              if (isIncorrect) charClass += " incorrect";

              return (
                <span
                  key={index}
                  ref={isCurrent ? activeCharRef : null}
                  className={charClass}
                >
                  {char}
                </span>
              );
            })}
          </div>
        </section>

        {/* Virtual On-Screen Keyboard */}
        <section className={`keyboard ${isTestEnded ? "disabled" : ""}`}>
          {KEYBOARD_LAYOUT.map((row, rowIndex) => (
            <div key={rowIndex} className="kb-row">
              {row.map((key) => {
                const isShiftKey = key === "shift";
                const isBackspaceKey = key === "backspace";
                const isSpaceKey = key === " ";
                const isSymbol = key === "," || key === ".";

                let keyLabel = key;
                if (isShiftKey) keyLabel = "⇧";
                else if (isBackspaceKey) keyLabel = "⌫";
                else if (isSpaceKey) keyLabel = "space";
                else if (isShiftActive) keyLabel = key.toUpperCase();

                let keyClasses = "key";
                if (isShiftKey || isBackspaceKey) keyClasses += " action-key";
                if (isShiftKey && isShiftActive) keyClasses += " active-shift";
                if (isSpaceKey) keyClasses += " space-key";
                if (isSymbol) keyClasses += " symbol-key";
                if (nextChar === key) keyClasses += " highlight-next";
                if (pressedKey === key) keyClasses += " pressed";

                return (
                  <button
                    key={key}
                    className={keyClasses}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      processKeyInput(key);
                    }}
                  >
                    {keyLabel}
                  </button>
                );
              })}
            </div>
          ))}
        </section>

        {/* Bottom Control Actions */}
        <footer className="controls">
          <button
            className="ctrl-btn start"
            disabled={isPlaying || isTestEnded}
            onClick={(e) => {
              e.target.blur();
              startTimer();
            }}
          >
            {isPlaying ? "⏳ Running" : isTestEnded ? "Completed" : "▶ Start"}
          </button>
          
          <button
            className="ctrl-btn"
            onClick={(e) => {
              e.target.blur();
              initAudio();
              setSoundEnabled((prev) => !prev);
            }}
          >
            <span className="icon">{soundEnabled ? "🔊" : "🔇"}</span> Sound: {soundEnabled ? "ON" : "OFF"}
          </button>

          <button
            className="ctrl-btn restart"
            onClick={(e) => {
              e.target.blur();
              resetTest();
            }}
          >
            Reset
          </button>
        </footer>
      </main>

      {/* Post-Session Evaluation Modal */}
      {isTestEnded && (
        <div className="modal">
          <div className="modal-card">
            <div className="badge">Session Ended</div>
            <h2>Typing Summary</h2>
            <p className="modal-sub">1-minute performance evaluation</p>

            <div className="modal-metrics">
              <div className="metric-item">
                <span className="metric-title">Net Speed</span>
                <strong className="metric-value">{netWpm} WPM</strong>
              </div>
              <div className="metric-divider"></div>
              <div className="metric-item">
                <span className="metric-title">Accuracy</span>
                <strong className="metric-value">{accuracy}%</strong>
              </div>
            </div>

            <button className="modal-btn" onClick={() => resetTest()}>
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
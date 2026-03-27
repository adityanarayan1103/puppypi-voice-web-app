/**
 * normalizer.js — Command Normalization Layer
 *
 * Maps user phrases (from voice/text) to canonical robot commands.
 * Uses strict exact-phrase matching to prevent false triggers.
 */

// Canonical command → list of accepted phrases
const COMMAND_MAP = {
  stand:    ["stand", "stand up", "get up"],
  sit:      ["sit", "sit down"],
  forward:  ["forward", "walk", "walk forward", "go forward"],
  back:     ["back", "backward", "go back", "walk back"],
  left:     ["left", "turn left", "go left"],
  right:    ["right", "turn right", "go right"],
  stop:     ["stop", "halt", "freeze"],
  lie:      ["lie", "lie down", "lay down"],
  look_up:  ["look up", "raise head", "head up"],
  spin:     ["spin", "rotate", "turn around"],
  home:     ["home", "go home", "home position", "reset"],
  hello:    ["hello", "hi", "hey", "wave"],
  dance:    ["dance"],
  jump:     ["jump"],
  shake:    ["shake", "shake head"],
  crawl:    ["crawl", "crawl forward", "creep"],
  push_ups: ["push up", "push ups", "do a push up", "do push ups", "exercise"],
};

// Pre-build reverse lookup: phrase → canonical command
const _LOOKUP = new Map();
for (const [canonical, phrases] of Object.entries(COMMAND_MAP)) {
  for (const phrase of phrases) {
    _LOOKUP.set(phrase, canonical);
  }
}

/**
 * Normalize raw text into a canonical command.
 *
 * Strategy (4-phase):
 *   1. Exact match
 *   2. Text starts-with a known phrase (longest first)
 *   3. First word matches a single-word command
 *   4. Known phrase appears as whole-word substring (longest first)
 *
 * @param {string} rawText - The raw text from user/STT
 * @returns {string|null} - Canonical command or null
 */
function normalize(rawText) {
  if (!rawText || typeof rawText !== "string") return null;

  const text = rawText.trim().toLowerCase();
  if (!text) return null;

  // Phase 1: Exact match
  if (_LOOKUP.has(text)) {
    return _LOOKUP.get(text);
  }

  // Phase 2: Starts-with (longest phrase first to prefer "go forward" over "go")
  const sortedPhrases = [..._LOOKUP.keys()].sort((a, b) => b.length - a.length);
  for (const phrase of sortedPhrases) {
    if (text.startsWith(phrase)) {
      return _LOOKUP.get(phrase);
    }
  }

  // Phase 3: First word fallback
  const firstWord = text.split(/\s+/)[0];
  if (_LOOKUP.has(firstWord)) {
    return _LOOKUP.get(firstWord);
  }

  // Phase 4: Known phrase as whole-word substring (longest first)
  // Handles "can you stand up" → "stand up" → stand
  for (const phrase of sortedPhrases) {
    const regex = new RegExp("\\b" + phrase.replace(/\s+/g, "\\s+") + "\\b");
    if (regex.test(text)) {
      return _LOOKUP.get(phrase);
    }
  }

  return null;
}

module.exports = { normalize, COMMAND_MAP };

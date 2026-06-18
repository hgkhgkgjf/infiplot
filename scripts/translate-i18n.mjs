#!/usr/bin/env node
/**
 * Translate lib/i18n/locales/zh-CN.ts to target locales using an LLM.
 *
 * Defaults to translating only `ja` (English is hand-curated in en.ts).
 * Override with --locales=en,ja. Other locales remain stubs.
 *
 * Uses the existing OpenAI-compatible TEXT_BASE_URL + TEXT_API_KEY from
 * .env.local. Default model is `gemini-3.5-flash` (the openai-next.com proxy
 * supports it alongside gpt-4.1); override with --model or TRANSLATE_MODEL.
 *
 * Strategy:
 *   1. Read zh-CN.ts as TEXT (so structure + function signatures stay intact).
 *   2. Tokenize source, finding every string literal that contains Han chars.
 *   3. Mask ${...} interpolations and HTML attributes/URLs, send the rest to
 *      the LLM with strict "preserve these tokens" instructions.
 *   4. Replace each match in source (back-to-front to keep indices valid).
 *   5. Rename `zhCN`/`ZhCNTranslations` → target locale var names, write file.
 *
 * Why source-as-text instead of import + serialize: the source contains two
 * ICU-style functions (hint.text, about.legalNotice) whose control flow and
 * parameter typing must survive unchanged. String-literal find-and-replace
 * leaves them alone — only their Chinese substrings get translated.
 *
 * Usage:
 *   node scripts/translate-i18n.mjs                    # ja only, gemini-3.5-flash
 *   node scripts/translate-i18n.mjs --locales=en,ja    # both
 *   node scripts/translate-i18n.mjs --model=gemini-2.5-flash
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { argv } from "node:process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const ENV_FILE = resolve(rootDir, ".env.local");

// ── Load .env.local (matches scripts/enrich-firstacts-stepfun.mjs) ────
function loadEnv(path) {
  if (!existsSync(path)) return {};
  const txt = readFileSync(path, "utf8");
  const env = {};
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[k] = v;
  }
  return env;
}
const env = loadEnv(ENV_FILE);

// ── CLI parsing ───────────────────────────────────────────────────────
let targets = ["ja"];
let model = env.TRANSLATE_MODEL || "gemini-3.5-flash";
let concurrency = 6;
for (let i = 2; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--locales" && argv[i + 1]) targets = argv[++i].split(",").map((s) => s.trim());
  else if (a === "--model" && argv[i + 1]) model = argv[++i];
  else if (a === "--concurrency" && argv[i + 1]) concurrency = Number(argv[++i]);
}

const baseUrl = (env.TEXT_BASE_URL || "").replace(/\/+$/, "");
const apiKey = env.TEXT_API_KEY || "";

if (!baseUrl || !apiKey) {
  console.error(`❌ TEXT_BASE_URL and TEXT_API_KEY must be set in ${ENV_FILE}`);
  process.exit(1);
}

const LOCALE_NAMES = {
  en: "English",
  "zh-CN": "Simplified Chinese",
  "zh-TW": "Traditional Chinese (Taiwan)",
  "zh-HK": "Traditional Chinese (Hong Kong)",
  ja: "Japanese",
  ko: "Korean",
  es: "Spanish",
  fr: "French",
  de: "German",
  "pt-BR": "Portuguese (Brazil)",
  pt: "Portuguese",
  ru: "Russian",
  it: "Italian",
  vi: "Vietnamese",
  th: "Thai",
  id: "Indonesian",
  tr: "Turkish",
  pl: "Polish",
  nl: "Dutch",
  uk: "Ukrainian",
  hi: "Hindi",
  cs: "Czech",
};

// ── LLM call ──────────────────────────────────────────────────────────
const cache = new Map();

async function translateText(text, targetLang) {
  const cacheKey = `${targetLang}::${text}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  // Mask ${...} template interpolations so the model can't rewrite them.
  const interps = [];
  let masked = text.replace(/\$\{[^}]*\}/g, (m) => {
    interps.push(m);
    return `⟦I${interps.length - 1}⟧`;
  });
  // Mask {placeholder} and {{placeholder}} style too — common in our strings.
  // (Keep this conservative; only single-word curlies.)
  const placeholders = [];
  masked = masked.replace(/\{\{\w+\}\}|\{\w+\}/g, (m) => {
    placeholders.push(m);
    return `⟦P${placeholders.length - 1}⟧`;
  });

  const prompt = `You are a professional UI translator for an interactive fiction game (galgame) called InfiPlot.

Target language: ${targetLang}.

CRITICAL RULES — violations break the build:
1. Translate ONLY the human-readable text into ${targetLang}.
2. PRESERVE EXACTLY (do not translate, do not move):
   - Tokens shaped ⟦I0⟧, ⟦I1⟧ — these are code placeholders; copy them verbatim into the output.
   - Tokens shaped ⟦P0⟧, ⟦P1⟧ — same.
   - HTML tags: <em>, <a ...>, <span ...>, <br/> — keep tags exactly; translate only inner text.
   - HTML attributes: class="...", href="...", target="..." — keep as-is.
   - URLs (https://..., mailto:...).
3. KEEP PROPER NOUNS UNCHANGED: InfiPlot, GitHub, Google, Umami, QQ, API, Key, BASE URL, MiMo, StepFun.
4. DOT SEPARATOR RULE: the Chinese source uses " · " between characters as a stylistic effect. DO NOT use "·" in your translation. Output normal words. Example: "正 · 在 · 绘 · 制" → English: "Drawing", Japanese: "描画中".
5. Match tone: playful for loading/game UI, professional for technical labels.
6. Output ONLY the translated string. No wrapping quotes, no markdown fences, no commentary.

Source text:
${masked}`;

  let out = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`API ${res.status}: ${errText.slice(0, 200)}`);
      }
      const data = await res.json();
      out = data.choices?.[0]?.message?.content?.trim() ?? "";
      break;
    } catch (err) {
      if (attempt === 2) throw err;
      const backoff = 800 * Math.pow(2, attempt);
      console.log(`   ⚠️ retry in ${backoff}ms: ${err.message.slice(0, 100)}`);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }

  // Strip wrapping quotes / fences the model sometimes adds.
  out = out.replace(/^```[\w]*\n?/, "").replace(/\n?```$/, "");
  out = out.replace(/^["'`]+|["'`]+$/g, "");

  // Restore placeholders in the right order.
  out = out.replace(/⟦I(\d+)⟧/g, (_, i) => interps[Number(i)]);
  out = out.replace(/⟦P(\d+)⟧/g, (_, i) => placeholders[Number(i)]);

  cache.set(cacheKey, out);
  return out;
}

// ── Tokenizer: find every string literal containing Han chars ─────────
function findChineseStrings(source) {
  const results = [];
  let i = 0;
  let line = 1;

  while (i < source.length) {
    const ch = source[i];

    if (ch === "\n") { line++; i++; continue; }

    // Skip line comments
    if (ch === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    // Skip block comments
    if (ch === "/" && source[i + 1] === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) {
        if (source[i] === "\n") line++;
        i++;
      }
      i += 2;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      const start = i;
      const startLine = line;
      const quote = ch;
      i++;
      const parts = [];
      while (i < source.length) {
        const c = source[i];
        if (c === "\\") {
          parts.push(c, source[i + 1] ?? "");
          i += 2;
          continue;
        }
        if (c === "\n") line++;
        if (c === quote) {
          i++;
          break;
        }
        // For backticks, treat ${...} as opaque (don't translate the expression body).
        if (quote === "`" && c === "$" && source[i + 1] === "{") {
          let depth = 1;
          parts.push(c, source[i + 1]);
          i += 2;
          while (i < source.length && depth > 0) {
            const cc = source[i];
            if (cc === "{") depth++;
            else if (cc === "}") depth--;
            if (cc === "\n") line++;
            parts.push(cc);
            i++;
          }
          continue;
        }
        parts.push(c);
        i++;
      }
      const content = parts.join("");
      if (/[一-鿿]/.test(content)) {
        results.push({
          full: source.slice(start, i),
          quote,
          content,
          start,
          end: i,
          line: startLine,
        });
      }
      continue;
    }

    i++;
  }
  return results;
}

// ── Variable rename for target locale file ────────────────────────────
function transformForLocale(source, locale) {
  const varName = locale.replace(/-./g, (c) => c[1].toUpperCase());
  const typeName = varName[0].toUpperCase() + varName.slice(1) + "Translations";
  const localeDisplay = LOCALE_NAMES[locale] || locale;

  let out = source
    .replace(/\bzhCN\b/g, varName)
    .replace(/\bZhCNTranslations\b/g, typeName);

  // Replace the leading comment line with locale info.
  out = out.replace(
    /^\/\/[^\n]*\n/,
    `// ${localeDisplay} — auto-translated from zh-CN by scripts/translate-i18n.mjs (review for quality).\n`,
  );

  return out;
}

// ── Concurrency-limited map ───────────────────────────────────────────
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  let done = 0;
  async function worker() {
    while (next < items.length) {
      const idx = next++;
      try {
        results[idx] = await fn(items[idx], idx);
      } catch (err) {
        results[idx] = { __error: err };
      }
      done++;
      if (done % 5 === 0 || done === items.length) {
        process.stdout.write(`\r   translated ${done}/${items.length}   `);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  process.stdout.write("\n");
  return results;
}

// ── Main per-locale ───────────────────────────────────────────────────
async function translateFile(locale) {
  const localeName = LOCALE_NAMES[locale] || locale;
  console.log(`\n🌐 zh-CN → ${locale} (${localeName})`);

  const sourcePath = join(rootDir, "lib", "i18n", "locales", "zh-CN.ts");
  let source = readFileSync(sourcePath, "utf-8");

  const strings = findChineseStrings(source);
  console.log(`   Found ${strings.length} Chinese strings (concurrency=${concurrency})`);

  const translated = await mapWithConcurrency(strings, concurrency, async (s, idx) => {
    try {
      const out = await translateText(s.content, localeName);
      return { ok: true, value: out, idx: s };
    } catch (err) {
      console.error(`\n   ⚠️ line ${s.line} failed: ${err.message.slice(0, 100)} — keeping source`);
      return { ok: false, value: s.content, idx: s };
    }
  });

  // Apply replacements back-to-front so indices stay valid.
  for (let i = strings.length - 1; i >= 0; i--) {
    const s = strings[i];
    const newContent = translated[i].value;
    if (newContent === s.content) continue;
    const newFull = s.quote + newContent + s.quote;
    source = source.slice(0, s.start) + newFull + source.slice(s.end);
  }

  source = transformForLocale(source, locale);

  const outPath = join(rootDir, "lib", "i18n", "locales", `${locale}.ts`);
  writeFileSync(outPath, source, "utf-8");
  console.log(`   ✅ Wrote ${outPath}`);
}

// ── Run ───────────────────────────────────────────────────────────────
console.log("🚀 InfiPlot i18n translation");
console.log(`   Endpoint: ${baseUrl}`);
console.log(`   Model:    ${model}`);
console.log(`   Targets:  ${targets.join(", ")}`);

for (const locale of targets) {
  if (!LOCALE_NAMES[locale]) {
    console.error(`❌ Unknown locale: ${locale}`);
    continue;
  }
  await translateFile(locale);
}

console.log("\n✨ Done. Review the generated files, then run `pnpm typecheck`.");

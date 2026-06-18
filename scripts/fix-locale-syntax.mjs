#!/usr/bin/env node
// Fix syntax errors in locale files (remove extra comma before play section)

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = resolve(__dirname, '../lib/i18n/locales');

// Fix the pattern: }\n,  // should be }\n\n
function fixLocaleFile(content) {
  // Replace the pattern where language closing is followed by comma and then play section
  return content.replace(
    /}\s*,\s*\/\/ ======== Play Page ========/g,
    '},\n  // ========== Play Page =========='
  );
}

// All locales with the issue
const targetLocales = [
  'zh-TW', 'zh-HK', 'ja', 'ko', 'es', 'fr', 'de', 'pt-BR', 'pt', 'ru',
  'it', 'vi', 'th', 'id', 'tr', 'pl', 'nl', 'uk', 'hi', 'cs'
];

for (const locale of targetLocales) {
  try {
    const filePath = resolve(localesDir, `${locale}.ts`);
    const content = readFileSync(filePath, 'utf-8');
    const newContent = fixLocaleFile(content);

    if (newContent !== content) {
      writeFileSync(filePath, newContent);
      console.log(`✓ Fixed ${locale}.ts`);
    }
  } catch (e) {
    console.error(`✗ Error fixing ${locale}:`, e.message);
  }
}

console.log('Done! Fixed locale files');

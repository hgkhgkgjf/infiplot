#!/usr/bin/env node
// Remove duplicate play sections and fix type annotations

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = resolve(__dirname, '../lib/i18n/locales');

// Target locales
const targetLocales = [
  'zh-TW', 'zh-HK', 'ja', 'ko', 'es', 'fr', 'de', 'pt-BR', 'pt', 'ru',
  'it', 'vi', 'th', 'id', 'tr', 'pl', 'nl', 'uk', 'hi', 'cs'
];

function fixLocaleFile(content, locale) {
  let modified = false;

  // 1. Remove duplicate play section (the one after the main object closes)
  // Pattern: anything from ",\n  // ========== Play Page" to end of file
  const duplicatePlayPattern = /,\n  \/\/ ========== Play Page[\s\S]*$/;
  if (duplicatePlayPattern.test(content)) {
    content = content.replace(duplicatePlayPattern, '');
    modified = true;
    console.log(`  Removed duplicate play section from ${locale}.ts`);
  }

  // 2. Fix type annotations for params in function translations
  // Pattern: (params) => { should be (params: { authEnabled?: boolean }) => {
  const functionPattern = /\(params\)\s*=>\s*\{/g;
  let matchCount = 0;
  content = content.replace(functionPattern, () => {
    matchCount++;
    return '(params: { authEnabled?: boolean }) => {';
  });
  if (matchCount > 0) {
    modified = true;
    console.log(`  Fixed ${matchCount} type annotations in ${locale}.ts`);
  }

  // 3. Fix trailing syntax issues
  // Replace }\n, with }\n,
  content = content.replace(/\}\n,/g, '},\n');

  return modified ? content : null;
}

let successCount = 0;
for (const locale of targetLocales) {
  try {
    const filePath = resolve(localesDir, `${locale}.ts`);
    const content = readFileSync(filePath, 'utf-8');
    const newContent = fixLocaleFile(content, locale);

    if (newContent) {
      writeFileSync(filePath, newContent);
      console.log(`✓ Fixed ${locale}.ts`);
      successCount++;
    }
  } catch (e) {
    console.error(`✗ Error updating ${locale}:`, e.message);
  }
}

console.log(`\nDone! Fixed ${successCount} locale files`);

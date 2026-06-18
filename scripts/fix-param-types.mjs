#!/usr/bin/env node
// Fix type annotations for params parameter in locale files

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = resolve(__dirname, '../lib/i18n/locales');

// Target locales
const targetLocales = [
  'de', 'es', 'fr', 'id', 'it', 'ja', 'ko', 'nl', 'pl', 'pt-BR', 'pt',
  'ru', 'th', 'tr', 'uk', 'zh-TW', 'zh-HK'
];

function fixParamsType(content) {
  // Replace (params) => with (params: { authEnabled?: boolean }) =>
  return content.replace(
    /\(params\)\s*=>\s*\{/g,
    '(params: { authEnabled?: boolean }) => {'
  );
}

let successCount = 0;
for (const locale of targetLocales) {
  try {
    const filePath = resolve(localesDir, `${locale}.ts`);
    const content = readFileSync(filePath, 'utf-8');
    const newContent = fixParamsType(content);

    if (newContent !== content) {
      writeFileSync(filePath, newContent);
      console.log(`✓ Fixed ${locale}.ts`);
      successCount++;
    }
  } catch (e) {
    console.error(`✗ Error updating ${locale}:`, e.message);
  }
}

console.log(`\nDone! Fixed ${successCount} locale files`);

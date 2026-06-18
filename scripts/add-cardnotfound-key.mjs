#!/usr/bin/env node
// Add home.errors.cardNotFound key to all locales

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = resolve(__dirname, '../lib/i18n/locales');

const keyToAdd = '      cardNotFound: "找不到精选剧情：{cardName}",';

// Target locales including zh-CN
const targetLocales = [
  'zh-CN', 'en', 'zh-TW', 'zh-HK', 'ja', 'ko', 'es', 'fr', 'de', 'pt-BR', 'pt', 'ru',
  'it', 'vi', 'th', 'id', 'tr', 'pl', 'nl', 'uk', 'hi', 'cs'
];

function addKeyToErrors(content) {
  // Check if key already exists
  if (content.includes('cardNotFound:')) {
    return null;
  }

  // Find the errors section and add the key
  const errorsPattern = /("errors": \{[^}]*)(\})/;
  const match = content.match(errorsPattern);
  if (match) {
    // Add the new key before the closing brace
    const before = match[1];
    const after = match[2];
    // Check if there's already content in errors
    if (before.trim().endsWith('{')) {
      // Empty errors object, add on new line
      return content.replace(errorsPattern, `$1\n${keyToAdd}\n${after}`);
    } else {
      // Non-empty, add after last key
      return content.replace(errorsPattern, `${before},\n${keyToAdd}\n${after}`);
    }
  }

  // If errors section doesn't exist, we need to create it
  // Find "ui" section and add errors after it
  const uiPattern = /("ui": \{[^}]*\n[^}]*\})/;
  const uiMatch = content.match(uiPattern);
  if (uiMatch) {
    const uiEnd = uiMatch.index + uiMatch[0].length;
    return content.slice(0, uiEnd) + ',\n  "errors": {\n' + keyToAdd + '\n  }' + content.slice(uiEnd);
  }

  return null;
}

let successCount = 0;
for (const locale of targetLocales) {
  try {
    const filePath = resolve(localesDir, `${locale}.ts`);
    const content = readFileSync(filePath, 'utf-8');
    const newContent = addKeyToErrors(content);

    if (newContent) {
      writeFileSync(filePath, newContent);
      console.log(`✓ Added cardNotFound to ${locale}.ts`);
      successCount++;
    } else {
      console.log(`- Skipped ${locale}.ts (key already exists)`);
    }
  } catch (e) {
    console.error(`✗ Error updating ${locale}:`, e.message);
  }
}

console.log(`\nDone! Updated ${successCount} locale files with cardNotFound key`);

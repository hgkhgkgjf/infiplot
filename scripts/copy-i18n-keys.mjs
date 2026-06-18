#!/usr/bin/env node
// Simple script to copy missing translation keys from zh-CN to all other locales

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = resolve(__dirname, '../lib/i18n/locales');

// Read zh-CN as source (remove comments and export)
function parseLocaleFile(content) {
  // Remove comments
  let cleaned = content.replace(/\/\/.*$/gm, '');
  // Remove export and type declarations
  cleaned = cleaned.replace(/export const \w+ = /, '');
  cleaned = cleaned.replace(/ as const;?.*$/, '');
  cleaned = cleaned.replace(/export type [\s\S]*$/, '');
  // Parse
  return JSON.parse(cleaned);
}

function flattenKeys(obj, prefix = '') {
  const keys = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(keys, flattenKeys(value, fullKey));
    } else {
      keys[fullKey] = value;
    }
  }
  return keys;
}

function setNestedValue(obj, key, value) {
  const keys = key.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in current)) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}

// Read zh-CN
let zhCNContent = readFileSync(resolve(localesDir, 'zh-CN.ts'), 'utf-8');
const zhCN = parseLocaleFile(zhCNContent);
const zhCNKeys = flattenKeys(zhCN);

// Target locales
const targetLocales = [
  'zh-TW', 'zh-HK', 'ja', 'ko', 'es', 'fr', 'de', 'pt-BR', 'pt', 'ru',
  'it', 'vi', 'th', 'id', 'tr', 'pl', 'nl', 'uk', 'hi', 'cs'
];

// Process each locale
for (const locale of targetLocales) {
  const filePath = resolve(localesDir, `${locale}.ts`);
  try {
    let content = readFileSync(filePath, 'utf-8');
    const existing = parseLocaleFile(content);
    const existingKeys = flattenKeys(existing);

    // Add missing keys
    let added = 0;
    for (const [key, value] of Object.entries(zhCNKeys)) {
      if (!(key in existingKeys)) {
        setNestedValue(existing, key, value);
        added++;
      }
    }

    if (added > 0) {
      console.log(`Added ${added} missing keys to ${locale}.ts`);
      // Generate new content
      const varName = locale.replace('-', '').replace('-', '');
      const typeName = varName.charAt(0).toUpperCase() + varName.slice(1);
      const newContent = `// ${locale} - Auto-copied missing keys from zh-CN (fallback)
// Run translation script to translate these keys

export const ${varName} = ${JSON.stringify(existing, null, 2)} as const;

export type ${typeName}Translations = typeof ${varName};
`;
      writeFileSync(filePath, newContent);
    }
  } catch (e) {
    console.error(`Error processing ${locale}:`, e.message);
  }
}

console.log('Done copying missing keys to all locales');

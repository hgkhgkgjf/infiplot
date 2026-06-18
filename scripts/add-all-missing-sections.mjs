#!/usr/bin/env node
// Add all missing sections to locale files

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = resolve(__dirname, '../lib/i18n/locales');

// Read zh-CN to get the complete structure
const zhCNContent = readFileSync(resolve(localesDir, 'zh-CN.ts'), 'utf-8');

// Extract the play section from zh-CN (we need to add this)
const playSection = `  "play": {
    "loading": {
      "firstFrame": "正 · 在 · 绘 · 制 · 第 · 一 · 幕",
      "transitioning": "AI · 正 · 在 · 描 · 画 · 下 · 一 · 幕",
      "visionThinking": "AI · 正 · 在 · 想 · 你 · 看 · 到 · 了 · 什 · 么",
      "loadingFirst": "正 · 在 · 唤 · 起 · 第 · 一 · 幕",
      "awakening": "载入中",
    },

    "freeform": {
      "placeholder": "输入你想说的或想做的...",
      "title": "自由输入",
      "ariaLabel": "自由输入",
    },

    "choiceDisabled": "分享剧情未包含这条分支",

    "tooltips": {
      "openSettings": "打开设置",
      "openHistory": "剧情回溯",
      "fullscreen": "全屏 (F)",
      "enterFullscreen": "进入全屏",
      "exportGallery": "导出本局为可交互图集链接（含配音；只会保留最近两次的可交互图集链接）",
      "exportGalleryLabel": "导出可交互图集",
      "shareStory": "导出本局为可继续游玩的剧情 .infiplot（含配音）",
      "shareStoryLabel": "分享当前剧情",
      "mute": "静音",
      "unmute": "取消静音",
      "closeNudge": "关闭提示",
      "silenceNudge": "效果不满意/经常没声音？填入自己的 API Key 试试",
      "back": "返回",
    },

    "imageAlt": "Generated scene",

    "counter": {
      "scene": "第 · {n} · 幕",
      "beat": "{n} · 拍",
      "middle": "·",
    },

    "buttons": {
      "fullscreen": "F · 键 · 全 · 屏",
      "exportGallery": "导 · 出 · 图 · 集",
      "shareStory": "分 · 享 · 剧 · 情",
      "muted": "静 · 音",
      "sound": "有 · 声",
    },

    "error": {
      "title": "出 · 了 · 点 · 状 · 况",
      "back": "返 · 回",
    },

    "previousStep": "上 · 一 · 步 ·",

    "settingsFooter": "保存后配音 Key 会立即生效，用你自己的额度合成当前这一幕的配音。",

    "shareErrors": {
      "notFound": "没有找到要载入的剧情文件。",
      "invalid": "剧情分享文件没有可载入的剧情。",
      "noImage": "剧情分享文件缺少第一幕图片。",
      "noNextImage": "剧情分享文件缺少下一幕图片。",
      "noMemory": "剧情分享文件缺少初始剧情记忆，无法载入。",
      "packFailed": "剧情分享打包失败",
    },
  }`;

// Extract other sections from zh-CN
const settingsMatch = zhCNContent.match(/  "settings": \{[^}]*"actions": \{[^}]*\}\s*\},/s);
const authMatch = zhCNContent.match(/  "auth": \{[^}]*"ariaLabel": "[^"]*"\s*\},/s);
const historyMatch = zhCNContent.match(/  "history": \{[^}]*"ariaLabel": "[^"]*"\s*\},/s);
const customFormMatch = zhCNContent.match(/  "customForm": \{[^}]*"start": "[^"]*"\s*\},/s);

// Target locales
const targetLocales = [
  'zh-TW', 'zh-HK', 'ja', 'ko', 'es', 'fr', 'de', 'pt-BR', 'pt', 'ru',
  'it', 'vi', 'th', 'id', 'tr', 'pl', 'nl', 'uk', 'hi', 'cs'
];

function fixLocaleFile(content, locale) {
  // Check if file already ends properly with "as const;"
  if (content.trim().endsWith('as const;')) {
    console.log(`  ${locale}.ts already properly formatted`);
    return null;
  }

  // Find where the language section ends (around line 280)
  const languageEndPattern = /  "language": \{\s*"title": "[^"]*",\s*"current": "[^"]*",\s*"select": "[^"]*"\s*\}\s*/;

  // Build the replacement
  const replacement = `$&\n${playSection},`;

  if (!languageEndPattern.test(content)) {
    console.log(`  No language section found in ${locale}.ts`);
    return null;
  }

  content = content.replace(languageEndPattern, replacement);

  // Add the closing "as const;" and type export
  const exportType = `export type ${locale.replace('-', '')}Translations = typeof ${locale.replace('-', '')};`;

  // Remove any trailing content and add proper ending
  const trailingContentPattern = /\s*\}[\s\S]*$/;
  content = content.replace(trailingContentPattern, `\n} as const;\n\n${exportType}`);

  return content;
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

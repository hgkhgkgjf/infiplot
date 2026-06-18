#!/usr/bin/env node
// Fix ICU MessageFormat syntax in hint.text across all locales

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = resolve(__dirname, '../lib/i18n/locales');

// Function translations for each locale
const hintTranslations = {
  'zh-TW': {
    text: (params) => {
      const authHint = params.authEnabled ? '（測試期間，登入即可免費暢玩）' : '';
      return `輸入想法、配置風格，點擊「開始」即可遊玩${authHint}；也可以從下方精選故事集挑一篇快速體驗 <em>InfiPlot</em>。點擊「設置」還能填入你的名字，以及你自己的文本、繪圖、識圖模型和配音 Key——全部只存在本地瀏覽器，體驗更穩定。`;
    },
    closeAriaLabel: "不再顯示此提示",
  },
  'zh-HK': {
    text: (params) => {
      const authHint = params.authEnabled ? '（測試期間，登入即可免費暢玩）' : '';
      return `輸入想法、配置風格，點擊「開始」即可遊玩${authHint}；也可以從下方精選故事集挑一篇快速體驗 <em>InfiPlot</em>。點擊「設置」還能填入你的名字，以及你自己的文本、繪圖、識圖模型和配音 Key——全部只存在本地瀏覽器，體驗更穩定。`;
    },
    closeAriaLabel: "不再顯示此提示",
  },
  'ja': {
    text: (params) => {
      const authHint = params.authEnabled ? '（ベータ期間中、ログインで無料プレイ）' : '';
      return `アイデアを入力し、スタイルを設定して「開始」をクリックしてプレイ${authHint}。または、下の厳選ストーリーから1つを選んで、<em>InfiPlot</em>を素早く体験することもできます。「設定」をクリックして、自分の名前とテキスト、画像、ビジョンモデル、TTSキーを入力できます—すべてブラウザにローカル保存され、より安定した体験が得られます。`;
    },
    closeAriaLabel: "このヒントを再度表示しない",
  },
  'ko': {
    text: (params) => {
      const authHint = params.authEnabled ? '（베타 기간 중, 로그인하면 무료 플레이）' : '';
      return `아이디어를 입력하고 스타일을 구성한 후 "시작"을 클릭하여 플레이${authHint}. 또는 아래의 큐레이션된 스토리 중 하나를 선택하여 <em>InfiPlot</em>을 빠르게 경험할 수도 있습니다. "설정"을 클릭하여 이름과 텍스트, 이미지, 비전 모델, TTS 키를 입력할 수 있습니다—모두 브라우저에 로컬로 저장되어 더 안정적인 경험을 제공합니다.`;
    },
    closeAriaLabel: "이 힌트를 다시 표시하지 않음",
  },
  'es': {
    text: (params) => {
      const authHint = params.authEnabled ? ' (se requiere inicio de sesión durante la beta, juego gratuito)' : '';
      return `Ingresa tus ideas, configura estilos y haz clic en "Iniciar" para jugar${authHint}. También puedes elegir una historia curada de abajo para experimentar rápidamente <em>InfiPlot</em>. Haz clic en "Configuración" para ingresar tu nombre y configurar tus propias claves de texto, imagen, visión y TTS—todo almacenado localmente en tu navegador para una experiencia más estable.`;
    },
    closeAriaLabel: "No volver a mostrar este consejo",
  },
  'fr': {
    text: (params) => {
      const authHint = params.authEnabled ? ' (connexion requise pendant la bêta, jeu gratuit)' : '';
      return `Entrez vos idées, configurez les styles et cliquez sur "Démarrer" pour jouer${authHint}. Vous pouvez également choisir une histoire sélectionnée ci-dessous pour découvrir rapidement <em>InfiPlot</em>. Cliquez sur "Paramètres" pour entrer votre nom et configurer vos propres clés de texte, d'image, de vision et de TTS—tout est stocké localement dans votre navigateur pour une expérience plus stable.`;
    },
    closeAriaLabel: "Ne plus afficher cette astuce",
  },
  'de': {
    text: (params) => {
      const authHint = params.authEnabled ? ' (Anmeldung während der Beta erforderlich, kostenloses Spielen)' : '';
      return `Gib deine Ideen ein, konfiguriere Stile und klicke auf "Starten" zum Spielen${authHint}. Du kannst auch eine kuratierte Geschichte unten auswählen, um <em>InfiPlot</em> schnell zu erleben. Klicke auf "Einstellungen", um deinen Namen einzugeben und deine eigenen Text-, Bild-, Vision- und TTS-Schlüssel zu konfigurieren—alles wird lokal in deinem Browser für eine stabilere Erfahrung gespeichert.`;
    },
    closeAriaLabel: "Diesen Hinweis nicht mehr anzeigen",
  },
  'pt-BR': {
    text: (params) => {
      const authHint = params.authEnabled ? ' (login necessário durante o beta, grátis para jogar)' : '';
      return `Digite suas ideias, configure estilos e clique em "Iniciar" para jogar${authHint}. Você também pode escolher uma história curada abaixo para experimentar rapidamente <em>InfiPlot</em>. Clique em "Configurações" para inserir seu nome e configurar suas próprias chaves de texto, imagem, visão e TTS—tudo armazenado localmente no seu navegador para uma experiência mais estável.`;
    },
    closeAriaLabel: "Não mostrar esta dica novamente",
  },
  'pt': {
    text: (params) => {
      const authHint = params.authEnabled ? ' (login necessário durante o beta, grátis para jogar)' : '';
      return `Digite as suas ideias, configure estilos e clique em "Iniciar" para jogar${authHint}. Também pode escolher uma história curada abaixo para experimentar rapidamente <em>InfiPlot</em>. Clique em "Configurações" para inserir o seu nome e configurar as suas próprias chaves de texto, imagem, visão e TTS—tudo guardado localmente no seu navegador para uma experiência mais estável.`;
    },
    closeAriaLabel: "Não mostrar esta dica novamente",
  },
  'ru': {
    text: (params) => {
      const authHint = params.authEnabled ? ' (требуется вход во время бета-теста, бесплатная игра)' : '';
      return `Введите свои идеи, настройте стили и нажмите "Начать" для игры${authHint}. Вы также можете выбрать выбранную историю ниже, чтобы быстро испытать <em>InfiPlot</em>. Нажмите "Настройки", чтобы ввести свое имя и настроить свои собственные ключи текста, изображения, зрения и TTS—все сохраняется локально в вашем браузере для более стабильного опыта.`;
    },
    closeAriaLabel: "Больше не показывать эту подсказку",
  },
  'it': {
    text: (params) => {
      const authHint = params.authEnabled ? ' (accesso richiesto durante la beta, gioco gratuito)' : '';
      return `Inserisci le tue idee, configura gli stili e fai clic su "Inizia" per giocare${authHint}. Puoi anche scegliere una storia curata qui sotto per provare rapidamente <em>InfiPlot</em>. Fai clic su "Impostazioni" per inserire il tuo nome e configurare le tue chiavi di testo, immagine, visione e TTS—tutto salvato localmente nel tuo browser per un'esperienza più stabile.`;
    },
    closeAriaLabel: "Non mostrare più questo suggerimento",
  },
  'vi': {
    text: (params) => {
      const authHint = params.authEnabled ? ' (yêu cầu đăng nhập trong bản beta, chơi miễn phí)' : '';
      return `Nhập ý tưởng của bạn, cấu hình kiểu và nhấp "Bắt đầu" để chơi${authHint}. Bạn cũng có thể chọn một câu chuyện được chọn từ bên dưới để trải nghiệm nhanh <em>InfiPlot</em>. Nhấp "Cài đặt" để nhập tên của bạn và cấu hình khóa văn bản, hình ảnh, hình ảnh và TTS của riêng bạn—tất cả được lưu cục bộ trong trình duyệt của bạn để có trải nghiệm ổn định hơn.`;
    },
    closeAriaLabel: "Không còn hiển thị gợi ý này",
  },
  'th': {
    text: (params) => {
      const authHint = params.authEnabled ? ' (ต้องล็อกอินระหว่างเบต้า, เล่นฟรี)' : '';
      return `ป้อนแนวคิดของคุณ กำหนดค่าสไตล์ และคลิก "เริ่ม" เพื่อเล่น${authHint} คุณยังสามารถเลือกเรื่องราวที่คัดสรรจากด้านล่างเพื่อสัมผัส <em>InfiPlot</em> ได้อย่างรวดเร็ว คลิก "การตั้งค่า" เพื่อป้อนชื่อและกำหนดค่าคีย์ข้อความ รูปภาพ การมองเห็น และ TTS ของคุณเอง—ทั้งหมดจะถูกเก็บไว้ในเบราว์เซอร์ของคุณเพื่อประสบการณ์ที่มีเสถียรภาพมากขึ้น`;
    },
    closeAriaLabel: "ไม่แสดงคำแนะนำนี้อีก",
  },
  'id': {
    text: (params) => {
      const authHint = params.authEnabled ? ' (login diperlukan selama beta, main gratis)' : '';
      return `Masukkan ide Anda, konfigurasi gaya, dan klik "Mulai" untuk bermain${authHint}. Anda juga dapat memilih cerita kurasi dari bawah untuk pengalaman cepat <em>InfiPlot</em>. Klik "Pengaturan" untuk memasukkan nama Anda dan mengonfigurasi kunci teks, gambar, visi, dan TTS Anda sendiri—semua disimpan secara lokal di browser Anda untuk pengalaman yang lebih stabil.`;
    },
    closeAriaLabel: "Jangan tampilkan petunjuk ini lagi",
  },
  'tr': {
    text: (params) => {
      const authHint = params.authEnabled ? ' (beta sırasında giriş gerekli, ücretsiz oyun)' : '';
      return `Fikirlerinizi girin, stilleri yapılandırın ve oynamak için "Başlat"a tıklayın${authHint}. Aşağıdan küratörlü bir hikaye seçerek <em>InfiPlot</em>'ı hızlıca deneyimleyebilirsiniz. "Ayarlar"a tıklayarak adınızı girebilir ve kendi metin, resim, görü ve TTS anahtarlarınızı yapılandırabilirsiniz—tümü daha stabil bir deneyim için tarayıcınızda yerel olarak saklanır.`;
    },
    closeAriaLabel: "Bu ipucunu bir daha gösterme",
  },
  'pl': {
    text: (params) => {
      const authHint = params.authEnabled ? ' (wymagane logowanie podczas beta, darmowa gra)' : '';
      return `Wprowadź swoje pomysły, skonfiguruj style i kliknij "Rozpocznij", aby zagrać${authHint}. Możesz także wybrać kuratorską historię z dołu, aby szybko doświadczyć <em>InfiPlot</em>. Kliknij "Ustawienia", aby wprowadzić swoje imię i skonfigurować własne klucze tekstu, obrazu, widoku i TTS—wszystko przechowywane lokalnie w twojej przeglądarce dla bardziej stabilnego doświadczenia.`;
    },
    closeAriaLabel: "Nie pokazuj więcej tej podpowiedzi",
  },
  'nl': {
    text: (params) => {
      const authHint = params.authEnabled ? ' (inloggen vereist tijdens beta, gratis spelen)' : '';
      return `Voer je ideeën in, configureer stijlen en klik op "Starten" om te spelen${authHint}. Je kunt ook een gecureerd verhaal onderaan kiezen om <em>InfiPlot</em> snel te ervaren. Klik op "Instellingen" om je naam in te voeren en je eigen tekst-, afbeeldings-, visie- en TTS-sleutels te configureren—alles lokaal in je browser opgeslagen voor een stabielere ervaring.`;
    },
    closeAriaLabel: "Deze hint niet meer weergeven",
  },
  'uk': {
    text: (params) => {
      const authHint = params.authEnabled ? ' (вхід потрібен під час бета-тестування, безкоштовна гра)' : '';
      return `Введіть свої ідеї, налаштуйте стилі та натисніть "Почати" для гри${authHint}. Ви також можете обрати вибрану історію знизу, щоб швидко випробувати <em>InfiPlot</em>. Натисніть "Налаштування", щоб ввести своє ім'я та налаштувати власні ключі тексту, зображення, зору та TTS—все зберігається локально у вашому браузері для стабільнішого досвіду.`;
    },
    closeAriaLabel: "Більше не показувати цю підказку",
  },
  'hi': {
    text: (params) => {
      const authHint = params.authEnabled ? ' (बीटा के दौरान लॉगिन आवश्यक, मुफ्त खेल)' : '';
      return `अपने विचार दर्ज करें, शैलियों को कॉन्फ़िगर करें और खेलने के लिए "शुरू" क्लिक करें${authHint}। आप नीचे से एक क्यूरेटेड कहानी चुनकर <em>InfiPlot</em> का तेजी से अनुभव भी कर सकते हैं। "सेटिंग्स" पर क्लिक करें अपना नाम दर्ज करने और अपनी टेक्स्ट, इमेज, विजन और TTS कुंजियों को कॉन्फ़िगर करने के लिए—सब कुछ अधिक स्थिर अनुभव के लिए आपके ब्राउज़र में स्थानीय रूप से संग्रहीत है।`;
    },
    closeAriaLabel: "यह संकेत फिर न दिखाएं",
  },
  'cs': {
    text: (params) => {
      const authHint = params.authEnabled ? ' (během bety vyžadováno přihlášení, hra zdarma)' : '';
      return `Zadejte své nápady, nakonfigurujte styly a klikněte na "Spustit" pro hraní${authHint}. Můžete si také vybrat kurátorskou příběh z níže pro rychlé zážitky <em>InfiPlot</em>. Klikněte na "Nastavení" pro zadání vašeho jména a konfiguraci vlastních klíčů pro text, obrázky, vizi a TTS—vše uloženo lokálně ve vašem prohlížeči pro stabilnější zážitek.`;
    },
    closeAriaLabel: "Znovu nezobrazovat tuto nápovědu",
  },
};

// Target locales
const targetLocales = [
  'zh-TW', 'zh-HK', 'ja', 'ko', 'es', 'fr', 'de', 'pt-BR', 'pt', 'ru',
  'it', 'vi', 'th', 'id', 'tr', 'pl', 'nl', 'uk', 'hi', 'cs'
];

function fixHintText(content, locale) {
  const translation = hintTranslations[locale];
  if (!translation) return null;

  // Pattern handles both hint: { and "hint": { (quoted keys)
  // The ICU syntax can be {authEnabled...} or {{authEnabled...}}
  const textPattern = /"text":\s*"[^"]*\{?authEnabled/;

  // Build the replacement - handle both quoted and unquoted keys
  const usesQuotedKeys = content.includes('"hint":');
  const hintKey = usesQuotedKeys ? '"hint"' : 'hint';
  const textKey = usesQuotedKeys ? '"text"' : 'text';
  const closeLabelKey = usesQuotedKeys ? '"closeAriaLabel"' : 'closeAriaLabel';

  const replacement = `${hintKey}: {
      ${textKey}: ${translation.text.toString().replace(/\n/g, '\n      ')},
      ${closeLabelKey}: "${translation.closeAriaLabel}"
    }`;

  // Check for ICU syntax first
  if (textPattern.test(content)) {
    // Replace the entire hint section with ICU syntax
    const fullHintPattern = /"hint":\s*\{[^}]*"text":\s*"[^"]*"[^}]*"closeAriaLabel":\s*"[^"]*"\s*\}/;
    return content.replace(fullHintPattern, replacement);
  }

  // Check for empty hint object
  const emptyHintPattern = /"hint":\s*\{\s*\}/;
  if (emptyHintPattern.test(content)) {
    console.log(`  Found empty hint object in ${locale}.ts, replacing`);
    return content.replace(emptyHintPattern, replacement);
  }

  console.log(`  No ICU syntax or empty hint found in ${locale}.ts`);
  return null;
}

let successCount = 0;
for (const locale of targetLocales) {
  try {
    const filePath = resolve(localesDir, `${locale}.ts`);
    const content = readFileSync(filePath, 'utf-8');
    const newContent = fixHintText(content, locale);

    if (newContent && newContent !== content) {
      writeFileSync(filePath, newContent);
      console.log(`✓ Fixed ${locale}.ts`);
      successCount++;
    } else if (!newContent) {
      console.log(`- Skipped ${locale}.ts (no ICU syntax found)`);
    }
  } catch (e) {
    console.error(`✗ Error updating ${locale}:`, e.message);
  }
}

console.log(`\nDone! Fixed ${successCount} locale files`);

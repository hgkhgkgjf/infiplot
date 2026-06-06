// Single source of truth for the home-page selector option sets. Kept as
// `as const` so each list also yields a literal-union type: the play-start
// UI (app/page.tsx) renders from the arrays, and the analytics schema
// (lib/analytics.ts) types its payload fields from the unions. That shared
// origin is what keeps the "content-free" events honest — an event field can
// only ever be one of these fixed labels, never free-form player text.

export const GENDERS = ["男性向", "女性向"] as const;

export const ART_STYLES = [
  "自动",
  "自定义风格",
  "京阿尼",
  "新海诚",
  "吉卜力",
  "3D 动画",
  "真实",
  "赛博朋克",
  "哥特",
  "废土",
  "像素风",
  "古典油画",
  "莫奈",
  "水彩",
  "水墨",
  "浮世绘",
  "彩铅",
  "手绘素描",
  "黑白漫画",
  "儿童绘本",
  "儿童涂鸦",
  "黏土手工",
] as const;

export const PLOT_STYLES = ["平铺直叙", "多线转折", "悬疑烧脑", "治愈日常"] as const;

export const PACINGS = ["慢热细腻", "紧凑爽快"] as const;

export type Gender = (typeof GENDERS)[number];
export type ArtStyle = (typeof ART_STYLES)[number];
export type PlotStyle = (typeof PLOT_STYLES)[number];
export type Pacing = (typeof PACINGS)[number];

export const STYLE_MAP: Record<string, string> = {
  "京阿尼": "Kyoto Animation anime style inspired by Beyond the Boundary and Sound Euphonium, precise thin line art with uniform weight, meticulous real-world architectural backgrounds with photographic accuracy, warm golden-hour lighting with soft bokeh and lens diffusion, iridescent color accents and crystalline light effects, delicate translucent gradients on hair and eyes, emotionally nuanced character expressions with subtle micro-expressions, rich ambient occlusion in indoor scenes.",
  "新海诚": "Makoto Shinkai anime style, ultra-detailed photorealistic backgrounds with simplified anime characters, dramatic crepuscular rays and lens flare, vivid saturated sky gradients from deep blue to golden amber, volumetric cloud rendering, wet surface reflections, anamorphic bokeh highlights, cinematic widescreen composition.",
  "吉卜力": "Studio Ghibli anime style inspired by Spirited Away and Howl's Moving Castle, hand-painted background art with lush visible brushstrokes, expansive skies with billowing cumulus clouds, warm earthy palette of moss green, ochre, and terracotta, gentle rounded character forms with expressive eyes, richly detailed natural environments with swaying grass and dappled light, a sense of magical wonder woven into everyday life.",
  "3D 动画": "Cinematic 3D animated film style, Pixar-quality rendering with subsurface scattering on skin, volumetric god rays through atmospheric particles, physically-based material shading, warm filmic color grading, shallow depth of field with soft bokeh, expressive stylized character proportions.",
  "真实": "Photorealistic cinematic style, natural lighting with soft directional key light, shallow depth of field with anamorphic bokeh, fine film grain texture, lifelike skin with pore-level detail and subsurface scattering, physically-based material rendering, subtle teal-and-orange color grading, 35mm lens perspective.",
  "赛博朋克": "Cyberpunk anime illustration, neon-soaked urban nightscape, dominant palette of electric cyan, hot magenta, and deep indigo, hard-edged cel shading with sharp specular highlights, holographic signage reflections on wet asphalt, dense atmospheric haze with volumetric neon glow, high contrast between deep shadows and vivid accent lighting.",
  "哥特": "Gothic romance illustration, dramatic Baroque chiaroscuro with deep shadow pools, cold moonlit rim lighting, muted palette of desaturated indigo, ash grey, and bone white, misty atmospheric perspective, ornate filigree and pointed-arch architectural details, melancholic and hauntingly beautiful mood.",
  "废土": "Post-apocalyptic landscape illustration, weathered rough textures with rust, corrosion, and cracked concrete, muted dusty palette of burnt sienna, olive drab, and ash grey, hazy amber god-ray lighting through particulate atmosphere, overgrown vegetation reclaiming ruins, desolate yet strangely serene atmosphere.",
  "像素风": "Pixel art illustration, crisp aliased edges with no anti-aliasing, limited 32-color palette with dithering for gradients, 16-bit era SNES aesthetic, clean tile-based composition, small carefully-placed specular highlights, retro video game atmosphere with warm CRT color warmth.",
  "古典油画": "Classical oil painting in the academic tradition, rich impasto brushwork with visible palette-knife texture, dramatic Rembrandt lighting with warm chiaroscuro, sfumato blending at subject edges, Renaissance triangular composition, deep glaze layers producing luminous amber and umber tones, museum-quality varnished finish.",
  "莫奈": "Impressionist painting in the style of Claude Monet, broken-color technique with visible dab brushstrokes, vibrant dappled sunlight filtering through foliage, complementary color shadows of lavender and cobalt, soft atmospheric perspective, plein-air natural palette of cerulean, viridian, and cadmium yellow, shimmering water reflections.",
  "水彩": "Watercolor illustration on cold-pressed paper, wet-on-wet washes with soft pigment bleeding at edges, visible paper grain texture through translucent layers, granulation in cerulean and burnt sienna passages, intentional white paper reserves as highlights, gentle pastel tones with occasional saturated accents, dreamy luminous atmosphere.",
  "水墨": "Traditional Chinese ink wash painting, expressive calligraphic brushstrokes with flying-white dry-brush texture (feibai), bold ink splashes contrasted with delicate fine-line detail, monochrome sumi ink with subtle indigo washes, expansive negative space evoking mist and void, sparse poetic composition following the principle of leave-blank (liu bai).",
  "浮世绘": "Ukiyo-e Japanese woodblock print style, bold sumi-ink outlines with variable line weight, flat color areas with subtle wood-grain texture from printing, limited palette of indigo, vermilion, and ochre with key-block black, bokashi gradient shading technique, washi paper texture, elegant compositional asymmetry.",
  "彩铅": "Colored pencil illustration on toned paper, fine directional hatching and cross-hatching strokes with visible pencil grain, burnished blending in highlight areas, warm cream paper tone showing through, soft layered color build-up from light to dark, delicate hand-drawn warmth with slight imperfections.",
  "手绘素描": "Hand-drawn graphite pencil sketch, varied pressure producing light construction lines to deep tonal shading, visible eraser marks and smudge blending, off-white sketchbook paper texture, loose gestural composition with intentionally unfinished edges, raw artistic immediacy.",
  "黑白漫画": "Black and white Japanese manga illustration, bold variable-weight ink outlines, extreme high-contrast with dense hatching and cross-hatching for tonal shading, screentone dot patterns for mid-tones, dramatic speed lines for motion, cinematic dynamic angles, stark chiaroscuro with no color gradients.",
  "儿童绘本": "Children's picture book illustration, soft rounded shapes with friendly proportions, bright warm gouache-like palette of primary colors, clean even-weight outline art, simple readable compositions with clear focal points, whimsical cheerful atmosphere with gentle humor, inviting and safe visual tone.",
  "儿童涂鸦": "Child's crayon and marker drawing style, naive unsteady strokes with wax-crayon texture, bold unmixed primary and secondary colors, cheerfully wrong perspective and scale, figures and objects floating freely on the page, scribbled sky and ground bands, playful uninhibited composition radiating pure joy.",
  "黏土手工": "Claymation stop-motion animation style, soft rounded sculpted forms with visible fingerprint impressions and slight hand-sculpted imperfections, matte polymer clay texture with subtle surface grain, warm diffused three-point lighting on miniature set, tilt-shift shallow depth of field, charming handmade craft atmosphere.",
};

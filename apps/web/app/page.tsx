import Link from "next/link";
import { PRESETS } from "@/lib/presets";
import { PresetCard } from "@/components/PresetCard";

const ORDINALS = ["Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ"];

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 md:px-16 pt-7 md:pt-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-[10px] smallcaps text-clay-700 font-medium">
            云梦
          </span>
          <span className="hairline w-10 hidden md:block" />
          <span className="text-[10px] smallcaps text-clay-500 hidden md:block">
            逐 · 帧 · 而 · 成
          </span>
        </div>
        <nav className="flex items-center gap-5 text-[10px] smallcaps text-clay-600">
          <a
            href="https://github.com"
            className="hover:text-clay-900 transition-colors"
          >
            GitHub
          </a>
          <span className="text-clay-300">·</span>
          <a href="#about" className="hover:text-clay-900 transition-colors">
            关于
          </a>
        </nav>
      </header>

      <section className="px-6 md:px-16 pt-20 md:pt-36 pb-20 md:pb-28">
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 md:col-span-7 animate-fade-in">
            <p className="text-[10px] smallcaps text-clay-500 mb-8">
              一场 · 开源 · 实验 · MMXXVI
            </p>
            <h1 className="font-serif font-light text-[56px] md:text-[104px] leading-[0.94] text-clay-900 tracking-tight">
              每<em className="italic font-light text-clay-600">一帧</em>
              <br />
              都于
              <br />
              <span className="text-ember-500 italic font-light">此刻</span>
              诞生。
            </h1>
            <p className="mt-10 md:mt-14 max-w-md font-serif text-lg md:text-xl text-clay-700 leading-[1.65]">
              云梦是一部视觉小说 — 场景、对话、选项，<em>整个</em>界面皆由 AI
              一帧一帧绘成。你点击。它落笔。故事铺展。
            </p>
          </div>

          <aside className="col-span-12 md:col-span-4 md:col-start-9 mt-8 md:mt-0 flex md:items-end">
            <div className="space-y-3">
              <div className="hairline w-12" />
              <p className="font-serif italic text-clay-600 text-base md:text-[17px] leading-relaxed max-w-[280px]">
                &ldquo;人不能两次踏入同一条河流。
              </p>
              <p className="font-serif italic text-clay-600 text-base md:text-[17px] leading-relaxed max-w-[280px]">
                你也不会两次走进同一个云梦。&rdquo;
              </p>
              <p className="text-[10px] smallcaps text-clay-500 pt-2">
                — 自述 · v0.1
              </p>
            </div>
          </aside>
        </div>
      </section>

      <div className="px-6 md:px-16">
        <div className="hairline-full w-full" />
      </div>

      <section className="px-6 md:px-16 pt-14 md:pt-20 pb-16 md:pb-24">
        <div className="flex items-baseline justify-between mb-8 md:mb-10">
          <h2 className="text-[10px] smallcaps text-clay-700 font-medium">
            四 扇 门
          </h2>
          <p className="text-[10px] smallcaps text-clay-500 hidden md:block">
            择 一 世 界 · 或 自 行 编 织
          </p>
        </div>

        <div className="grid grid-cols-1">
          {PRESETS.map((p, i) => (
            <PresetCard key={p.id} preset={p} ordinal={ORDINALS[i]!} />
          ))}

          <Link
            href="/new"
            className="group block w-full py-10 md:py-12 border-t border-b border-clay-900/10 hover:border-clay-900/35 transition-[border-color] duration-500"
          >
            <div className="flex items-baseline gap-6 md:gap-10">
              <span className="font-serif italic text-2xl md:text-3xl text-clay-400 group-hover:text-clay-700 transition-colors duration-500 w-8 shrink-0">
                {ORDINALS[3]}
              </span>
              <div className="flex-1 min-w-0">
                <h3 className="font-serif text-3xl md:text-4xl text-clay-900 leading-tight mb-2.5">
                  无 题
                </h3>
                <p className="text-sm text-clay-600 leading-relaxed max-w-md">
                  带来你自己的世界。用你自己的话讲述它。
                </p>
              </div>
              <span className="hidden md:flex items-center gap-3 text-[10px] tracking-[0.4em] text-clay-400 group-hover:text-ember-500 transition-colors duration-500 shrink-0 self-center">
                编 织
                <span className="w-7 h-px bg-current transition-all duration-500 group-hover:w-12" />
              </span>
            </div>
          </Link>
        </div>
      </section>

      <section
        id="about"
        className="px-6 md:px-16 pb-20 md:pb-28 grid grid-cols-12 gap-8"
      >
        <div className="col-span-12 md:col-span-3">
          <p className="text-[10px] smallcaps text-clay-500 mb-3">
            题 跋 · I
          </p>
          <p className="font-serif italic text-clay-700 text-base leading-relaxed">
            一场关于生成式叙事的小型开源实验。一键 Vercel 自建。
          </p>
        </div>
        <div className="col-span-12 md:col-span-3 md:col-start-5">
          <p className="text-[10px] smallcaps text-clay-500 mb-3">
            题 跋 · II
          </p>
          <ul className="font-serif text-clay-700 text-base leading-relaxed space-y-1">
            <li>文 · 大语言模型</li>
            <li>图 · 生成式渲染</li>
            <li>感知 · 视觉解读</li>
          </ul>
        </div>
        <div className="col-span-12 md:col-span-3 md:col-start-9">
          <p className="text-[10px] smallcaps text-clay-500 mb-3">
            题 跋 · III
          </p>
          <p className="font-serif italic text-clay-700 text-base leading-relaxed">
            三者各自独立配置 — 任何 OpenAI 兼容端点皆可。
          </p>
        </div>
      </section>

      <footer className="px-6 md:px-16 pb-10 mt-auto">
        <div className="hairline-full w-full mb-5" />
        <div className="flex items-center justify-between text-[10px] smallcaps text-clay-500">
          <span>MMXXVI</span>
          <span className="num">Ⅰ · Ⅰ</span>
        </div>
      </footer>
    </div>
  );
}

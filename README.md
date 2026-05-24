# 云梦

> An AI-driven visual novel where every frame — scenes, dialogue, choices — is rendered by an AI, one frame at a time. You click. It paints. The story unfolds.

---

## How it works

Each turn is three model calls:

```
[user clicks somewhere on the image]
        │
        ▼
1. Vision model    interprets the click against the visible UI
        │
        ▼
2. Text LLM        writes the next frame (narration, dialogue, choices)
        │
        ▼
3. Image model     renders the entire next UI screen — scene, dialogue,
                   buttons, all of it — as one painted frame
        │
        ▼
[new image is shown; repeat]
```

There is no traditional UI. There is only the image. The AI chooses the layout, the colors, the typography, the buttons. Pick "stick figure on grid paper" as your style and you'll get hand-drawn UI. Pick "cyberpunk noir" and you'll get neon HUDs. Whatever fits the world.

---

## One-click deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/yume&env=TEXT_BASE_URL,TEXT_API_KEY,TEXT_MODEL,IMAGE_BASE_URL,IMAGE_API_KEY,IMAGE_MODEL,VISION_BASE_URL,VISION_API_KEY,VISION_MODEL&envDescription=Three%20independently%20configurable%20providers.%20Any%20OpenAI-compatible%20endpoint%20works.&envLink=https://github.com/YOUR_USERNAME/yume%23environment-variables)

After deploy, set the nine environment variables (see below) in your Vercel project. That's it.

---

## Environment variables

Three providers, all independently configurable. Any OpenAI-compatible chat / image endpoint works (OpenAI, Anthropic via OpenAI-compat proxy, Gemini, OpenRouter, DeepSeek, local Ollama, …).

| Provider | Variables | Recommended |
|---|---|---|
| Text · story director | `TEXT_BASE_URL` `TEXT_API_KEY` `TEXT_MODEL` | `claude-opus-4-7` via Anthropic |
| Image · UI renderer   | `IMAGE_BASE_URL` `IMAGE_API_KEY` `IMAGE_MODEL` | `gpt-image-2` via OpenAI |
| Vision · click reader | `VISION_BASE_URL` `VISION_API_KEY` `VISION_MODEL` | `gemini-3-flash` via Google |

See `apps/web/.env.example` for the exact shape.

---

## Local development

Requires Node 20+ and pnpm 9+.

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
# fill in the nine env vars
pnpm dev
# open http://localhost:3000
```

---

## Project layout

```
yume/
├── apps/web/              Next.js 16 app — pages + API routes
└── packages/
    ├── types/             shared TypeScript types
    ├── ai-client/         unified OpenAI-compatible clients
    └── engine/            three-stage AI orchestration (open core)
```

`packages/engine` is the open core — pure TS, no Next.js or browser dependency. Import it directly to build your own visual-novel front-end (Tauri, Electron, CLI, anywhere).

---

## Cost & limits

Each turn costs roughly **\$0.15–0.25** in API fees with the recommended model trio. A 30-turn session is **\~\$5–8**. There is no rate limiting or auth out of the box — if you make your deployment public, your bill will reflect that. Add limits before sharing widely.

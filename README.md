# LetsEat 🍽️☀️⛈️

### The privacy-first, context-aware culinary concierge for travelers

> Tell it a city and it tells you the right thing to eat **right now** — tuned to the live weather, the local time, and your taste — and grounds it in live search so recommendations stay tied to the real world.

---

## Problem

Traditional dining apps treat every recommendation the same, regardless of reality. Land in a new city on a sweltering 38°C afternoon and a generic engine still pushes a steaming bowl of ramen because it has high ratings — a miserable, mismatched experience. Worse, generic AI chatbots hallucinate: they confidently recommend restaurants that closed years ago, invent menus, or send you somewhere that isn't even in your city. For a traveler with limited time, a bad recommendation is a wasted experience.

## Solution

LetsEat synthesizes **real-time weather, local time, and your personal taste** to recommend the perfect meal for *this* moment — search-grounded to REDUCE hallucination.

- **Live context:** fetches real-time weather and local time for the resolved location.
- **Dynamic shifting:** in extreme heat it filters out heavy, boiling dishes and favors refreshing options; it respects time of day (no dinner stew at breakfast).
- **Search-grounded:** it is search-grounded to REDUCE hallucination.
- **Curated + verified picks:** the first pick is a personalized suggestion fit to the traveler's learned taste profile. Picks 2 and 3 are popular local search hits. Each pick is cross-checked against grounding sources and carries an `isVerified` flag.
- **Quiet personalization:** as you save dishes, the app silently refines a taste profile (adventurousness, meal weight, flavor affinities) — no surveys.

---

## Architecture

The core is a hand-built multi-agent framework. Each agent runs on the model best suited to its task, rather than routing everything through one premium model.

```
POST /api/recommend
  -> HTTP input filter (regex, max length)
  -> get real-time weather + location (Open-Meteo via MCP server)
  -> Promise.all:
       Agent 1 (Security)  : NVIDIA Llama 3.1 -> Gemini -> regex heuristic (fails closed)
       Agent 2 (Context)   : HuggingFace Qwen 2.5 -> Gemini -> basic summary
  -> if Agent 1 = MALICIOUS: reject (pipeline halts here)
  -> Agent 3 (Concierge): Gemini 2.5 Flash + Google Search grounding
       - pick 1 = personalized (fit to the traveler's learned taste profile)
       - picks 2-3 = popular local search hits
       - each pick cross-checked against grounding sources -> isVerified flag
       - fallback: Wikipedia RAG + NVIDIA / HuggingFace (isVerified = false)
  -> typed JSON -> UI
```

Agents 1 and 2 are independent and run **in parallel** via `Promise.all`; Agent 3 waits for both, and the pipeline **halts before Agent 3 if the security check flags an injection**.

**MCP server:** a real implementation (`server/mcp/weather-server.ts`) built with `@modelcontextprotocol/sdk` and Zod-validated schemas, exposing a `get_weather_for_location` tool backed by the Open-Meteo API — so the agents know the actual temperature, conditions, and local time before recommending anything.

---

## Setup

### Prerequisites
- Node.js v18+
- A Gemini API key (free tier works)

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Add your GEMINI_API_KEY to .env
# Optionally add NVIDIA_API_KEY and HF_TOKEN to enable expertise routing
# (without them, all agents fall back to Gemini)

# 3. Start the dev server
npm run dev
# App available at http://localhost:3000
```

> **Geolocation note:** "Use my location" requires the app to be served over HTTPS (or localhost) for the browser to grant access. Reverse-geocoding is handled client-side; the resolved city is sent to the backend, where the MCP server fetches live weather for it.

---

## Deployment

### Docker

```bash
# Build the Docker image
docker build -t letseat .

# Run the container (replace your_key with actual key)
docker run -p 3000:3000 -e GEMINI_API_KEY=your_key letseat
```

### Google AI Studio

You can run and deploy this application directly within Google AI Studio:
1. Open this repository in Google AI Studio.
2. Provide your required environment variables (like `GEMINI_API_KEY`) via the platform's Secret Manager or Settings UI.
3. Click "Deploy" to easily launch this application to a Google Cloud Run instance.
4. Optionally, you can preview the app via the interactive preview pane.

---

## Security & Privacy

- **Two-layer prompt-injection defense:** an HTTP-layer input filter blocks dangerous characters before anything runs, then Agent 1 performs a model-based SAFE/MALICIOUS check. The pipeline **fails closed** — if checks are unavailable, a regex heuristic still blocks obvious injection, and unknown errors block rather than pass.
- **Server-side keys only:** all AI calls happen server-side; no keys are ever exposed to the browser.
- **Abuse protection:** the `/api/recommend` endpoint is rate-limited (20 requests per 15 minutes per IP via `express-rate-limit`) and all requests are logged with `morgan`, mitigating spam, scraping, and quota-exhaustion attacks.
- **Anonymous identity + database-enforced isolation:** each device gets a **Firebase Anonymous Authentication** UID (no signup, no login wall). Stored data is tagged with that UID, and **Firestore security rules enforce that a device can only ever read its own data** — isolation lives at the database layer, not just in application code.

> Note: `firebase-applet-config.json` is **committed to this repo intentionally**. It is a public Firebase Web SDK config (these values ship in the browser bundle to every visitor), so it is safe to expose by design — data access is enforced by `firestore.rules`, not by keeping this config secret. This is not a server credential and contains no private key.

---

## Resilience: graceful degradation

Every routed agent has a fallback chain, so the app stays available even when a model is down or rate-limited:

- **Security:** NVIDIA → Gemini → regex heuristic (fail-secure)
- **Context:** HuggingFace → Gemini → basic weather context
- **Concierge:** Gemini + search → open-source RAG (Wikipedia context + NVIDIA Llama, then HuggingFace Qwen) → graceful degraded response

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Tailwind CSS v4 + Vite |
| Backend | Express + TypeScript (`tsx` / `esbuild`) |
| Security agent | NVIDIA NIM Llama 3.1 8B |
| Context agent | HuggingFace Qwen 2.5 7B |
| Concierge agent | Google Gemini 2.5 Flash (Google Search grounding) |
| MCP | `@modelcontextprotocol/sdk` + Open-Meteo |
| Data | Firebase Firestore (anonymous-auth, rules-isolated) |

---

## Demo Mode

To run a quick UI/flow demonstration without any API keys, run the app with `DEMO_MODE=true`.

When Demo Mode is active:
- The server will run with **zero API keys** (Gemini, NVIDIA, HuggingFace, etc. are not called).
- The multi-agent pipeline is completely bypassed.
- The UI will return templated, city-specific sample data and display a persistent "DEMO MODE" banner to indicate it is not live AI data.

**Via npm:**
```bash
export DEMO_MODE=true
npm run dev
```

**Via Docker:**
```bash
docker run -p 3000:3000 -e DEMO_MODE=true letseat
```

---

## Roadmap

See [ROADMAP.md](ROADMAP.md) for where the product is going — location-first launch, silently-inferred mood, progressive taste profiling, companion mode, and food itineraries, all built on a privacy-first foundation.

## License

MIT — see [LICENSE](LICENSE).

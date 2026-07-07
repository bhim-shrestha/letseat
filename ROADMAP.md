# LetsEat — Product Roadmap

> **Our promise:** the best local food for *you*, at *this* moment — with your personal data staying yours.

LetsEat is a privacy-first culinary concierge. You arrive somewhere unfamiliar, open the app, and it already understands enough — where you are, the time, the weather, the kind of traveler you are — to show you what to eat *right now*, and how to get it. No forms to fill, no decisions to agonize over, no tourist traps. Just the right food, with trust built into every layer.

This roadmap describes where the product is going. It is organized around one principle: **earn trust first, then remove every ounce of friction.**

---

## Guiding principles

1. **Trust before personalization.** Personalization is only valuable if people feel safe. Every signal we learn about a user is something they own, can see, and can delete. We never need — and never want — data a user hasn't consented to share.
2. **The app does the work; the user does almost nothing.** Input is the last resort, not the first. The default experience requires zero typing and zero questionnaires.
3. **No disappointment.** Recommendations are verified against real-world data — real dishes, real places — and respect the user's budget and dietary needs.
4. **Different people, different answers.** Two people in the same city at the same time should get different recommendations, because they *are* different.

---

## Where LetsEat is today (v1)

The core engine is built and working:

- **Real-time context:** live weather + local time + resolved location drive every recommendation.
- **Curated + verified picks:** each query returns three recommendations — one AI-curated "local secret" (an off-the-menu or insider pick tuned to the user's diet and the weather), plus two search-grounded local favorites.
- **Multi-agent pipeline:** specialized agents handle security, context, and recommendation, each on the model best suited to its job, with graceful fallbacks.
- **Quiet taste learning:** as a user saves dishes, the app silently refines a taste profile (adventurousness, meal weight, flavor affinities) — no surveys.
- **Privacy by design:** anonymous per-device identity; each device can only ever read its own history, enforced at the database layer.

v1 today is driven by a search box. The roadmap below evolves it toward a zero-input, location-first experience.

---

## Roadmap

### Near term — remove the friction

- **Location-first launch.** Open the app and it detects where you are (precise location when granted, network location otherwise). The manual city entry becomes a fallback, not the starting point.
- **A personalized feed.** Replace the single-query result with a scrollable, curated feed of moment-appropriate local food, so discovery feels effortless rather than transactional.
- **Mood, inferred silently.** Mood shapes what we crave — comfort food when we're low, something celebratory when we're not. The app infers a likely mood from context and interaction patterns (time, weather, pace of browsing) and gently adjusts recommendations, with a confidence threshold. A single optional tap appears *only* when confidence is genuinely low. No mood questionnaires.

### Mid term — get it right faster

- **Progressive taste profiling.** Start every new user from a sensible, context-based starting point and refine continuously from real behavior. Each interaction sharpens the picture; accuracy compounds over time without ever interrupting the user.
- **"People like you" signal.** Use anonymized, aggregated patterns ("travelers with similar tastes loved this here") to make first-session recommendations strong even before the app knows someone well — without exposing any individual's data.
- **Optional 3-tap calibration.** For users who *want* faster accuracy, a skippable, delightful onboarding that visibly unlocks a sharper feed — framed as a reward, never a gate.
- **Bookable & in budget.** Every recommendation becomes actionable: reserve, order, or navigate in a tap, with results that respect the user's price range.

### Longer term — beyond the solo meal

- **Companion mode.** Blend the tastes of two or more people into a single recommendation or venue that satisfies everyone — for couples, families, and groups eating together.
- **Food itineraries.** Generate a sequence of stops — a self-guided local food crawl — for travelers who want to taste more of a place in the time they have.

---

### Parking lot (Future Ideas)

- **Local social feed.** A stream of real food posts and images from locals, planned for a later release.

## Privacy commitments (non-negotiable)

These hold at every stage above:

- Personalization data stays **user-owned**: visible, exportable, and deletable.
- We use only data the user has **consented** to share or generates by using the app. We do not acquire external data about a person from third parties.
- Sensitive inference (such as mood) is **opt-in** and explained in plain language.
- Access to any stored data is enforced at the **database layer**, not just in application code.

If a future feature ever conflicts with these commitments, the commitments win.

import express from "express";
import rateLimit from "express-rate-limit";
import { getRealTimeWeatherAndLocation } from "./services/weather.js";
import { getFoodRecommendations } from "./services/ai.js";
import { buildDemoResponse } from "./demo/sampleData.js";
import { isQuotaOrRateLimitError } from "./utils/errors.js";

export const apiRouter = express.Router();

// --- Rate Limiting Middleware ---
const recommendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20, // Limit each IP to 20 requests per `window` (here, per 15 minutes)
  standardHeaders: "draft-7", // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: { error: "Too many requests from this IP, please try again after 15 minutes." }
});

// --- In-Memory Cache (Alleviates AI Quota) ---
const recommendationCache = new Map<string, { data: any, timestamp: number }>();
const inFlightRequests = new Map<string, Promise<any>>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour
const MAX_CACHE_ENTRIES = 500; // Bound memory under high traffic: cap distinct cached combos

// Store a recommendation while enforcing MAX_CACHE_ENTRIES via FIFO eviction.
// A JS Map preserves insertion order, so the first key is the oldest.
function cacheRecommendation(key: string, data: any) {
  while (recommendationCache.size >= MAX_CACHE_ENTRIES && !recommendationCache.has(key)) {
    const oldestKey = recommendationCache.keys().next().value;
    if (oldestKey === undefined) break;
    recommendationCache.delete(oldestKey);
  }
  recommendationCache.set(key, { data, timestamp: Date.now() });
}

apiRouter.post("/recommend", recommendLimiter, async (req, res) => {
  try {
    const { city, preferences, userId, learnedProfile } = req.body;
    if (!city || typeof city !== "string") {
      return res.status(400).json({ error: "City is required." });
    }

    // --- DEMO MODE SHORT-CIRCUIT ---
    if (process.env.DEMO_MODE === 'true') {
      console.log(`Serving DEMO MODE response for ${city}`);
      return res.json(buildDemoResponse(city, preferences));
    }

    // --- API KEY CHECK ---
    if (!process.env.GEMINI_API_KEY) {
      return res.status(401).json({ error: "Set GEMINI_API_KEY or run with DEMO_MODE=true" });
    }

    // --- SECURITY: Input Validation & Sanitization ---
    const sanitizedCity = city.trim();
    if (sanitizedCity.length > 50) {
      return res.status(400).json({ error: "City name is too long. Please keep it under 50 characters." });
    }
    
    // Block potentially malicious characters (e.g. script tags, brackets, weird symbols) commonly used in prompt injection
    if (/[<>{}[\]\\;/|!@#$%^&*_=+]/.test(sanitizedCity)) {
      return res.status(400).json({ error: "Invalid characters detected in the city name. Please use a standard city name." });
    }
    // -------------------------------------------------

    const cacheKey = sanitizedCity.toLowerCase() + 
                     (preferences ? "-" + JSON.stringify(preferences) : "") +
                     (learnedProfile ? "-" + JSON.stringify(learnedProfile) : "");

    // Fast-path: Return very recent cache (less than 60s old)
    const recentCache = recommendationCache.get(cacheKey);
    if (recentCache && Date.now() - recentCache.timestamp < 60 * 1000) {
      console.log(`Serving ${sanitizedCity} from fast-path cache (<60s).`);
      return res.json(recentCache.data);
    }

    // Deduplication: wait for in-flight request if exists
    if (inFlightRequests.has(cacheKey)) {
      console.log(`Waiting for in-flight request for ${sanitizedCity}...`);
      try {
        const data = await inFlightRequests.get(cacheKey);
        return res.json(data);
      } catch (err) {
        console.warn(`In-flight request failed, trying again or falling back...`);
      }
    }

    const fetchPipeline = async () => {
      // 1. Get weather and precise location and local time
      let resolvedCityName = sanitizedCity;
      let weatherInfo = "";
      try {
        let clientIp = req.ip;
        const weatherData = await getRealTimeWeatherAndLocation(sanitizedCity, clientIp);
        resolvedCityName = weatherData.resolvedCityName;
        weatherInfo = weatherData.weatherInfo;
      } catch (e: any) {
        if (e.status === 404) throw e;
        console.error("Weather fetch failed, continuing without weather context");
      }

      // 2. Fetch AI Recommendations via Gemini Search Grounding
      return await getFoodRecommendations(resolvedCityName, weatherInfo, preferences, learnedProfile);
    };

    try {
      const fetchPromise = fetchPipeline();
      inFlightRequests.set(cacheKey, fetchPromise);
      const data = await fetchPromise;
      
      // Save successful real-time fetch to cache (bounded via cacheRecommendation)
      cacheRecommendation(cacheKey, data);
      res.json(data);
    } catch (apiError: any) {
      console.log("Real-time AI fetch failed, checking cache...");
      
      const cached = recommendationCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`Real-time failed. Serving ${sanitizedCity} from cache.`);
        return res.json({ ...cached.data, weatherContext: cached.data.weatherContext + " [Note: cached due to high demand]" });
      }
      
      throw apiError;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  } catch (error: any) {
    const errStr = String(error?.message || "");
    
    // Status/Quota handling
    if (isQuotaOrRateLimitError(error) || errStr.includes("503") || errStr.includes("429")) {
      console.log("High demand/Quota exceeded encountered. Sending graceful error response to client.");
      return res.status(503).json({ error: "Our AI chefs are currently overwhelmed with orders! 🔥 (High Demand). Please wait a few moments and try again! 🍜🙏" });
    }

    console.error("API Route Error:", error);
    
    if (errStr.includes("pattern") || errStr.includes("schema")) {
      return res.status(500).json({ error: "Oops, the AI chef cooked up a slightly weird format! 😅 Please try hitting the search button again." });
    }
    
    if (error?.status === 404) {
      return res.status(404).json({ error: errStr });
    }
    
    res.status(500).json({ error: errStr || "Something went wrong fetching recommendations." });
  }
});

import React, { useState, useEffect, useRef } from "react";
import { auth, db } from "./firebaseClient";
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { collection, addDoc } from "firebase/firestore";
import { Search, MapPin, Heart, Sparkles, Compass, Flame, BookOpen, Trash2, Globe, Star, ChevronRight, Navigation, Users, Share2, MessageSquare, Camera, User } from "lucide-react";
import { ResultsDisplay, RecommendationResponse, FoodRecommendation } from "./components/ResultsDisplay";

interface SavedFood extends FoodRecommendation {
  city: string;
}

// --- Safe Storage Helper for Iframe Compatibility ---
const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn("localStorage access denied in iframe:", e);
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn("localStorage write denied in iframe:", e);
    }
  }
};

// --- App Configuration ---
const CONFIG = {
  adventureIncrement: 0.08,
  adventureDecrement: 0.04,
  minFavoritesThreshold: 2
};

// --- Implicit Preference Learning Types ---
interface LearnedProfile {
  adventureScore: number;       // 0.0 (always picks popular) to 1.0 (always picks hidden gems)
  favoriteCount: number;        // total items ever favorited
  weightCounts: { Light: number; Medium: number; Heavy: number };
  tasteTags: Record<string, number>;  // flavor keyword → save count
  lastUpdated: number;
}

// Keyword dictionary for taste tag extraction
const TASTE_KEYWORDS: Record<string, string[]> = {
  spicy:   ["spicy", "chili", "pepper", "hot", "fiery", "sriracha", "jalapeño", "curry", "paprika"],
  sweet:   ["sweet", "dessert", "cake", "sugar", "honey", "chocolate", "pastry", "candy", "syrup"],
  savory:  ["savory", "umami", "soy", "miso", "fermented", "aged", "broth", "dashi"],
  street:  ["street", "vendor", "stall", "market", "hawker", "cart", "roadside"],
  hearty:  ["hearty", "heavy", "rich", "stew", "braised", "roast", "fried", "grilled"],
  fresh:   ["fresh", "salad", "light", "raw", "crisp", "citrus", "herb", "greens"],
  seafood: ["seafood", "fish", "shrimp", "prawn", "crab", "lobster", "oyster", "clam"],
  noodle:  ["noodle", "pasta", "ramen", "pho", "udon", "soba", "vermicelli", "spaghetti"],
};

const defaultLearnedProfile = (): LearnedProfile => ({
  adventureScore: 0.5,
  favoriteCount: 0,
  weightCounts: { Light: 0, Medium: 0, Heavy: 0 },
  tasteTags: {},
  lastUpdated: Date.now(),
});

const loadLearnedProfile = (): LearnedProfile => {
  const stored = safeStorage.getItem("lets_eat_learned_prefs");
  if (!stored) return defaultLearnedProfile();
  try {
    const parsed = JSON.parse(stored);
    return {
      adventureScore: typeof parsed.adventureScore === "number" ? parsed.adventureScore : 0.5,
      favoriteCount: typeof parsed.favoriteCount === "number" ? parsed.favoriteCount : 0,
      weightCounts: parsed.weightCounts || { Light: 0, Medium: 0, Heavy: 0 },
      tasteTags: parsed.tasteTags || {},
      lastUpdated: parsed.lastUpdated || Date.now(),
    };
  } catch {
    return defaultLearnedProfile();
  }
};

const persistLearnedProfile = (lp: LearnedProfile): void => {
  safeStorage.setItem("lets_eat_learned_prefs", JSON.stringify(lp));
};

const extractTasteTags = (text: string): string[] => {
  const lower = text.toLowerCase();
  return Object.entries(TASTE_KEYWORDS)
    .filter(([, keywords]) => keywords.some(kw => lower.includes(kw)))
    .map(([tag]) => tag);
};

export default function App() {
  const [activeTab, setActiveTab] = useState<"explore" | "profile">("explore");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RecommendationResponse | null>(null);
  const [searchedCity, setSearchedCity] = useState("");
  const [loadingLoc, setLoadingLoc] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const searchInitiated = useRef(false);
  const inFlightRequestRef = useRef<{ location: string; promise: Promise<void> } | null>(null);

  // --- Unique Device/User Identifier for Privacy ---
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      }
    });

    signInAnonymously(auth).catch((error) => {
      console.error("Anonymous sign in failed", error);
    });

    return unsubscribe;
  }, []);

  // --- Traveler Culinary Profile ---
  const [profile, setProfile] = useState<{ diet: string; crave: string; adventure: string }>(() => {
    const stored = safeStorage.getItem("lets_eat_profile");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === "object" && typeof parsed.diet === "string") {
          return {
            diet: parsed.diet,
            crave: typeof parsed.crave === "string" ? parsed.crave : "Surprise Me",
            adventure: typeof parsed.adventure === "string" ? parsed.adventure : "Safe & Popular"
          };
        }
      } catch (e) {}
    }
    return { diet: "Anything Goes", crave: "Surprise Me", adventure: "Safe & Popular" };
  });

  // Learned preference profile — updated silently on every favorite action
  const [learnedProfile, setLearnedProfile] = useState<LearnedProfile>(() => loadLearnedProfile());

  // --- Personal Food Book (Local Storage Saved Picks) ---
  const [favorites, setFavorites] = useState<SavedFood[]>([]);

  // Load favorites & live feed on mount
  useEffect(() => {
    const stored = safeStorage.getItem("lets_eat_favorites");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setFavorites(parsed.filter(fav => fav && fav.name && typeof fav.name === "string"));
        } else {
          setFavorites([]);
        }
      } catch (e) {
        console.error("Failed to parse stored favorites", e);
        setFavorites([]);
      }
    }
  }, [userId]);

  const handleToggleFavorite = (item: FoodRecommendation) => {
    const isSaved = favorites.some((fav) => fav && fav.name === item.name);
    let updated: SavedFood[];

    if (isSaved) {
      // Unsaving: decrement count but don't reverse learned signals
      updated = favorites.filter((fav) => fav && fav.name !== item.name);
      const updatedLp: LearnedProfile = {
        ...learnedProfile,
        favoriteCount: Math.max(0, learnedProfile.favoriteCount - 1),
        lastUpdated: Date.now(),
      };
      setLearnedProfile(updatedLp);
      persistLearnedProfile(updatedLp);
    } else {
      // Saving: extract signals from this item and update the learned profile
      updated = [...favorites, { ...item, city: searchedCity || "Unspecified Location" }];

      const updatedLp: LearnedProfile = {
        ...learnedProfile,
        favoriteCount: learnedProfile.favoriteCount + 1,
        lastUpdated: Date.now(),
        weightCounts: { ...learnedProfile.weightCounts },
        tasteTags: { ...learnedProfile.tasteTags },
      };

      // Adventure signal: Local Secret (slot 0) = more adventurous, Popular (slot 1/2) = safer
      if (item.isSecretLocalFavorite) {
        updatedLp.adventureScore = Math.min(1.0, updatedLp.adventureScore + CONFIG.adventureIncrement);
      } else {
        updatedLp.adventureScore = Math.max(0.0, updatedLp.adventureScore - CONFIG.adventureDecrement);
      }

      // Weight preference signal
      const wKey = (item.weight || "").split(" ")[0] as keyof typeof updatedLp.weightCounts;
      if (wKey in updatedLp.weightCounts) {
        updatedLp.weightCounts[wKey] = (updatedLp.weightCounts[wKey] || 0) + 1;
      }

      // Taste tag signals extracted from food name + description + recipe
      const searchText = `${item.name} ${item.description || ""} ${item.recipe || ""}`;
      const tags = extractTasteTags(searchText);
      for (const tag of tags) {
        updatedLp.tasteTags[tag] = (updatedLp.tasteTags[tag] || 0) + 1;
      }

      setLearnedProfile(updatedLp);
      persistLearnedProfile(updatedLp);
    }

    setFavorites(updated);
    safeStorage.setItem("lets_eat_favorites", JSON.stringify(updated));
  };

  const isFavorited = (name: string) => {
    if (!name) return false;
    return favorites.some((fav) => fav && fav.name === name);
  };

  const saveProfile = (newProfile: typeof profile) => {
    setProfile(newProfile);
    safeStorage.setItem("lets_eat_profile", JSON.stringify(newProfile));
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!city.trim()) return;
    await fetchRecommendations(city.trim());
  };

  const fetchRecommendations = async (locationStr: string) => {
    if (!userId) return; // Wait until anonymous auth resolves
    if (inFlightRequestRef.current && inFlightRequestRef.current.location === locationStr) {
      return inFlightRequestRef.current.promise;
    }

    const requestPromise = (async () => {
      setLoading(true);
      setError(null);
      setData(null);
      setLoadingStep(0);
      setCity(locationStr);

      try {
        const response = await fetch("/api/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            city: locationStr, 
            preferences: profile, 
            learnedProfile: learnedProfile.favoriteCount >= CONFIG.minFavoritesThreshold ? learnedProfile : undefined, 
            userId 
          }),
        });

        const textData = await response.text();
        let resData;
        try {
          resData = JSON.parse(textData);
        } catch (e) {
          throw new Error("Received an invalid response from the server.");
        }

        if (!response.ok) throw new Error(resData?.error || "Failed to fetch data");

        setData(resData);
        setSearchedCity(locationStr);

        // Write to Firestore search_logs
        try {
          await addDoc(collection(db, "search_logs"), {
            userId,
            city: locationStr,
            weather: resData.weatherContext || "",
            timestamp: Date.now(),
            preferences: profile || null,
            response: resData
          });
        } catch (err) {
          console.error("Failed to write to search_logs:", err);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
        setLoadingStep(0);
      }
    })();

    inFlightRequestRef.current = { location: locationStr, promise: requestPromise };
    try {
      await requestPromise;
    } finally {
      if (inFlightRequestRef.current?.promise === requestPromise) {
        inFlightRequestRef.current = null;
      }
    }
  };

  useEffect(() => {
    if (!loading) {
      setLoadingStep(0);
      return;
    }
    const intervals = [
      setTimeout(() => setLoadingStep(1), 2000),
      setTimeout(() => setLoadingStep(2), 4500),
      setTimeout(() => setLoadingStep(3), 7500),
    ];
    return () => intervals.forEach(clearTimeout);
  }, [loading]);

  const loadingMessages = [
    "Locating authentic street markets and traditional eateries...",
    "Consulting with culinary guides and regional food experts...",
    "Translating local menus and specialty ingredients...",
    "Curating your perfect list of must-try dishes and local phrases..."
  ];

  const handleGetLocation = () => {
    try {
      if (!navigator || !navigator.geolocation) {
        setError("Geolocation is not supported by your browser.");
        return;
      }
      
      setLoadingLoc(true);
      setError(null);

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
            const geoData = await res.json();
            const detectedCity = geoData.city || geoData.locality || geoData.principalSubdivision;
            
            if (detectedCity) {
              setCity(detectedCity);
              setLoadingLoc(false);
              if (!searchInitiated.current) {
                searchInitiated.current = true;
                await fetchRecommendations(detectedCity);
              }
            } else {
              throw new Error("Could not detect city.");
            }
          } catch (err) {
            setError("Failed to determine location automatically. Please type your city.");
            setLoadingLoc(false);
          }
        },
        (error) => {
          console.error("Geolocation error:", error);
          setError("Location access denied. Please type your city.");
          setLoadingLoc(false);
        }
      );
    } catch (e: any) {
      console.warn("Geolocation security block or exception:", e);
      setError("Location access is restricted. Please type your city manually.");
      setLoadingLoc(false);
    }
  };

  const handleClear = () => {
    setData(null);
    setCity("");
    setSearchedCity("");
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-100 via-rose-50 to-amber-100 text-slate-800 font-sans selection:bg-orange-300 selection:text-orange-900 relative pb-16">
      {/* Anime Stylized Ambient Blobs */}
      <div className="absolute top-10 left-10 w-44 h-44 bg-orange-400/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-24 right-20 w-64 h-64 bg-rose-400/20 rounded-full blur-3xl pointer-events-none"></div>

      {/* Top Header & Tab Navigation */}
      <header className="w-full max-w-4xl mx-auto px-4 pt-6 flex flex-col md:flex-row gap-4 justify-between items-center border-b-2 border-orange-200/40 pb-4">
        <div className="flex items-center gap-2 cursor-pointer" onClick={handleClear}>
          <div className="p-2 bg-gradient-to-br from-orange-500 to-red-500 text-white rounded-xl shadow-md">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="font-black text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-orange-600 to-red-600">
            Traveler's Food Guide
          </span>
        </div>

        {/* Dynamic Tab Switcher */}
        <div className="flex flex-wrap justify-center gap-1 bg-white/60 backdrop-blur-md p-1 rounded-2xl border-2 border-orange-100 shadow-sm">
          <button
            onClick={() => setActiveTab("explore")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs md:text-sm font-black transition-all ${
              activeTab === "explore"
                ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md shadow-orange-200"
                : "text-slate-600 hover:text-orange-600"
            }`}
          >
            <Compass className="h-4 w-4" />
            <span>Explore</span>
          </button>
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs md:text-sm font-black transition-all ${
              activeTab === "profile"
                ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md shadow-orange-200"
                : "text-slate-600 hover:text-orange-600"
            }`}
          >
            <User className="h-4 w-4" />
            <span>Profile</span>
          </button>
        </div>
      </header>

      {activeTab === "explore" ? (
        <main className="px-4 py-8 md:py-16 max-w-4xl mx-auto flex flex-col items-center relative z-10 animate-in fade-in duration-300">
          {/* Main Title Banner */}
          <div className="text-center mb-8 max-w-2xl">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4 text-slate-800 leading-none">
              Find Authentic <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-600 to-red-500">Local Specialties</span>
            </h1>
            <p className="text-base md:text-lg text-slate-700 font-bold max-w-xl mx-auto leading-normal">
              Settle in and enjoy your journey. Leave finding the perfect local flavors to us.
            </p>
          </div>

          {/* Search bar form */}
          <form onSubmit={handleSearch} className="w-full max-w-xl relative group mb-6">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
              <MapPin className="h-6 w-6 text-orange-500 group-focus-within:text-red-500 transition-colors" />
            </div>
            <input
              type="text"
              className="block w-full pl-14 pr-44 py-4 bg-white/90 backdrop-blur-md border-4 border-white/60 rounded-[2rem] shadow-[0_8px_30px_rgb(255,165,0,0.08)] text-base md:text-lg font-black text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-orange-400 focus:bg-white transition-all"
              placeholder="e.g. Tokyo, Rome, Paris..."
              value={city}
              onChange={(e) => setCity(e.target.value)}
              disabled={loading}
            />
            <div className="absolute inset-y-2 right-2 flex items-center gap-2">
              <button
                type="button"
                onClick={handleGetLocation}
                disabled={loadingLoc || loading || !userId}
                title="Detect My Location"
                className="p-3 text-orange-500 hover:text-red-500 hover:bg-orange-50 rounded-2xl transition-all disabled:opacity-50"
              >
                {loadingLoc ? (
                  <span className="w-5 h-5 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin block" />
                ) : (
                  <Compass className="h-6 w-6" />
                )}
              </button>
              <button
                type="submit"
                disabled={loading || !city.trim() || !userId}
                className="flex items-center justify-center px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-black rounded-[1.25rem] hover:from-orange-600 hover:to-red-600 hover:shadow-lg hover:shadow-orange-400/30 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? (
                  <span className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Search className="h-5 w-5 mr-1.5" />
                    <span>Search</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Loading state with step tracker */}
          {loading && (
            <div className="mt-8 flex flex-col items-center animate-in fade-in duration-500">
              <div className="w-14 h-14 mb-4 bg-orange-100 text-orange-500 rounded-full flex items-center justify-center border-4 border-white shadow-xl animate-bounce">
                <Sparkles className="h-7 w-7" />
              </div>
              <p className="text-orange-950 font-black text-center backdrop-blur-md bg-white/70 px-6 py-4 rounded-[2rem] border-2 border-white/90 shadow-md max-w-sm">
                {loadingMessages[Math.min(loadingStep, loadingMessages.length - 1)]}
              </p>
            </div>
          )}

          {/* Error Message */}
          {!loading && error && (
            <div className="mt-8 bg-red-50/90 backdrop-blur-md text-red-600 px-6 py-4 rounded-2xl text-center w-full max-w-xl border-2 border-red-200 shadow-sm font-bold animate-in fade-in">
              Whoops! {error}
            </div>
          )}

          {/* Search Recommendations Results */}
          {!loading && data && (
            <div className="w-full flex flex-col items-center">
              <ResultsDisplay
                data={data}
                city={searchedCity}
                onToggleFavorite={handleToggleFavorite}
                isFavorited={isFavorited}
              />
              <button
                onClick={handleClear}
                className="mt-8 px-6 py-3 bg-white text-slate-600 hover:text-slate-800 rounded-2xl border-2 border-slate-200 font-bold transition-all hover:bg-slate-50 flex items-center gap-1 shadow-sm"
              >
                <span>Clear & Search Another City</span>
              </button>
            </div>
          )}

          {!loading && !data && (
            <div className="text-center mt-12 bg-white/40 border border-white/80 p-6 rounded-[2rem] max-w-md">
              <Sparkles className="h-8 w-8 text-orange-500 mx-auto mb-2" />
              <h3 className="font-black text-slate-800 text-base mb-1">Ready for your culinary adventure?</h3>
              <p className="text-xs text-slate-600 font-medium">Enter your travel destination above to search local street vendors, regional specialty bites, and ordering secrets!</p>
            </div>
          )}
        </main>
      ) : activeTab === "profile" ? (
        <main className="px-4 py-8 md:py-16 max-w-2xl mx-auto relative z-10 animate-in fade-in duration-300">
          <div className="text-center mb-8 max-w-xl mx-auto">
            <h1 className="text-3xl md:text-4xl font-black text-slate-800 mb-2">
              My <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-600 to-red-500">Dietary Profile</span>
            </h1>
            <p className="text-slate-600 font-bold text-sm leading-relaxed">
              Personalize your food recommendations. Our AI engine uses these preferences to dynamically filter and tailor the local street food and hidden gems for you.
            </p>
          </div>

          <div className="p-8 bg-white border-2 border-orange-100 rounded-[2rem] shadow-xl relative z-20 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-orange-100 rounded-full blur-3xl pointer-events-none opacity-50"></div>
            
            <div className="grid grid-cols-1 gap-6 relative">
              {/* Diet Selector */}
              <div>
                <label className="block text-sm font-black text-slate-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Flame className="w-5 h-5 text-orange-500" />
                  Diet & Allergies
                </label>
                <div className="relative">
                  <select
                    value={profile.diet}
                    onChange={(e) => saveProfile({ ...profile, diet: e.target.value })}
                    className="w-full pl-5 pr-12 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-base font-bold text-slate-700 focus:outline-none focus:border-orange-400 focus:bg-white transition-colors appearance-none shadow-sm cursor-pointer hover:border-orange-200"
                  >
                    <option value="Anything Goes">Anything Goes 🍽️</option>
                    <option value="Vegetarian">Vegetarian 🥦</option>
                    <option value="Vegan">Vegan 🌱</option>
                    <option value="Pescatarian">Pescatarian 🐟</option>
                    <option value="Halal">Halal ☪️</option>
                    <option value="Gluten-Free">Gluten-Free 🌾</option>
                    <option value="No Beef">No Beef 🚫🥩</option>
                    <option value="No Pork">No Pork 🚫🥓</option>
                    <option value="No Fish/Seafood">No Fish/Seafood 🚫🦐</option>
                    <option value="Nut Allergy">Nut Allergy 🚫🥜</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <ChevronRight className="w-5 h-5 text-slate-400 rotate-90" />
                  </div>
                </div>
                <p className="mt-3 text-xs font-semibold text-slate-500 leading-relaxed pl-1 border-l-2 border-orange-200 ml-1">
                  We will strictly filter recommendations to ensure they comply with your selection. "Anything Goes" provides the widest variety of local specialties.
                </p>
              </div>

              <div className="mt-8 pt-6 border-t-2 border-slate-100 flex flex-col items-center gap-4">
                <button
                  type="button"
                  onClick={() => setActiveTab("explore")}
                  className="px-8 py-3.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white text-sm font-black rounded-xl transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                >
                  Save Profile & Explore
                </button>
              </div>
            </div>
          </div>
        </main>
      ) : null}
    </div>
  );
}

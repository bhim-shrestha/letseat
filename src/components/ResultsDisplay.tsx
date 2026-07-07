import React, { useState, useEffect } from "react";
import { Loader2, MapPin, Sun, Star, Info, Heart, Flame, ChefHat, ExternalLink, Navigation, Wallet, Activity, Scale, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";

export interface FoodRecommendation {
  name: string;
  description: string;
  whyItFits: string;
  whereToBuyText: string;
  searchQuery: string;
  deliveryServiceName: string;
  recipe?: string;
  weight: string;
  calories: string;
  price: string;
  isSecretLocalFavorite: boolean;
  isVerified?: boolean;
  howToOrderLikeALocal: string;
  youtubeVideoId?: string;
  socialMediaSearchTerm?: string;
}

export interface RecommendationResponse {
  demoMode?: boolean;
  weatherContext: string;
  cityMeta?: {
    fullName: string;
    state: string;
    country: string;
    oneLiner: string;
  };
  recommendations: FoodRecommendation[];
}

interface ResultsDisplayProps {
  data: RecommendationResponse;
  city: string;
  onToggleFavorite: (item: FoodRecommendation) => void;
  isFavorited: (name: string) => boolean;
}

const RecommendationCard: React.FC<{ 
  item: FoodRecommendation; 
  index: number; 
  city: string; 
  onToggleFavorite: (item: FoodRecommendation) => void;
  isFavorited: (name: string) => boolean;
}> = ({ item, index, city, onToggleFavorite, isFavorited }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!item) return null;

  return (
    <div
      className={`group backdrop-blur-md rounded-[2rem] p-6 md:p-7 border-2 shadow-[0_8px_30px_rgb(255,165,0,0.15)] hover:shadow-[0_8px_30px_rgb(255,69,0,0.25)] transition-all duration-300 transform hover:-translate-y-1 relative ${
        (item.isSecretLocalFavorite ?? false)
          ? 'bg-gradient-to-b from-orange-50 to-white/95 border-orange-400 shadow-[0_0_40px_rgb(255,165,0,0.3)] hover:border-orange-500' 
          : 'bg-white/95 border-orange-100 hover:border-orange-300'
      }`}
      style={{ animationDelay: `${index * 150}ms` }}
    >
      {/* Top accent bar */}
      <div className={`absolute top-0 left-8 right-8 h-1.5 rounded-b-full opacity-60 group-hover:opacity-100 transition-opacity ${
        item.isSecretLocalFavorite ? 'bg-gradient-to-r from-orange-500 via-red-500 to-yellow-500' : 'bg-gradient-to-r from-orange-300 via-red-400 to-yellow-300'
      }`}></div>
      
      {item.isSecretLocalFavorite && (
        <div className="absolute -top-3 -right-2 bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg shadow-orange-300/50 text-xs font-black px-4 py-1.5 rounded-full transform rotate-3 flex items-center border-2 border-white z-10">
          <Star className="h-3 w-3 mr-1 fill-white" /> LOCAL SECRET!
        </div>
      )}

      {/* Header section (Always visible) */}
      <div 
        className="cursor-pointer md:cursor-auto" 
        onClick={() => {
          if (window.innerWidth < 768) {
            setIsExpanded(!isExpanded);
          }
        }}
      >
        <div className="flex justify-between items-center mb-3 pt-2">
          <h4 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight pr-4">{item.name}</h4>
          <div className="flex items-center gap-2 shrink-0">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(item);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black transition-all duration-300 border shadow-sm ${
                isFavorited(item.name)
                  ? 'bg-red-500 text-white border-red-600 hover:bg-red-600'
                  : 'bg-white text-orange-500 border-orange-200 hover:bg-orange-50'
              }`}
            >
              <Heart className={`h-3.5 w-3.5 ${isFavorited(item.name) ? 'fill-current' : ''}`} />
              <span>{isFavorited(item.name) ? 'Saved' : 'Save'}</span>
            </button>
            <button className="md:hidden text-orange-500 hover:bg-orange-100 p-1.5 rounded-full transition-colors flex-shrink-0">
              {isExpanded ? <ChevronUp className="h-6 w-6" /> : <ChevronDown className="h-6 w-6" />}
            </button>
          </div>
        </div>
        
        <p className="text-slate-700 leading-relaxed font-bold text-base md:text-lg mb-2 md:mb-6">
          {item.description}
        </p>
      </div>
      
      {/* Collapsible section (Hidden on mobile unless expanded, always block on md) */}
      <div className={`${isExpanded ? 'block' : 'hidden'} md:block mt-4 md:mt-0`}>
        {/* Badges for weight, calories, price */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="inline-flex items-center px-2.5 py-1 text-xs font-bold bg-slate-100 text-slate-600 rounded-lg">
            <Scale className="w-3 h-3 mr-1" /> {item.weight}
          </span>
          <span className="inline-flex items-center px-2.5 py-1 text-xs font-bold bg-slate-100 text-slate-600 rounded-lg">
            <Activity className="w-3 h-3 mr-1" /> {item.calories}
          </span>
          <span className="inline-flex items-center px-2.5 py-1 text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100/50 rounded-lg">
            <Wallet className="w-3 h-3 mr-1" /> {item.price}
          </span>
        </div>

        {item.howToOrderLikeALocal && item.howToOrderLikeALocal.trim() !== "" && (
          <div className="flex flex-col text-sm text-slate-700 bg-gradient-to-br from-purple-50/80 to-pink-50/80 p-4 rounded-3xl border border-purple-200/50 mb-6 group-hover:border-purple-300/60 transition-colors">
            <div className="flex items-center mb-2">
              <div className="bg-white p-1.5 rounded-xl shadow-sm mr-2 text-purple-500">
                <MessageSquare className="h-4 w-4" />
              </div>
              <strong className="text-purple-900 font-bold tracking-wide">How to order like a local</strong>
            </div>
            <span className="font-semibold px-1 text-purple-800">{item.howToOrderLikeALocal}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="flex flex-col text-sm text-slate-700 bg-gradient-to-br from-yellow-50/80 to-orange-50/80 p-4 rounded-3xl border border-yellow-200/50">
            <div className="flex items-center mb-2">
              <div className="bg-white p-1.5 rounded-xl shadow-sm mr-2 text-yellow-500">
                <Info className="h-4 w-4" />
              </div>
              <strong className="text-orange-900 font-bold tracking-wide">Why it fits</strong>
            </div>
            <span className="font-semibold px-1">{item.whyItFits}</span>
          </div>
          
          <div className="flex flex-col text-sm text-slate-700 bg-gradient-to-br from-orange-50/80 to-red-50/80 p-4 rounded-3xl border border-orange-200/50">
            <div className="flex items-center mb-2">
              <div className="bg-white p-1.5 rounded-xl shadow-sm mr-2 text-red-500">
                <MapPin className="h-4 w-4" />
              </div>
              <strong className="text-red-900 font-bold tracking-wide">Where to find it</strong>
            </div>
            <span className="font-semibold px-1">{item.whereToBuyText}</span>
          </div>
        </div>
        
        {/* Action Buttons Container */}
        <div className="flex flex-wrap gap-3 mt-2">
          <a 
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((item.searchQuery || item.name) + ' in ' + city)}`}
            target="_blank" rel="noopener noreferrer"
            className="flex flex-1 min-w-[140px] items-center justify-center px-4 py-3 bg-white text-slate-700 rounded-2xl hover:bg-slate-50 transition-colors border-2 border-slate-200 shadow-sm text-sm font-bold group/btn hover:border-orange-300"
          >
            <Navigation className="w-4 h-4 mr-2 text-blue-500 group-hover/btn:text-orange-500 transition-colors" /> 
            Maps / Directions
          </a>
          {(() => {
            const deliveryService = String(item.deliveryServiceName || "").trim();
            const deliveryServiceLower = deliveryService.toLowerCase();
            const isLocalOnly = !deliveryService || 
                                deliveryServiceLower.includes('local') || 
                                deliveryServiceLower.includes('street') || 
                                deliveryServiceLower.includes('dine') || 
                                deliveryServiceLower.includes('walk');
            const deliveryUrl = isLocalOnly 
              ? `https://www.google.com/search?q=${encodeURIComponent('Best ' + (item.searchQuery || item.name) + ' in ' + city)}`
              : `https://www.google.com/search?q=${encodeURIComponent('Order ' + (item.searchQuery || item.name) + ' ' + deliveryService + ' in ' + city)}`;
            const deliveryText = isLocalOnly
              ? "Find Best Spots"
              : `Find on ${deliveryService}`;
            
            return (
              <a 
                href={deliveryUrl}
                target="_blank" rel="noopener noreferrer"
                className="flex flex-1 min-w-[140px] items-center justify-center px-4 py-3 bg-gradient-to-r from-emerald-400 to-green-500 text-white rounded-2xl hover:from-emerald-500 hover:to-green-600 transition-all shadow-md text-sm font-bold shadow-emerald-200/50 hover:shadow-lg hover:-translate-y-0.5"
              >
                <ExternalLink className="w-4 h-4 mr-2" /> 
                {deliveryText}
              </a>
            );
          })()}
        </div>

        {/* Recipe Section */}
        {item.recipe && item.recipe.trim() !== "" && item.recipe.trim() !== "N/A" && (
          <div className="mt-6 flex flex-col text-sm text-slate-600 bg-gradient-to-br from-amber-50/50 to-orange-50/50 p-4 rounded-3xl border border-amber-200/50">
            <div className="flex items-center mb-2">
              <div className="bg-white p-1.5 rounded-xl shadow-sm mr-2 text-orange-500">
                <ChefHat className="h-4 w-4" />
              </div>
              <strong className="text-orange-900 font-bold tracking-wide">Key Ingredients</strong>
            </div>
            <span className="font-medium px-1 whitespace-pre-wrap leading-relaxed">{item.recipe}</span>
          </div>
        )}

      </div>
    </div>
  );
}

const ALLOWED_SOCIAL_DOMAINS = ["instagram.com", "tiktok.com", "youtube.com", "reddit.com", "x.com", "unsplash.com", "images.unsplash.com"];

function isAllowedUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return ALLOWED_SOCIAL_DOMAINS.some(d => hostname === d || hostname.endsWith("." + d));
  } catch {
    return false;
  }
}

export function ResultsDisplay({ data, city, onToggleFavorite, isFavorited }: ResultsDisplayProps) {
  if (!data) return null;
  const recommendations = Array.isArray(data.recommendations) ? data.recommendations : [];

  return (
    <div className="w-full max-w-2xl mx-auto mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out z-10 relative">
      {data.demoMode && (
        <div className="mb-6 p-4 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-[2rem] shadow-lg text-white font-black text-center flex items-center justify-center gap-2">
          <Info className="h-5 w-5" />
          DEMO MODE — sample data, not live AI
        </div>
      )}

      {data.cityMeta && (
        <div className="mb-6 p-6 bg-gradient-to-br from-orange-500/10 via-red-500/5 to-transparent rounded-[2rem] border-2 border-orange-100 shadow-md backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-200/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-black uppercase tracking-widest text-orange-600 flex items-center gap-1.5">
              <MapPin className="h-3 w-3" /> Culinary Destination Profile
            </span>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight leading-none my-1">
              {data.cityMeta.fullName}
            </h2>
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-black text-slate-500 mb-3 uppercase tracking-wide">
              {data.cityMeta.state && <span>{data.cityMeta.state}</span>}
              {data.cityMeta.state && data.cityMeta.country && <span>•</span>}
              {data.cityMeta.country && <span>{data.cityMeta.country}</span>}
            </div>
            <p className="text-slate-700 font-bold text-sm leading-relaxed border-l-4 border-orange-500 pl-3 py-1 bg-white/50 rounded-r-xl">
              {data.cityMeta.oneLiner}
            </p>
          </div>
        </div>
      )}

      <h3 className="text-2xl font-black text-slate-800 mb-6 flex items-center px-2">
        <ChefHat className="h-6 w-6 mr-3 text-orange-500 animate-pulse" />
        Must-Try Delicacies in {data.cityMeta?.fullName || city}
      </h3>

      <div className="space-y-6">
        {recommendations.length > 0 ? (
          recommendations.map((item, index) => (
            <RecommendationCard 
              key={index} 
              item={item} 
              index={index} 
              city={city} 
              onToggleFavorite={onToggleFavorite}
              isFavorited={isFavorited}
            />
          ))
        ) : (
          <div className="p-8 text-center bg-white/80 rounded-[2rem] border-2 border-orange-100">
            <p className="font-bold text-slate-600">No recommendations found for this city. Please try another search!</p>
          </div>
        )}
      </div>
    </div>
  );
}

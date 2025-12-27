import React, { useState, useEffect } from "react";
import Lottie from "lottie-react";

// Asset URLs provided by user
const ASSET_URLS = [
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68648b7f4ac37377589a671c/b3e65ba07_martini.txt",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68648b7f4ac37377589a671c/47784585d_shaker.txt",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68648b7f4ac37377589a671c/7223e82eb_jigger1.txt",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68648b7f4ac37377589a671c/ec8ddc50b_toast.txt",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68648b7f4ac37377589a671c/fb49338fc_punch.txt",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68648b7f4ac37377589a671c/ba7720015_bloody-mary.txt",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68648b7f4ac37377589a671c/79ac29e92_Sangria.txt",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68648b7f4ac37377589a671c/7900a5218_irish-coffeet.txt",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68648b7f4ac37377589a671c/392abafe3_whiskey.txt",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68648b7f4ac37377589a671c/8a0c09143_beverage.txt",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68648b7f4ac37377589a671c/ff3eac11a_cocktail4.txt",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68648b7f4ac37377589a671c/c2b1a8f45_cocktail3.txt"
];

/**
 * CocktailLoader Component
 * Fetches and plays a random Lottie animation from the provided URLs.
 * Now fully responsive to parent sizing via className.
 */
export const CocktailLoader = ({ className = "w-24 h-24", style = {} }) => {
  const [animationData, setAnimationData] = useState(null);

  useEffect(() => {
    const loadRandomAnimation = async () => {
      try {
        const randomUrl = ASSET_URLS[Math.floor(Math.random() * ASSET_URLS.length)];
        const response = await fetch(randomUrl);
        if (!response.ok) throw new Error("Failed to fetch animation");
        const data = await response.json();
        setAnimationData(data);
      } catch (error) {
        console.warn("CocktailLoader: Could not load animation", error);
      }
    };

    loadRandomAnimation();
  }, []);

  if (!animationData) {
    return (
      <div 
        className={`inline-flex items-center justify-center ${className}`}
        style={style}
      />
    );
  }

  return (
    <div className={`inline-flex items-center justify-center ${className}`} style={style}>
      <Lottie 
        animationData={animationData} 
        loop={true} 
        className="w-full h-full"
      />
    </div>
  );
};

export default CocktailLoader;
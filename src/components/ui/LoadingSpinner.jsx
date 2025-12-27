import React from "react";
// Import the default export of the new component
import CocktailLoader from "./CocktailLoader"; 

export default function LoadingSpinner({ className = "" }) {
  // Render the new randomized loader
  return <CocktailLoader className={className} />;
}
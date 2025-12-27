// Map glassware + drink type to generic icon keys
export const ICON_MAP = {
  glassware: {
    martini: "martini",
    coupe: "coupe",
    rocks: "old-fashioned",
    old_fashioned: "old-fashioned",
    collins: "highball",
    highball: "highball",
    flute: "flute",
    margarita: "margarita",
    wine: "wine",
    shot: "shot",
  },
  drink_type: {
    "old fashioned": "old-fashioned",
    "old-fashioned": "old-fashioned",
    margarita: "margarita",
    daiquiri: "coupe",
    martini: "martini",
    negroni: "old-fashioned",
    spritz: "spritz",
    mojito: "highball",
    tiki: "tiki",
    sour: "coupe",
  },
};

// Decide which icon key to use for a recipe
export function getIconKeyForRecipe(recipe) {
  const glass = (recipe.glassware || "").toLowerCase();
  const type = (recipe.style || recipe.category || "").toLowerCase();

  if (glass) {
    for (const [key, iconKey] of Object.entries(ICON_MAP.glassware)) {
      if (glass.includes(key)) return iconKey;
    }
  }

  if (type) {
    for (const [key, iconKey] of Object.entries(ICON_MAP.drink_type)) {
      if (type.includes(key)) return iconKey;
    }
  }

  return "generic";
}

export function buildIconPrompt(style, iconKey, recipe) {
  const safeStyle = style || "outline";
  const safeIconKey = iconKey || "generic";
  const baseLabel = safeIconKey.replace(/-/g, " ") || "cocktail";

  if (safeStyle === "minimal") {
    return `
Ultra-minimal single-weight line icon of a ${baseLabel} cocktail glass.
Modern UI icon style, centered in the frame.
Plain solid white background, no transparency, no checkerboard, no grid pattern.
No shading, no gradients, no textures, no text, no border.
`.trim();
  }

  // default: outline sketch
  return `
Clean black-and-white outline illustration of a ${baseLabel} cocktail glass.
Simple line drawing, minimal detail.
Plain solid white background, no transparency, no checkerboard, no grid pattern.
No shadows, no gradients, no textures, no text, no border.
`.trim();
}
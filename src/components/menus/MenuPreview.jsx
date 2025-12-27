import React from "react";

const fontFamilyMap = {
  modern:
    "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  classic: "'Playfair Display', 'Georgia', serif",
  elegant: "'Cormorant Garamond', 'Times New Roman', serif",
  rounded: "'Nunito', system-ui, sans-serif",
  typewriter: "'Courier Prime', 'Courier New', monospace",
  condensed: "'Oswald', 'Arial Narrow', sans-serif",
};

const fontSizeClassMap = {
  small: "text-sm",
  medium: "text-base",
  large: "text-lg",
};

export default function MenuPreview({ menu, recipes, designSettings }) {
  const settings = designSettings || {};
  const alignment = settings.alignment || "left";
  const columns = settings.columns || 1;
  const fontSizeClass = fontSizeClassMap[settings.font_size || "medium"];
  const fontFamily =
    fontFamilyMap[settings.font_family || "modern"] || fontFamilyMap.modern;

  const textAlignClass =
    alignment === "center"
      ? "text-center"
      : alignment === "right"
      ? "text-right"
      : "text-left";

  const showPrices = settings.show_prices !== false;
  const showDescriptions = settings.show_descriptions !== false;
  const showIngredients = !!settings.show_ingredients;
  const showIcons = !!settings.show_icons;

  const items = recipes || [];
  const itemsPerCol =
    columns === 2 ? Math.ceil(items.length / 2) : items.length;
  const col1 = items.slice(0, itemsPerCol);
  const col2 = columns === 2 ? items.slice(itemsPerCol) : [];

  const renderItem = (recipe) => (
    <div key={recipe.id} className="flex gap-3 py-2 border-b border-gray-100">
      {showIcons && (
        <div className="h-10 w-10 flex-shrink-0 flex items-center justify-center bg-white">
          {recipe.menu_icon_url ? (
            <img
              src={recipe.menu_icon_url}
              alt=""
              className="max-h-full max-w-full object-contain"
            />
          ) : null}
        </div>
      )}
      <div className={`flex-1 ${textAlignClass}`}>
        <div className="flex items-baseline justify-between gap-2">
          <span className={`font-semibold ${fontSizeClass}`}>
            {recipe.name}
          </span>
          {showPrices && recipe.menu_price != null && (
            <span className="text-sm">
              ${Number(recipe.menu_price).toFixed(2)}
            </span>
          )}
        </div>
        {showDescriptions && recipe.description && (
          <div className="text-xs text-gray-700 mt-0.5">
            {recipe.description}
          </div>
        )}
        {showIngredients && recipe.ingredients_summary && (
          <div className="text-[0.7rem] text-gray-500 mt-0.5">
            {recipe.ingredients_summary}
          </div>
        )}
      </div>
    </div>
  );

  // Simple width by page size
  const pageSize = settings.page_size || "8.5x11";
  const maxWidthMap = {
    "8.5x11": 8.5 * 96,
    "4.25x11": 4.25 * 96,
    "8.5x14": 8.5 * 96,
    "11x17": 11 * 96,
    "4x6": 4 * 96,
    "5x7": 5 * 96,
  };
  const maxWidth = maxWidthMap[pageSize] || 8.5 * 96;

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mx-auto"
      style={{ fontFamily, maxWidth }}
    >
      <div className={`mb-4 ${textAlignClass}`}>
        <h1 className="text-2xl font-bold">
          {menu.name || "Cocktail Menu"}
        </h1>
        {menu.description && (
          <p className="text-sm text-gray-600 mt-1">{menu.description}</p>
        )}
      </div>

      {columns === 1 ? (
        <div>{items.map(renderItem)}</div>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          <div>{col1.map(renderItem)}</div>
          <div>{col2.map(renderItem)}</div>
        </div>
      )}
    </div>
  );
}
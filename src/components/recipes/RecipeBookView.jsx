import React, { useEffect, useMemo, useRef, useState } from "react";
import HTMLFlipBook from "react-pageflip";
import { Button } from "@/components/ui/button";
import { X, Search, Leaf, Sun, CloudRain, Snowflake, Plus, Wine } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";

/* ============================================================
   STYLES
============================================================ */
const styles = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;1,400&family=Inter:wght@400;500;600&display=swap');

:root {
  --page-bg: #FDFBF7;
  --ink: #1a1a1a;
  --serif: 'Playfair Display', Georgia, serif;
  --sans: 'Inter', system-ui, sans-serif;
}

.rb-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0,0,0,0.95);
  display: flex; align-items: center; justify-content: center;
  padding: 0;
}

.rb-shell {
  width: 100%; height: 100%;
  position: relative;
  display: flex; 
  flex-direction: column;
  overflow: hidden;
}

/* HEADER TRIGGER ZONE
   This invisible box sits at the top 15% of the screen.
   Hovering THIS is what reveals the header now, not the whole screen.
*/
.rb-header-trigger {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 15vh; /* Top 15% of screen */
  z-index: 101;
  background: transparent;
}

/* HEADER */
.rb-header {
  position: absolute; top: 0; left: 0; right: 0;
  height: 80px;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 40px;
  background: rgba(0, 0, 0, 0.85); /* Slightly darker for contrast */
  backdrop-filter: blur(12px);
  z-index: 102; /* Above trigger */
  
  /* Hidden state */
  opacity: 0;
  transform: translateY(-100%);
  
  /* FAST TRANSITION for "Hide Sooner" feel */
  transition: transform 0.2s ease-out, opacity 0.2s ease-out;
  pointer-events: none; /* Let clicks pass through when hidden */
}

/* SHOW HEADER when hovering Trigger OR Header itself */
.rb-header-trigger:hover ~ .rb-header,
.rb-header:hover {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto; /* Re-enable clicks */
}

/* STAGE */
.rb-stage {
  flex: 1;
  width: 100%; height: 100%;
  display: flex; 
  align-items: center; 
  justify-content: center;
  overflow: hidden;
  padding: 20px;
}

/* PAGE STYLES */
.rb-page {
  background-color: var(--page-bg);
  box-shadow: inset 0 0 30px rgba(0,0,0,0.05);
  border-radius: 4px;
  overflow: hidden; 
}

.rb-page.left {
  background-image: linear-gradient(to right, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0) 10%);
  border-right: 1px solid rgba(0,0,0,0.1);
}
.rb-page.right {
  background-image: linear-gradient(to left, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0) 10%);
  border-left: 1px solid rgba(0,0,0,0.1);
}

.rb-content {
  padding: 40px 35px;
  height: 100%;
  display: flex; flex-direction: column;
  text-align: left;
}

/* PHOTO */
.rb-photo {
  width: 100%; 
  height: 300px;
  background: transparent;
  margin-bottom: 20px;
  position: relative;
  overflow: hidden;
  display: flex; 
  align-items: center; 
  justify-content: center;
  flex-shrink: 0;
}
.rb-photo img { 
  width: 100%; 
  height: 100%; 
  object-fit: cover;
  object-position: center center;
  border-radius: 8px;
  filter: drop-shadow(0 8px 16px rgba(0,0,0,0.15));
}

.rb-header-text { 
  text-align: left; 
  margin-bottom: 20px; 
  flex-shrink: 0; 
}
.rb-title {
  font-family: var(--serif); font-size: 28px; font-weight: 700;
  color: var(--ink); line-height: 1.15; margin-bottom: 8px;
}
.rb-desc {
  font-family: var(--serif); font-size: 13px; font-style: italic;
  color: rgba(0,0,0,0.6); line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* INGREDIENTS */
.rb-ing-list {
  flex: 1;
  overflow-y: auto; 
  border-top: 1px solid rgba(0,0,0,0.1);
  padding-top: 16px;
  min-height: 0;
}

.rb-ing-row {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px;
  align-items: baseline;
  padding: 6px 0; 
  border-bottom: 1px dashed rgba(0,0,0,0.05);
}
.rb-ing-row:last-child { border-bottom: none; }

.rb-ing-amt { 
  font-family: var(--sans); 
  font-weight: 600; 
  font-size: 13px; 
  color: var(--ink); 
  text-align: left; 
  white-space: nowrap; 
  min-width: 35px;
}
.rb-ing-name { 
  font-family: var(--sans); 
  font-size: 13px; 
  font-weight: 400;
  color: var(--ink); 
  text-align: left; 
  line-height: 1.4;
}

.rb-page-num {
  text-align: center; 
  font-family: var(--serif); 
  font-size: 11px; 
  color: #999; 
  margin-top: 12px; 
  flex-shrink: 0;
}

/* Controls */
.rb-controls { display: flex; gap: 16px; align-items: center; }
.rb-search { display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); padding: 8px 12px; border-radius: 6px; width: 300px; }
.rb-search input { background: transparent; border: none; outline: none; color: white; font-family: var(--sans); font-size: 14px; width: 100%; }
.rb-seasons { display: flex; gap: 4px; background: rgba(255,255,255,0.1); padding: 4px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2); }
.rb-season-btn { width: 32px; height: 32px; display: grid; place-items: center; border: none; background: transparent; color: rgba(255,255,255,0.5); cursor: pointer; border-radius: 4px; transition: all 0.2s; }
.rb-season-btn:hover { background: rgba(255,255,255,0.1); color: white; }
.rb-season-btn.active { background: white; color: black; }
.rb-folio-display { color: rgba(255,255,255,0.6); font-family: var(--sans); font-size: 13px; font-variant-numeric: tabular-nums; }
.rb-close { width: 40px; height: 40px; display: grid; place-items: center; background: rgba(255,255,255,0.1); border-radius: 50%; color: white; border: none; cursor: pointer; transition: background 0.2s; }
.rb-close:hover { background: rgba(255,255,255,0.2); }
.rb-select { position: absolute; top: 20px; right: 20px; z-index: 10; }
.rb-cta { position: absolute; bottom: 30px; z-index: 100; left: 50%; transform: translateX(-50%); animation: slideUp 0.3s ease-out; }
@keyframes slideUp { from { transform: translate(-50%, 20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
`;

// --- EXPANDED SEASONS KEYWORDS ---
const SEASONS = ["spring", "summer", "fall", "winter"];
const SEASON_KEYWORDS = {
  spring: [
    "spring", "elderflower", "cucumber", "floral", "gin", "herb", "green",
    "lavender", "mint", "pea", "rhubarb", "strawberry", "apricot", "cherry",
    "rose", "lillet", "blanc", "basil", "fennel", "grass", "dill", "vodka"
  ],
  summer: [
    "summer", "watermelon", "berry", "tiki", "rum", "frozen", "citrus", "spritz",
    "peach", "mango", "pineapple", "coconut", "tequila", "mezcal", "passion fruit",
    "lime", "grapefruit", "agave", "aperol", "campari", "cilantro", "jalapeno", "corn"
  ],
  fall: [
    "fall", "autumn", "spice", "pumpkin", "apple", "cinnamon", "whiskey", "maple",
    "pear", "fig", "sage", "rosemary", "cardamom", "clove", "cognac", "dark rum",
    "amaro", "ginger", "nutmeg", "chai", "cider", "brandy", "pecan", "walnut"
  ],
  winter: [
    "winter", "hot", "toddy", "cream", "nutmeg", "brandy", "stout", "egg",
    "chocolate", "coffee", "peppermint", "cranberry", "pomegranate", "star anise",
    "allspice", "bourbon", "scotch", "irish", "vanilla", "orange", "blood orange",
    "pine", "juniper", "port", "sherry", "stout"
  ]
};

function inferSeason(recipe) {
  const text = JSON.stringify(recipe).toLowerCase();
  for (const s of SEASONS) {
    if (SEASON_KEYWORDS[s].some(k => text.includes(k))) return s;
  }
  return null;
}

function recipeMatchesSeason(recipe, selectedSeasons) {
  if (!selectedSeasons.length) return true;
  const inferred = inferSeason(recipe);
  return selectedSeasons.includes(inferred);
}

const RecipePage = React.forwardRef(({ recipe, pageNum, isSelected, onToggle }, ref) => {
  const isRight = pageNum % 2 !== 0; 
  
  if (!recipe) {
    return (
      <div ref={ref} className={`rb-page ${isRight ? 'right' : 'left'}`}>
        <div className="rb-content flex items-center justify-center">
          <Wine className="w-16 h-16 text-gray-200 opacity-20" />
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className={`rb-page ${isRight ? 'right' : 'left'}`}>
      <div className="rb-select">
        <Checkbox checked={isSelected} onCheckedChange={() => onToggle(recipe.id)} />
      </div>

      <div className="rb-content">
        <div className="rb-photo">
          {recipe.image_url ? (
            <img src={recipe.image_url} alt={recipe.name} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
                <Wine className="w-12 h-12 opacity-20"/>
            </div>
          )}
        </div>

        <div className="rb-header-text">
          <h2 className="rb-title">{recipe.name}</h2>
          <p className="rb-desc">{recipe.description}</p>
        </div>

        <div className="rb-ing-list">
            {recipe.ingredients?.map((ing, i) => (
                <div key={i} className="rb-ing-row">
                <span className="rb-ing-amt">{ing.amount} {ing.unit}</span>
                <span className="rb-ing-name">{ing.ingredient_name}</span>
                </div>
            ))}
        </div>

        <div className="rb-page-num">{pageNum + 1}</div>
      </div>
    </div>
  );
});

export default function RecipeBookView({ recipes = [], onClose }) {
  const bookRef = useRef(null);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSeasons, setSelectedSeasons] = useState([]);
  const [selectedRecipes, setSelectedRecipes] = useState([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const [showMenuModal, setShowMenuModal] = useState(false);
  const [menus, setMenus] = useState([]);
  const [selectedMenuId, setSelectedMenuId] = useState("");
  const [newMenuName, setNewMenuName] = useState("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isAddingToMenu, setIsAddingToMenu] = useState(false);

  useEffect(() => {
    base44.entities.Menu.list().then(m => setMenus(m || [])).catch(console.error);
  }, []);

  // --- KEYBOARD NAVIGATION ---
  useEffect(() => {
    const handleKeyDown = (e) => {
        if (!bookRef.current) return;
        // The library exposes pageFlip() on the ref instance
        const flipInstance = bookRef.current.pageFlip(); 
        if (!flipInstance) return;

        if (e.key === "ArrowRight") {
            flipInstance.flipNext();
        } else if (e.key === "ArrowLeft") {
            flipInstance.flipPrev();
        } else if (e.key === "Escape") {
            onClose();
        }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const filteredRecipes = useMemo(() => {
    if (!recipes) return [];
    return recipes.filter(r => {
      const matchesSearch = !searchTerm || r.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSeason = recipeMatchesSeason(r, selectedSeasons);
      return matchesSearch && matchesSeason;
    });
  }, [recipes, searchTerm, selectedSeasons]);

  const toggleSeason = (s) => {
    setSelectedSeasons(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const handleAddToMenu = async () => {
    setIsAddingToMenu(true);
    try {
        let menuId = selectedMenuId;
        if(isCreatingNew && newMenuName) {
            const res = await base44.entities.Menu.create({ name: newMenuName, status: 'draft'});
            menuId = res.id;
        }
        if(menuId) {
            for(const rId of selectedRecipes) await base44.entities.Recipe.update(rId, { menu_id: menuId });
            setShowMenuModal(false); setSelectedRecipes([]);
        }
    } catch(e) { console.error(e); }
    finally { setIsAddingToMenu(false); }
  };

  const pages = filteredRecipes.map((r, i) => (
    <RecipePage 
        key={r.id} 
        recipe={r} 
        pageNum={i}
        isSelected={selectedRecipes.includes(r.id)}
        onToggle={(id) => setSelectedRecipes(prev => prev.includes(id) ? prev.filter(x => x!==id) : [...prev, id])}
    />
  ));

  if (filteredRecipes.length % 2 !== 0) {
      pages.push(<RecipePage key="blank-last" recipe={null} pageNum={filteredRecipes.length} />);
  }

  return (
    <div className="rb-overlay">
      <style>{styles}</style>

      <div className="rb-shell">
        {/* INVISIBLE TRIGGER ZONE (Top 15%) */}
        <div className="rb-header-trigger" />

        {/* HEADER (Appears on hover of trigger) */}
        <div className="rb-header">
          <div className="rb-controls">
            <div className="rb-search">
              <Search className="w-4 h-4 text-white opacity-70"/>
              <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search recipes..."/>
            </div>
            <div className="rb-seasons">
              {SEASONS.map(s => (
                <button key={s} className={`rb-season-btn ${selectedSeasons.includes(s) ? 'active' : ''}`} onClick={() => toggleSeason(s)}>
                  {s === 'spring' && <Leaf className="w-4 h-4"/>}
                  {s === 'summer' && <Sun className="w-4 h-4"/>}
                  {s === 'fall' && <CloudRain className="w-4 h-4"/>}
                  {s === 'winter' && <Snowflake className="w-4 h-4"/>}
                </button>
              ))}
            </div>
          </div>

          <div className="rb-folio-display">
            {filteredRecipes.length} Recipes
          </div>

          <button className="rb-close" onClick={onClose}><X className="w-6 h-6"/></button>
        </div>

        <div className="rb-stage">
          {pages.length > 0 ? (
            <HTMLFlipBook
                key={filteredRecipes.length + '-' + selectedSeasons.join('') + '-' + searchTerm}
                width={550} 
                height={820} 
                size="fixed"
                minWidth={300}
                maxWidth={700}
                minHeight={400}
                maxHeight={1000}
                maxShadowOpacity={0.5}
                showCover={false}
                mobileScrollSupport={true}
                onFlip={(e) => setCurrentPageIndex(e.data)}
                className="book-instance"
                ref={bookRef}
                /* Allow mouse wheel to flip */
                useMouseEvents={true}
            >
                {pages}
            </HTMLFlipBook>
          ) : (
            <div className="text-white opacity-50 flex flex-col items-center gap-4">
                <Wine className="w-16 h-16 opacity-50"/>
                <p>No recipes found matching your filters.</p>
                <Button variant="outline" onClick={() => { setSearchTerm(''); setSelectedSeasons([]); }} className="text-black">Clear Filters</Button>
            </div>
          )}

          {selectedRecipes.length > 0 && (
            <div className="rb-cta">
                <Button onClick={() => setShowMenuModal(true)} className="bg-blue-600 hover:bg-blue-700 shadow-xl rounded-full px-8 py-6 text-lg">
                    <Plus className="w-5 h-5 mr-2"/> Add {selectedRecipes.length} to Menu
                </Button>
            </div>
          )}
        </div>
      </div>

      <Dialog open={showMenuModal} onOpenChange={setShowMenuModal}>
        <DialogContent>
            <DialogHeader><DialogTitle>Add to Menu</DialogTitle></DialogHeader>
            <div className="py-4 space-y-4">
                <div className="flex items-center gap-2"><Checkbox checked={isCreatingNew} onCheckedChange={setIsCreatingNew}/><Label>Create New Menu</Label></div>
                {isCreatingNew ? <Input placeholder="Menu Name" value={newMenuName} onChange={e=>setNewMenuName(e.target.value)}/> : 
                <Select onValueChange={setSelectedMenuId}><SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger><SelectContent>{menus.map(m=><SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select>}
            </div>
            <DialogFooter><Button onClick={handleAddToMenu} disabled={isAddingToMenu}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
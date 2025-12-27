import React, { useState, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

export default function VisualBottleCounter({
  imageUrl,
  bottleLabel,
  bottleColors = [],
  onValueChange,
  currentValue,
  minFull = 0,
  maxFull = 999,
}) {
  const [level, setLevel] = useState(0);
  const [fullBottles, setFullBottles] = useState(0);

  useEffect(() => {
    const numeric = Number(currentValue);
    const val = Number.isFinite(numeric) ? numeric : 0;

    const full = Math.floor(val);
    const partial = val - full;

    setFullBottles(full);
    setLevel(Math.round(partial * 100));
  }, [currentValue]);

  const updateParent = (newFull, newLevel) => {
    const total = newFull + newLevel / 100;
    onValueChange?.(parseFloat(total.toFixed(2)));
  };

  const handleSliderChange = (vals) => {
    const newLevel = vals[0] ?? 0;
    const clamped = Math.max(0, Math.min(100, newLevel));
    setLevel(clamped);
    updateParent(fullBottles, clamped);
  };

  const handleFullBottleChange = (change) => {
    const newFull = Math.max(minFull, Math.min(maxFull, fullBottles + change));
    setFullBottles(newFull);
    updateParent(newFull, level);
  };

  const totalDisplay = (fullBottles + level / 100).toFixed(2);
  const partialDisplay = `.${level.toString().padStart(2, "0")}`;

  // SVG Bottle Path Definitions
  // ViewBox: 0 0 100 300
  const bottlePath = `
    M 35 5
    L 35 80
    Q 35 110 10 120
    L 10 290
    Q 10 300 20 300
    L 80 300
    Q 90 300 90 290
    L 90 120
    Q 65 110 65 80
    L 65 5
    Z
  `;

  // Calculate liquid height based on percentage
  // Total height is 300. 
  // We want 0% to be empty and 100% to be full (up to neck or so).
  // Let's say usable liquid height is from y=300 down to y=30 (270 units).
  const liquidHeight = (level / 100) * 290; 
  const liquidY = 300 - liquidHeight;

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold text-gray-900">Estimate Stock</h4>
        <div className="text-right">
          <span className="text-xs text-gray-500 uppercase tracking-wide">Total</span>
          <div className="text-2xl font-mono font-bold text-blue-600">
            {totalDisplay}
          </div>
        </div>
      </div>

      {/* MAIN BODY */}
      <div className="flex flex-col sm:flex-row gap-8 items-center justify-center">
        
        {/* BOTTLE VISUALIZATION */}
        <div className="relative h-72 w-32 flex items-end justify-center">
          
          {imageUrl ? (
            /* Real Bottle Image with Liquid Overlay */
            <>
              <img 
                src={imageUrl} 
                alt="Bottle"
                className="h-full w-auto object-contain relative z-0"
              />
              {/* Liquid overlay on actual image */}
              <div 
                className="absolute bottom-0 left-0 right-0 bg-blue-500 opacity-30 transition-all duration-100 ease-out pointer-events-none z-10"
                style={{ height: `${level}%` }}
              />
            </>
          ) : (
            /* SVG Bottle (fallback when no image) */
            <svg 
              width="100%" 
              height="100%" 
              viewBox="0 0 100 310" 
              className="drop-shadow-xl filter"
              style={{ overflow: 'visible' }}
            >
              <defs>
                <clipPath id="bottleClip">
                  <path d={bottlePath} />
                </clipPath>
              </defs>

              {/* Bottle Background */}
              <path 
                  d={bottlePath} 
                  fill="#f1f5f9"
                  stroke="#cbd5e1" 
                  strokeWidth="2"
              />

              {/* Liquid */}
              <rect
                x="0"
                y={liquidY}
                width="100"
                height={liquidHeight}
                fill="#3b82f6"
                fillOpacity="0.6"
                clipPath="url(#bottleClip)"
                className="transition-all duration-100 ease-out"
              />
              
              {/* Liquid Top Line (Meniscus) */}
              <line 
                  x1="0" y1={liquidY} x2="100" y2={liquidY} 
                  stroke="#2563eb" 
                  strokeWidth="2" 
                  clipPath="url(#bottleClip)"
                  className="transition-all duration-100 ease-out"
              />

              {/* Bottle Outline Overlay (for crisp edges) */}
              <path d={bottlePath} fill="none" stroke="#94a3b8" strokeWidth="3" />
              
              {/* Gloss/Highlight */}
              <path 
                  d="M 20 120 Q 20 280 25 290" 
                  stroke="white" 
                  strokeWidth="3" 
                  strokeOpacity="0.3" 
                  fill="none" 
              />
              <path 
                  d="M 40 10 L 40 70" 
                  stroke="white" 
                  strokeWidth="4" 
                  strokeOpacity="0.3" 
                  fill="none" 
              />

              {/* Neck Colors - Stacked from bottom of neck up */}
              {bottleColors && bottleColors.length > 0 && (
                  <g>
                      {bottleColors.map((color, idx) => {
                          const tapeHeight = 10;
                          const yPos = 70 - (idx * (tapeHeight + 2)); 
                          return (
                              <rect
                                  key={idx}
                                  x="34"
                                  y={yPos}
                                  width="32"
                                  height={tapeHeight}
                                  fill={color}
                                  stroke="rgba(0,0,0,0.1)"
                                  strokeWidth="1"
                                  rx="2"
                              />
                          );
                      })}
                  </g>
              )}

              {/* Bottle Label */}
              {bottleLabel && (
                  <foreignObject x="15" y="140" width="70" height="60">
                      <div xmlns="http://www.w3.org/1999/xhtml" className="flex items-center justify-center h-full w-full">
                          <div className="bg-white/90 border border-gray-300 shadow-sm rounded-sm px-1 py-2 text-[10px] font-bold text-center leading-tight text-gray-800 w-full break-words overflow-hidden">
                              {bottleLabel}
                          </div>
                      </div>
                  </foreignObject>
              )}

            </svg>
          )}

          {/* Invisible Slider Overlay for Interaction */}
          <Slider
            orientation="vertical"
            value={[level]}
            min={0}
            max={100}
            step={1}
            onValueChange={handleSliderChange}
            className="absolute inset-0 opacity-0 cursor-pointer h-full w-full z-20"
          />
          
          {/* Thumb Indicator (Visual only, follows level) */}
          <div 
             className="absolute left-full ml-2 flex items-center pointer-events-none transition-all duration-100 ease-out"
             style={{ bottom: `${level}%`, marginBottom: '-8px' }}
          >
              <div className="w-0 h-0 border-t-[6px] border-t-transparent border-r-[8px] border-r-blue-600 border-b-[6px] border-b-transparent mr-1"></div>
              <div className="bg-blue-600 text-white text-xs font-bold px-1.5 py-0.5 rounded shadow-sm">
                  {level}%
              </div>
          </div>

        </div>

        {/* CONTROLS */}
        <div className="flex flex-col w-full sm:w-auto flex-1 space-y-6">
          
          {/* Full bottles */}
          <div>
            <span className="text-sm font-medium text-gray-700">Full Bottles</span>
            <div className="flex items-center gap-3 mt-2">
              <Button variant="outline" size="icon" onClick={() => handleFullBottleChange(-1)}>
                <span className="text-xl font-bold">-</span>
              </Button>

              <span className="text-2xl font-bold min-w-[2ch] text-center">{fullBottles}</span>

              <Button variant="outline" size="icon" onClick={() => handleFullBottleChange(1)}>
                <span className="text-xl font-bold">+</span>
              </Button>
            </div>
          </div>

          {/* Partial bottle */}
          <div>
            <span className="text-sm font-medium text-gray-700">Partial Bottle</span>
            <div className="p-3 bg-gray-100 border rounded-lg text-center mt-2">
              <span className="text-xl font-semibold text-gray-700">
                {partialDisplay}
              </span>
            </div>
            <p className="text-xs text-gray-500 text-center mt-1">
              Drag on the bottle to adjust
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
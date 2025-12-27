import React, { useRef, useState, useEffect } from "react";

export default function BottleFillSlider({
  mode = "photo", // "photo" | "batch_svg"
  bottleImageUrl,
  neckColors = [],
  partial = 0,
  onPartialChange,
}) {
  const containerRef = useRef(null);
  const [imgOk, setImgOk] = useState(true);

  // Reset image state when URL changes
  useEffect(() => {
    setImgOk(true);
  }, [bottleImageUrl]);

  const updateFromClientY = (clientY) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const relativeY = clientY - rect.top;

    const clampedY = Math.min(Math.max(relativeY, 0), rect.height);

    const percentFull = 1 - clampedY / rect.height;

    let newPartial = Math.round(percentFull * 100) / 100;
    newPartial = Math.max(0, Math.min(newPartial, 0.99));

    onPartialChange(Number(newPartial.toFixed(2)));
  };

  const handlePointerDown = (e) => {
    if (e.touches) {
      const touch = e.touches[0];
      updateFromClientY(touch.clientY);
    } else {
      updateFromClientY(e.clientY);
    }

    const move = (ev) => {
      if (ev instanceof TouchEvent) {
        updateFromClientY(ev.touches[0].clientY);
      } else {
        updateFromClientY(ev.clientY);
      }
    };

    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchend", up);
    };

    window.addEventListener("mousemove", move);
    window.addEventListener("touchmove", move);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchend", up);
  };

  const fillTop = `${(1 - partial) * 100}%`;
  const clampedPartial = Math.max(0, Math.min(1, partial));

  // SVG Bottle Path
  const bottlePath = `
    M 35 5
    L 35 50
    L 35 60
    Q 35 70 30 75
    Q 25 80 15 90
    L 15 280
    Q 15 295 25 295
    L 75 295
    Q 85 295 85 280
    L 85 90
    Q 75 80 70 75
    Q 65 70 65 60
    L 65 50
    L 65 5
    Z
  `;

  const liquidHeight = clampedPartial * 280;
  const liquidY = 295 - liquidHeight;

  return (
    <div
      ref={containerRef}
      onMouseDown={handlePointerDown}
      onTouchStart={handlePointerDown}
      className="relative w-48 max-w-[60vw] mx-auto cursor-pointer select-none"
      style={{ height: '300px' }}
    >
      {mode === "photo" ? (
        /* Photo Mode: Real Bottle Image */
        <>
          {bottleImageUrl ? (
            <>
              <img
                src={bottleImageUrl}
                alt="Bottle"
                className="w-full h-full object-contain pointer-events-none"
                onError={() => {
                  console.warn("[BottleFillSlider] image failed to load:", bottleImageUrl);
                  setImgOk(false);
                }}
              />
              {imgOk && (
                <div
                  className="absolute left-0 right-0 bottom-0 bg-blue-500/30 pointer-events-none transition-all duration-75"
                  style={{ top: fillTop }}
                />
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-lg border-2 border-dashed border-gray-300">
              <p className="text-sm text-gray-500 text-center px-4">No bottle image available</p>
            </div>
          )}
        </>
      ) : (
        /* Batch SVG Mode: SVG Bottle with Colored Neck */
        <svg 
          width="100%" 
          height="100%" 
          viewBox="0 0 100 310" 
          className="drop-shadow-xl filter"
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
            stroke="#94a3b8" 
            strokeWidth="2.5"
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
            className="transition-all duration-75"
          />
          
          {/* Liquid Top Line */}
          <line 
            x1="0" y1={liquidY} x2="100" y2={liquidY} 
            stroke="#2563eb" 
            strokeWidth="2" 
            clipPath="url(#bottleClip)"
            className="transition-all duration-75"
          />

          {/* Colored Neck Tapes (Bottom-up) */}
          {neckColors.length > 0 && (
            <g>
              {neckColors.map((color, idx) => {
                const y = 42 - (idx * 16); // Thicker bands, matching Inventory.js
                return (
                  <rect
                    key={idx}
                    x="34"
                    y={y}
                    width="32"
                    height="14"
                    fill={color}
                    stroke="rgba(0,0,0,0.15)"
                    strokeWidth="1"
                    rx="1"
                  />
                );
              })}
            </g>
          )}

          {/* Bottle Outline */}
          <path d={bottlePath} fill="none" stroke="#94a3b8" strokeWidth="2.5" />
          
          {/* Gloss */}
          <path 
            d="M 20 100 Q 20 260 22 280" 
            stroke="white" 
            strokeWidth="2" 
            strokeOpacity="0.3" 
            fill="none" 
          />
          <path 
            d="M 38 10 L 38 45" 
            stroke="white" 
            strokeWidth="3" 
            strokeOpacity="0.3" 
            fill="none" 
          />
        </svg>
      )}

      <div className="absolute -right-2 bottom-3 px-2 py-1 rounded-full bg-white text-xs shadow-md pointer-events-none font-semibold text-blue-600">
        {Math.round(clampedPartial * 100)}%
      </div>
    </div>
  );
}
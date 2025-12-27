import React, { useState, useRef, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";

const commonUnits = [
  'ml', 'cl', 'L', 'oz', 'fl oz', 'qt', 'cup', 'tsp', 'tbsp', 'dash', 'barspoon',
  'g', 'kg', 'lb', 'piece', 'slice', 'sprig', 'pinch', 'drop', 'bottle', 'top'
];

export default function UnitAutocomplete({ value, onValueChange, placeholder = "Unit" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredUnits, setFilteredUnits] = useState(commonUnits);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const inputValue = e.target.value;
    onValueChange(inputValue);
    
    const filtered = commonUnits.filter(unit => 
      unit.toLowerCase().includes(inputValue.toLowerCase())
    );
    setFilteredUnits(filtered);
    setIsOpen(true);
  };

  const handleUnitSelect = (unit) => {
    onValueChange(unit);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setFilteredUnits(commonUnits);
      inputRef.current?.focus();
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={value || ''}
          onChange={handleInputChange}
          onFocus={() => {
            setFilteredUnits(commonUnits);
            setIsOpen(true);
          }}
          placeholder={placeholder}
          className="pr-8"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-0 top-0 h-full px-2 hover:bg-transparent cursor-pointer"
          onClick={toggleDropdown}
        >
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </Button>
      </div>
      
      {isOpen && filteredUnits.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
          {filteredUnits.map((unit) => (
            <button
              key={unit}
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 cursor-pointer"
              onClick={() => handleUnitSelect(unit)}
            >
              {unit}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
import React, { useState } from 'react';
import { Search, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function IngredientSearch({ ingredientName, existingIngredients, onSelect, currentMatch }) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // existingIngredients is array of {id, name, ...}
  const filteredIngredients = (existingIngredients || []).filter((ing) =>
    ing.name.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 10);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="justify-between text-xs h-8 bg-gray-50 hover:bg-gray-100 border-dashed text-gray-600"
        >
          {currentMatch ? (
            <span className="text-emerald-700 font-medium flex items-center">
              <Check className="w-3 h-3 mr-1" />
              Mapped to: {currentMatch}
            </span>
          ) : (
            <span className="flex items-center">
              <Search className="w-3 h-3 mr-1" />
              Search existing...
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Search ingredients..." 
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>No ingredient found.</CommandEmpty>
            <CommandGroup heading="Existing Ingredients">
              {filteredIngredients.map((ing) => (
                <CommandItem
                  key={ing.id}
                  value={ing.name}
                  onSelect={() => {
                    onSelect(ing.name);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${
                      currentMatch === ing.name ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  {ing.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
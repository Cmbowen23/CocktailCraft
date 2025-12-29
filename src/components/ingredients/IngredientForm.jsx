
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Save, X, FlaskConical, Edit, Loader2, Wand2, Upload, Package, X as XIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { createPageUrl } from "@/utils";
import { IngredientCategory } from '@/api/entities';
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from 'framer-motion';
import { alcoholicCategories } from '../utils/categoryDefinitions';
import { convertToMl } from '../utils/costCalculations';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AliasManagerModal from "./AliasManagerModal";

const ingredientCategories = [
  "spirit", "liquor", "vermouth", "wine", "beer", "bitters", "non_alc",
  "syrup", "juice", "fresh", "fruit", "mixer", "garnish", "tea", "other"
];

// Categories that typically use liquid units
const LIQUID_CATEGORIES = [
  "spirit", "liqueur", "vermouth", "wine", "beer", "syrup", "juice", "mixer", "bitters"
];

const unitsOfMeasure = [
  "ml", "L", "oz", "fl oz", "cl", "qt", "lb", "g", "kg", "dash",
  "tsp", "tbsp", "piece", "bottle", "case", "gallon"
];

const commonBottleSizes = [
  { label: "375ml (Half Bottle)", quantity: 375, unit: 'ml' },
  { label: "700ml (Euro)", quantity: 700, unit: 'ml' },
  { label: "750ml (Standard)", quantity: 750, unit: 'ml' },
  { label: "1L (Liter)", quantity: 1, unit: 'L' },
  { label: "1.75L (Handle)", quantity: 1.75, unit: 'L' }
];

const commonDensities = {
  'water': { value: 1, unit: 'g/ml' },
  'sugar': { value: 0.85, unit: 'g/ml' },
  'white sugar': { value: 0.85, unit: 'g/ml' },
  'granulated sugar': { value: 0.85, unit: 'g/ml' },
  'caster sugar': { value: 0.85, unit: 'g/ml' },
  'simple syrup': { value: 1.25, unit: 'g/ml' },
  'honey': { value: 1.42, unit: 'g/ml' },
  'salt': { value: 1.2, unit: 'g/ml' },
  'kosher salt': { value: 1.2, unit: 'g/ml' },
};

const standardUnits = [
  "ml", "L", "oz", "fl oz", "cl", "g", "kg", "lb",
  "piece", "bottle", "can", "case", "gallon"
];

const CustomConversionsManager = ({
  customConversions,
  onConversionsChange,
  availableUnits,
  readOnly
}) => {
  const handleAddConversion = () => {
    onConversionsChange([
      ...customConversions,
      { from_amount: 1, from_unit: 'g', to_amount: 1, to_unit: 'ml' },
    ]);
  };

  const handleUpdateConversion = (index, field, value) => {
    const newConversions = [...customConversions];
    newConversions[index][field] = value;
    onConversionsChange(newConversions);
  };

  const handleRemoveConversion = (index) => {
    const newConversions = customConversions.filter((_, i) => i !== index);
    onConversionsChange(newConversions);
  };

  return (
    <div className="space-y-3">
      <h4 className="text-md font-semibold text-gray-800">
        Weight-to-Volume Conversions
      </h4>
      <p className="text-sm text-gray-600">
        Define custom conversions for this ingredient (e.g., how much 100g of sugar is in ml).
      </p>

      {customConversions.map((conv, index) => (
        <div
          key={index}
          className="flex items-end gap-2 p-2 border rounded-md bg-gray-100"
        >
          <div className="grid grid-cols-[2fr,1fr] gap-2">
            <div>
              <Label htmlFor={`conv-from-amount-${index}`} className="text-xs">
                From Amount
              </Label>
              <Input
                id={`conv-from-amount-${index}`}
                type="number"
                step="0.01"
                value={conv.from_amount}
                onChange={(e) =>
                  handleUpdateConversion(index, 'from_amount', e.target.value)
                }
                placeholder="e.g., 1"
                disabled={readOnly}
              />
            </div>
            <div>
              <Label htmlFor={`conv-from-unit-${index}`} className="text-xs">
                From Unit
              </Label>
              <Select
                value={conv.from_unit}
                onValueChange={(value) =>
                  handleUpdateConversion(index, 'from_unit', value)
                }
                disabled={readOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableUnits.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-center text-gray-600 font-bold px-2 self-center">
            =
          </div>

          <div className="grid grid-cols-[2fr,1fr] gap-2 flex-grow">
            <div>
              <Label htmlFor={`conv-to-amount-${index}`} className="text-xs">
                To Amount
              </Label>
              <Input
                id={`conv-to-amount-${index}`}
                type="number"
                step="0.01"
                value={conv.to_amount}
                onChange={(e) =>
                  handleUpdateConversion(index, 'to_amount', e.target.value)
                }
                placeholder="e.g., 2.5"
                disabled={readOnly}
              />
            </div>
            <div>
              <Label htmlFor={`conv-to-unit-${index}`} className="text-xs">
                To Unit
              </Label>
              <Select
                value={conv.to_unit}
                onValueChange={(value) =>
                  handleUpdateConversion(index, 'to_unit', value)
                }
                disabled={readOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableUnits.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!readOnly && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => handleRemoveConversion(index)}
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          )}
        </div>
      ))}

      {!readOnly && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleAddConversion}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Conversion
        </Button>
      )}
    </div>
  );
};

export default function IngredientForm({
  ingredient,
  allRecipes = [],
  allIngredients = [],
  customCategories = [],
  onCategoryAdded,
  onSubmit,
  onCancel,
  isSaving = false,
  lockName = false,
  readOnlyPricing = false,
  readOnly = false
}) {
  const [currentIngredient, setCurrentIngredient] = useState(() => {
    const baseDefaults = {
      name: '',
      category: 'other',
      spirit_type: '',
      style: '',
      substyle: '',
      flavor: '',
      region: '',
      unit: 'oz', // base costing unit (non-alc)
      cost_per_unit: 0,
      supplier: '',
      abv: 0,
      description: '',
      ingredient_type: 'purchased',
      purchase_price: '',
      purchase_quantity: '',
      purchase_unit: 'piece', // how we buy it
      use_case_pricing: false,
      case_price: '',
      bottles_per_case: '',
      sub_recipe_id: '',
      prep_actions: [],
      custom_conversions: [],
      density_value: '',
      density_unit: 'g/ml',
      bottle_image_url: '',
      sku_number: '',
      exclusive: false,
      tier: '',
      aliases: [],
      include_in_opening_orders: false,
      is_liquor_portfolio_item: false,
    };

    const initialIngredient = { ...baseDefaults, ...(ingredient || {}) };

    if (initialIngredient.category) {
      initialIngredient.category = String(initialIngredient.category).toLowerCase();
    }
    if (initialIngredient.tier) {
      initialIngredient.tier = String(initialIngredient.tier).toLowerCase().replace(' ', '_');
    }

    if (!Array.isArray(initialIngredient.prep_actions)) {
      initialIngredient.prep_actions = [];
    }
    if (!Array.isArray(initialIngredient.aliases)) {
      initialIngredient.aliases = [];
    }
    if (!Array.isArray(initialIngredient.custom_conversions)) {
      initialIngredient.custom_conversions = [];
    } else {
      initialIngredient.custom_conversions = initialIngredient.custom_conversions.map(conv => {
        if (conv.from_amount != null && conv.to_amount != null && conv.to_amount > 0) {
          return conv;
        }
        const factor = conv.conversion_factor != null ? parseFloat(conv.conversion_factor) : 0;
        return {
          ...conv,
          from_amount: 1,
          to_amount: factor || 0,
        };
      });
    }

    if (typeof initialIngredient.use_case_pricing !== 'boolean') {
      initialIngredient.use_case_pricing = false;
    }

    return initialIngredient;
  });

  const [isSmartFilling, setIsSmartFilling] = useState(false);
  const [allCategories, setAllCategories] = useState([]);
  const [showAdvancedConversions, setShowAdvancedConversions] = useState(false);
  const [autofilledFields, setAutofilledFields] = useState(new Set());
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [productVariants, setProductVariants] = useState([]);
  const [isLoadingVariants, setIsLoadingVariants] = useState(false);

  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  const [showCustomUnitModal, setShowCustomUnitModal] = useState(false);
  const [showAliasModal, setShowAliasModal] = useState(false);
  const [customUnitDefinition, setCustomUnitDefinition] = useState({
    customUnit: "",
    equivalentAmount: "",
    equivalentUnit: "oz"
  });

  // GLOBAL custom units from all ingredients (unit names only)
  const allCustomUnits = React.useMemo(() => {
    const units = new Set();

    (allIngredients || []).forEach(ing => {
      if (ing.purchase_unit) units.add(ing.purchase_unit);
      (ing.custom_conversions || []).forEach(conv => {
        if (conv.from_unit) units.add(conv.from_unit);
        if (conv.to_unit) units.add(conv.to_unit);
      });
    });

    (currentIngredient.custom_conversions || []).forEach(conv => {
      if (conv.from_unit) units.add(conv.from_unit);
      if (conv.to_unit) units.add(conv.to_unit);
    });

    return Array.from(units);
  }, [allIngredients, currentIngredient.custom_conversions]);

  // Canonical custom-unit PRESETS: 1 unit = X base-unit (e.g., 1 stalk = 4 oz)
  const globalCustomPresets = React.useMemo(() => {
    const map = new Map(); // key: "unit|to_amount|to_unit"

    const addConv = (conv) => {
      if (!conv || !conv.from_unit || !conv.to_unit || conv.to_amount == null) return;

      const unit = String(conv.from_unit);
      const toAmt = parseFloat(conv.to_amount);
      const toUnit = String(conv.to_unit);

      if (!unit || !toUnit || !toAmt || toAmt <= 0) return;

      const key = `${unit}|${toAmt}|${toUnit}`;
      if (!map.has(key)) {
        map.set(key, { unit, to_amount: toAmt, to_unit: toUnit });
      }
    };

    // from all ingredients
    (allIngredients || []).forEach((ing) => {
      (ing.custom_conversions || []).forEach(addConv);
    });

    // + from this ingredient
    (currentIngredient.custom_conversions || []).forEach(addConv);

    return Array.from(map.values());
  }, [allIngredients, currentIngredient.custom_conversions]);

  const availablePackageUnits = React.useMemo(() => {
    const units = new Set([
      ...standardUnits,
      ...allCustomUnits,
    ]);

    if (currentIngredient.purchase_unit) {
      units.add(currentIngredient.purchase_unit);
    }

    return Array.from(units);
  }, [allCustomUnits, currentIngredient.purchase_unit]);

  // Units allowed in conversions / prep yields (can include canonical units)
  const availableUnitsForConversions = React.useMemo(() => {
    const units = new Set([
      "ml", "L", "oz", "fl oz", "cl", "qt",
      "lb", "g", "kg",
      "dash", "tsp", "tbsp",
      "piece", "bottle", "case", "gallon",
      ...allCustomUnits,
    ]);

    if (currentIngredient.purchase_unit) {
      units.add(currentIngredient.purchase_unit);
    }

    return Array.from(units);
  }, [allCustomUnits, currentIngredient.purchase_unit]);

  useEffect(() => {
    setAllCategories([
      ...ingredientCategories,
      ...customCategories.map(c => c.name)
    ]);
  }, [customCategories]);

  useEffect(() => {
    if (
      ingredient &&
      (ingredient.prep_actions?.length > 0 ||
        ingredient.custom_conversions?.length > 0 ||
        ingredient.density_value)
    ) {
      setShowAdvancedConversions(true);
    }
  }, [ingredient]);

  // Load product variants for alcoholic ingredients
  useEffect(() => {
    const loadVariants = async () => {
      if (ingredient?.id) {
        setIsLoadingVariants(true);
        try {
          const fetchedVariants = await base44.entities.ProductVariant.filter({
            ingredient_id: ingredient.id,
          });
          const correctedVariants = fetchedVariants.map(v => {
            const qty = parseFloat(v.purchase_quantity) || 0;
            const unit = v.purchase_unit;
            const calculatedSizeMl = convertToMl(qty, unit);
            return {
              ...v,
              size_ml: calculatedSizeMl,
            };
          });
          setProductVariants(correctedVariants);
        } catch (error) {
          console.error('Error loading product variants:', error);
        } finally {
          setIsLoadingVariants(false);
        }
      }
    };
    loadVariants();
  }, [ingredient?.id]);

  // Adjust default units when category changes on NEW ingredients
  useEffect(() => {
    if (!ingredient && currentIngredient.category) {
      const isAlcoholic = alcoholicCategories.includes(
        currentIngredient.category.toLowerCase()
      );

      if (isAlcoholic) {
        setCurrentIngredient(prev => ({
          ...prev,
          unit: "ml",
          purchase_unit: "ml",
        }));
      } else {
        setCurrentIngredient(prev => ({
          ...prev,
          unit: "oz",
        }));
      }
    }
  }, [currentIngredient.category, ingredient]);

  const handleInputChange = (field, value) => {
    setCurrentIngredient(prev => ({ ...prev, [field]: value }));
    setAutofilledFields(prev => {
      const newSet = new Set(prev);
      if (newSet.has(field)) newSet.delete(field);
      return newSet;
    });
  };

  const handleCategoryChange = (category) => {
    if (category === "add_new_category") {
      setShowAddCategoryModal(true);
      return;
    }

    const updates = { category };

    if (LIQUID_CATEGORIES.includes(category)) {
      if (!currentIngredient.purchase_unit ||
        currentIngredient.purchase_unit === 'oz' ||
        currentIngredient.purchase_unit === 'piece') {
        updates.purchase_unit = 'ml';
      }
      if (!currentIngredient.unit ||
        currentIngredient.unit === 'piece') {
        updates.unit = 'oz';
      }
      if ((category === 'spirit' || category === 'liquor') &&
        !currentIngredient.purchase_quantity) {
        updates.purchase_quantity = 750;
      }
    }

    setCurrentIngredient(prev => ({ ...prev, ...updates }));
    setAutofilledFields(prev => {
      const ns = new Set(prev);
      ns.delete('category');
      return ns;
    });
  };

  const handleCostCalculation = (field, value) => {
    const updatedIngredient = { ...currentIngredient, [field]: value };

    const price = parseFloat(updatedIngredient.purchase_price) || 0;
    const pkgQty = parseFloat(updatedIngredient.purchase_quantity) || 0;
    const casePrice = parseFloat(updatedIngredient.case_price) || 0;
    const bottlesPerCase = parseFloat(updatedIngredient.bottles_per_case) || 0;
    const useCasePricing =
      field === 'use_case_pricing'
        ? value
        : updatedIngredient.use_case_pricing;

    const fromUnit = updatedIngredient.purchase_unit;
    const baseUnit = updatedIngredient.unit || fromUnit;

    let totalBaseQty = pkgQty;

    if (fromUnit && baseUnit && fromUnit !== baseUnit) {
      const conv = (updatedIngredient.custom_conversions || []).find(
        c =>
          (c.from_unit === fromUnit && c.to_unit === baseUnit) ||
          (c.from_unit === baseUnit && c.to_unit === fromUnit)
      );

      if (conv) {
        const fromAmt = parseFloat(conv.from_amount) || 0;
        const toAmt = parseFloat(conv.to_amount) || 0;
        if (fromAmt > 0 && toAmt > 0) {
          if (conv.from_unit === fromUnit) {
            const factor = toAmt / fromAmt;
            totalBaseQty = pkgQty * factor;
          } else {
            const factor = fromAmt / toAmt;
            totalBaseQty = pkgQty * factor;
          }
        }
      }
    }

    let cost = 0;
    if (useCasePricing && casePrice > 0 && bottlesPerCase > 0) {
      const singlePkgPrice = casePrice / bottlesPerCase;
      if (totalBaseQty > 0) cost = singlePkgPrice / totalBaseQty;
    } else {
      if (price > 0 && totalBaseQty > 0) cost = price / totalBaseQty;
    }

    updatedIngredient.cost_per_unit = cost;

    setCurrentIngredient(updatedIngredient);
    setAutofilledFields(prev => {
      const ns = new Set(prev);
      if (ns.has(field)) ns.delete(field);
      return ns;
    });
  };

  const handleNameBlur = () => {
    const nameLower = currentIngredient.name.toLowerCase().trim();
    if (commonDensities[nameLower] && !currentIngredient.density_value) {
      setCurrentIngredient(prev => ({
        ...prev,
        density_value: commonDensities[nameLower].value,
        density_unit: commonDensities[nameLower].unit,
      }));
    }
  };

  const handleDensityAutofill = () => {
    const nameLower = currentIngredient.name.toLowerCase().trim();
    if (!commonDensities[nameLower]) return;

    const fieldsToHighlight = new Set();
    if (!currentIngredient.density_value) {
      fieldsToHighlight.add('density_value');
    }
    if (!currentIngredient.density_unit ||
      currentIngredient.density_unit === 'g/ml') {
      fieldsToHighlight.add('density_unit');
    }

    setCurrentIngredient(prev => ({
      ...prev,
      density_value: commonDensities[nameLower].value,
      density_unit: commonDensities[nameLower].unit,
    }));

    setAutofilledFields(prev => new Set([...prev, ...fieldsToHighlight]));
  };

  const handleSmartFill = async () => {
    if (!currentIngredient.name) return;

    setIsSmartFilling(true);
    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Based on the ingredient name "${currentIngredient.name}", provide detailed information for bartenders and spirits professionals.

- category: Choose one from: ${ingredientCategories.join(", ")}.
- spirit_type: If it's a spirit, specify its primary type (e.g., Gin, Bourbon, Whiskey, Mezcal, Amaro, Rye, Vodka, Tequila, Rum). Otherwise, leave empty.
- substyle: A more specific style or sub-classification. Otherwise, leave empty.
- region: Geographic region or appellation, if relevant.
- abv: Typical ABV percentage.
- description: 1–2 sentences with key notes and production details.

IMPORTANT: DO NOT provide a 'supplier'. Leave the supplier field empty.`,
        response_json_schema: {
          type: "object",
          properties: {
            category: { type: "string" },
            spirit_type: { type: "string" },
            substyle: { type: "string" },
            region: { type: "string" },
            abv: { type: "number" },
            description: { type: "string" },
          },
        },
      });

      if (response) {
        const newlyFilledFields = new Set();
        const updates = {};

        const fieldsToUpdate = [
          'category',
          'spirit_type',
          'substyle',
          'region',
          'abv',
          'description',
        ];

        fieldsToUpdate.forEach(field => {
          if (
            response[field] !== undefined &&
            response[field] !== null &&
            response[field] !== '' &&
            response[field] !== currentIngredient[field]
          ) {
            updates[field] = response[field];
            newlyFilledFields.add(field);
          }
        });

        if (
          alcoholicCategories.includes(
            (updates.category || currentIngredient.category || '').toLowerCase()
          )
        ) {
          if (!currentIngredient.purchase_quantity) {
            updates.purchase_quantity = 750;
            newlyFilledFields.add('purchase_quantity');
          }
          if (!currentIngredient.purchase_unit) {
            updates.purchase_unit = 'ml';
            newlyFilledFields.add('purchase_unit');
          }
          // CRITICAL FIX: Ensure unit is also set for alcoholic ingredients
          if (!currentIngredient.unit || currentIngredient.unit === 'piece' || currentIngredient.unit === 'oz') {
            updates.unit = 'ml';
            newlyFilledFields.add('unit');
          }
        }

        setCurrentIngredient(prev => ({
          ...prev,
          ...updates,
        }));
        setAutofilledFields(newlyFilledFields);
      }
    } catch (err) {
      console.error("Smart Fill failed:", err);
    } finally {
      setIsSmartFilling(false);
    }
  };

  const handlePrepActionChange = (index, field, value) => {
    const newPrepActions = [...currentIngredient.prep_actions];
    newPrepActions[index][field] = value;
    setCurrentIngredient(prev => ({ ...prev, prep_actions: newPrepActions }));
  };

  const handleAddAlias = (newAlias) => {
    if (!newAlias) return;
    const currentAliases = currentIngredient.aliases || [];
    if (!currentAliases.includes(newAlias)) {
      setCurrentIngredient(prev => ({
        ...prev,
        aliases: [...(prev.aliases || []), newAlias]
      }));
    }
  };

  const handleRemoveAlias = (aliasToRemove) => {
    setCurrentIngredient(prev => ({
      ...prev,
      aliases: (prev.aliases || []).filter(a => a !== aliasToRemove)
    }));
  };

  const addPrepAction = () => {
    setCurrentIngredient(prev => ({
      ...prev,
      prep_actions: [
        ...(prev.prep_actions || []),
        { name: '', yield_amount: '', yield_unit: 'ml' },
      ],
    }));
  };

  const removePrepAction = (index) => {
    setCurrentIngredient(prev => ({
      ...prev,
      prep_actions: prev.prep_actions.filter((_, i) => i !== index),
    }));
  };

  const addProductVariant = () => {
    setProductVariants(prev => [
      ...prev,
      {
        size_ml: 0,
        purchase_quantity: '',
        purchase_unit: 'ml',
        purchase_price: '',
        case_price: '',
        bottles_per_case: '',
        sku_number: '',
        isNew: true,
      },
    ]);
  };

  const updateProductVariant = (index, field, value) => {
    setProductVariants(prev => {
      const newVariants = [...prev];
      const updatedVariant = { ...newVariants[index], [field]: value };

      if (field === 'purchase_quantity' || field === 'purchase_unit') {
        const qty = parseFloat(updatedVariant.purchase_quantity) || 0;
        const unit = updatedVariant.purchase_unit;
        updatedVariant.size_ml = convertToMl(qty, unit);
      }

      newVariants[index] = updatedVariant;
      return newVariants;
    });
  };

  const removeProductVariant = (index) => {
    setProductVariants(prev => prev.filter((_, i) => i !== index));
  };

  const handleConversionsChange = (newConversions) => {
    setCurrentIngredient(prev => ({
      ...prev,
      custom_conversions: newConversions,
    }));
  };

  const handlePackageUnitChange = (value) => {
    if (value === 'add_custom') {
      setShowCustomUnitModal(true);
      return;
    }

    if (value.startsWith('preset:')) {
      const [, unit, toAmtStr, toUnit] = value.split(':');
      const toAmt = parseFloat(toAmtStr);

      setCurrentIngredient((prev) => {
        const otherConvs =
          (prev.custom_conversions || []).filter((c) => c.from_unit !== unit);

        const newConv = {
          from_amount: 1,
          from_unit: unit,
          to_amount: toAmt,
          to_unit: toUnit,
        };

        const updated = {
          ...prev,
          purchase_unit: unit,          
          unit: prev.unit || toUnit,    
          custom_conversions: [...otherConvs, newConv],
        };

        const price = parseFloat(updated.purchase_price) || 0;
        const qty = parseFloat(updated.purchase_quantity) || 0;
        const casePrice = parseFloat(updated.case_price) || 0;
        const bottlesPerCase = parseFloat(updated.bottles_per_case) || 0;
        const useCasePricing = updated.use_case_pricing;

        const totalBaseQty = qty * (toAmt || 0);
        let cost = 0;

        if (useCasePricing && casePrice > 0 && bottlesPerCase > 0) {
          const singlePkgPrice = casePrice / bottlesPerCase;
          if (totalBaseQty > 0) cost = singlePkgPrice / totalBaseQty;
        } else if (price > 0 && totalBaseQty > 0) {
          cost = price / totalBaseQty;
        }

        return {
          ...updated,
          cost_per_unit: cost,
        };
      });

      return;
    }

    if (value.startsWith('unit:')) {
      const unit = value.slice('unit:'.length);

      setCurrentIngredient((prev) => ({
        ...prev,
        purchase_unit: unit,
      }));

      return;
    }
  };

  const handleAddNewCategory = async () => {
    if (!newCategoryName.trim()) return;

    setIsAddingCategory(true);
    try {
      await base44.entities.IngredientCategory.create({
        name: newCategoryName.trim(),
      });

      setAllCategories(prev => [...prev, newCategoryName.trim()]);
      if (onCategoryAdded) await onCategoryAdded();

      setCurrentIngredient(prev => ({
        ...prev,
        category: newCategoryName.trim().toLowerCase(),
      }));
      setShowAddCategoryModal(false);
      setNewCategoryName("");
    } catch (error) {
      console.error("Error creating category:", error);
      alert("Failed to create category. Please try again.");
    } finally {
      setIsAddingCategory(false);
    }
  };

  const handleCustomUnitSave = (e) => {
    if (e && e.preventDefault) e.preventDefault();

    const newUnitName = (customUnitDefinition.customUnit || "").trim();
    const newEquivAmount = parseFloat(customUnitDefinition.equivalentAmount);
    const baseUnit = customUnitDefinition.equivalentUnit || "oz";

    if (!newUnitName || isNaN(newEquivAmount) || newEquivAmount <= 0) {
      return;
    }

    const newCustomConversion = {
      from_amount: 1,
      from_unit: newUnitName,
      to_amount: newEquivAmount,
      to_unit: baseUnit,
    };

    setCurrentIngredient(prev => {
      const price = parseFloat(prev.purchase_price);
      const qty = parseFloat(prev.purchase_quantity);
      let newCost = prev.cost_per_unit;

      if (!isNaN(price) && !isNaN(qty) && qty > 0) {
        const totalBaseQty = qty * newEquivAmount; 
        newCost = totalBaseQty > 0 ? price / totalBaseQty : 0;
      }

      return {
        ...prev,
        purchase_unit: newUnitName,
        unit: prev.unit || baseUnit,
        cost_per_unit: newCost,
        custom_conversions: [
          ...(prev.custom_conversions || []),
          newCustomConversion,
        ],
      };
    });

    setShowCustomUnitModal(false);
    setCustomUnitDefinition({
      customUnit: "",
      equivalentAmount: "",
      equivalentUnit: baseUnit,
    });
  };

  const handleClearImage = () => {
    setCurrentIngredient(prev => ({ ...prev, bottle_image_url: null }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const response = await base44.integrations.Core.UploadFile({ file });
      if (response.file_url) {
        setCurrentIngredient(prev => ({
          ...prev,
          bottle_image_url: response.file_url,
        }));
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const cleanedIngredient = {
      ...currentIngredient,
      cost_per_unit: parseFloat(currentIngredient.cost_per_unit) || 0,
      abv: parseFloat(currentIngredient.abv) || 0,
      sub_recipe_id: currentIngredient.sub_recipe_id || null,
      spirit_type: currentIngredient.spirit_type || null,
      substyle: currentIngredient.substyle || null,
      region: currentIngredient.region || null,
      supplier: currentIngredient.supplier || null,
      description: currentIngredient.description || null,
      density_value: currentIngredient.density_value
        ? parseFloat(currentIngredient.density_value)
        : null,
      density_unit: currentIngredient.density_unit || null,
      custom_conversions: (currentIngredient.custom_conversions || []).map(
        conv => {
          const fromAmt = parseFloat(conv.from_amount) || 0;
          const toAmt = parseFloat(conv.to_amount) || 0;
          const factor = fromAmt > 0 ? toAmt / fromAmt : 0;
          return {
            from_amount: fromAmt,
            from_unit: conv.from_unit,
            to_amount: toAmt,
            to_unit: conv.to_unit,
            conversion_factor: factor,
          };
        }
      ),
      prep_actions: (currentIngredient.prep_actions || []).filter(
        action =>
          action.name?.trim() &&
          action.yield_amount !== '' &&
          action.yield_unit?.trim()
      ),
    };

    const isAlcoholic = alcoholicCategories.includes(
      (currentIngredient.category || '').toLowerCase()
    ) || currentIngredient.include_in_opening_orders;
    
    // CRITICAL FIX: Ensure unit is 'ml' for alcoholic ingredients BEFORE calculations
    if (isAlcoholic) {
      if (!cleanedIngredient.unit || cleanedIngredient.unit === 'piece' || cleanedIngredient.unit === 'oz') {
        cleanedIngredient.unit = 'ml';
      }
    }
    
    if (isAlcoholic) {
      delete cleanedIngredient.purchase_price;
      delete cleanedIngredient.purchase_quantity;
      delete cleanedIngredient.purchase_unit;
      delete cleanedIngredient.case_price;
      delete cleanedIngredient.bottles_per_case;
      delete cleanedIngredient.use_case_pricing;
    }

    Object.keys(cleanedIngredient).forEach(key => {
      if (
        typeof cleanedIngredient[key] === 'string' &&
        cleanedIngredient[key].trim() === ''
      ) {
        cleanedIngredient[key] = null;
      }
    });

    const formData = {
      ...cleanedIngredient,
      originalName: ingredient?.name,
      productVariants: productVariants.filter(v =>
        (v.purchase_quantity !== '' && v.purchase_quantity !== null && v.purchase_quantity !== undefined &&
         v.purchase_price !== '' && v.purchase_price !== null && v.purchase_price !== undefined) ||
        (v.case_price !== '' && v.case_price !== null && v.case_price !== undefined &&
         v.bottles_per_case !== '' && v.bottles_per_case !== null && v.bottles_per_case !== undefined)
      ),
    };

    // Calculate cost_per_unit from variants for alcoholic ingredients
    if (isAlcoholic && formData.productVariants.length > 0) {
      let lowestCostPerUnit = Infinity;

      formData.productVariants.forEach(variant => {
        const variantPurchaseQty = parseFloat(variant.purchase_quantity) || 0;
        const variantPurchaseUnit = variant.purchase_unit || 'ml';
        const variantBottlePrice = parseFloat(variant.purchase_price) || 0;
        const variantCasePrice = parseFloat(variant.case_price) || 0;
        const variantBottlesPerCase = parseFloat(variant.bottles_per_case) || 0;

        const totalVolumeMl = convertToMl(variantPurchaseQty, variantPurchaseUnit);
        const baseUnitInMl = convertToMl(1, cleanedIngredient.unit);

        let costPerBaseUnit = 0;

        if (totalVolumeMl > 0 && baseUnitInMl > 0) {
          const totalVolumeBaseUnits = totalVolumeMl / baseUnitInMl;

          if (variantCasePrice > 0 && variantBottlesPerCase > 0) {
            // Calculate cost from case pricing
            const effectiveBottlePrice = variantCasePrice / variantBottlesPerCase;
            if (totalVolumeBaseUnits > 0) {
              costPerBaseUnit = effectiveBottlePrice / totalVolumeBaseUnits;
            }
          } else if (variantBottlePrice > 0) {
            // Calculate cost from individual bottle pricing
            if (totalVolumeBaseUnits > 0) {
              costPerBaseUnit = variantBottlePrice / totalVolumeBaseUnits;
            }
          }
        }

        if (costPerBaseUnit > 0 && costPerBaseUnit < lowestCostPerUnit) {
          lowestCostPerUnit = costPerBaseUnit;
        }
      });

      if (lowestCostPerUnit !== Infinity) {
        formData.cost_per_unit = lowestCostPerUnit;
      }
    }

    await onSubmit(formData);
  };

  const handleCreateOrEditSubRecipe = () => {
    const recipeId = currentIngredient?.sub_recipe_id;
    const returnTo = encodeURIComponent(window.location.href);
    let url;

    if (recipeId) {
      url = createPageUrl(
        `CreateSubRecipe?id=${recipeId}&returnTo=${returnTo}`
      );
    } else {
      const newRecipeName = encodeURIComponent(currentIngredient.name);
      const params = new URLSearchParams({
        name: newRecipeName,
        returnTo: returnTo,
      });
      if (currentIngredient && currentIngredient.id) {
        params.append('ingredientId', currentIngredient.id);
      }
      url = createPageUrl(`CreateSubRecipe?${params.toString()}`);
    }
    window.location.href = url;
  };

  const showAlcoholFields = alcoholicCategories.includes(
    (currentIngredient.category || '').toLowerCase()
  ) || currentIngredient.include_in_opening_orders;
  const showBottleSizeSuggestions =
    currentIngredient.category === 'spirit' ||
    currentIngredient.category === 'liquor';
  const showBottleImageFields = showAlcoholFields || currentIngredient.include_in_opening_orders;

  const packageUnitValue = React.useMemo(() => {
    const pu = currentIngredient.purchase_unit || 'piece';

    const conv = (currentIngredient.custom_conversions || []).find(
      (c) =>
        c.from_unit === pu &&
        (parseFloat(c.from_amount) || 0) === 1 &&
        c.to_amount != null &&
        c.to_unit
    );

    if (conv) {
      const toAmt = parseFloat(conv.to_amount) || conv.to_amount;
      return `preset:${pu}:${toAmt}:${conv.to_unit}`; 
    }

    return `unit:${pu}`; 
  }, [currentIngredient.purchase_unit, currentIngredient.custom_conversions]);

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* BASIC INFO */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label htmlFor="name">Ingredient Name</Label>
            <div className="flex items-center gap-2">
              <Input
                id="name"
                value={currentIngredient.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                onBlur={handleNameBlur}
                placeholder="e.g., London Dry Gin"
                required
                disabled={lockName || readOnly}
              />
              {!readOnly && (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSmartFill}
                  disabled={isSmartFilling || !currentIngredient.name}
                >
                  {isSmartFilling ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Wand2 className="w-4 h-4" />
                  )}
                </Button>
              )}
            </div>
            {lockName && (
              <p className="text-xs text-gray-500 mt-1">
                Ingredient name cannot be changed after creation.
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="category">Category</Label>
            <Select
              value={currentIngredient.category}
              onValueChange={handleCategoryChange}
              disabled={readOnly}
            >
              <SelectTrigger
                className={
                  autofilledFields.has('category') ? 'autofill-halo' : ''
                }
              >
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {allCategories.map(cat => (
                  <SelectItem key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </SelectItem>
                ))}
                {!readOnly && (
                  <SelectItem
                    value="add_new_category"
                    className="text-blue-600 font-medium"
                  >
                    + Create New Category
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="supplier">Supplier / Brand</Label>
            <Input
              id="supplier"
              value={currentIngredient.supplier || ''}
              onChange={(e) =>
                handleInputChange('supplier', e.target.value)
              }
              placeholder="e.g., Tanqueray, Monin, House"
              disabled={readOnly}
            />
          </div>

          {showAlcoholFields && (
            <>
              <div>
                <Label htmlFor="spirit_type">Spirit Type</Label>
                <Input
                  id="spirit_type"
                  value={currentIngredient.spirit_type || ''}
                  onChange={(e) =>
                    handleInputChange('spirit_type', e.target.value)
                  }
                  placeholder="e.g., Gin, Bourbon, Tequila"
                  className={
                    autofilledFields.has('spirit_type') ? 'autofill-halo' : ''
                  }
                  disabled={readOnly}
                />
              </div>
              <div>
                <Label htmlFor="substyle">Substyle</Label>
                <Input
                  id="substyle"
                  value={currentIngredient.substyle || ''}
                  onChange={(e) =>
                    handleInputChange('substyle', e.target.value)
                  }
                  placeholder="e.g., London Dry, Reposado, Flavored"
                  className={
                    autofilledFields.has('substyle') ? 'autofill-halo' : ''
                  }
                  disabled={readOnly}
                />
              </div>
              {currentIngredient.substyle?.toLowerCase() === 'flavored' && (
                <div>
                  <Label htmlFor="flavor">Flavor</Label>
                  <Input
                    id="flavor"
                    value={currentIngredient.flavor || ''}
                    onChange={(e) =>
                      handleInputChange('flavor', e.target.value)
                    }
                    placeholder="e.g., Citrus, Vanilla, Cherry"
                    className={
                      autofilledFields.has('flavor') ? 'autofill-halo' : ''
                    }
                    disabled={readOnly}
                  />
                </div>
              )}
              <div>
                <Label htmlFor="region">Region</Label>
                <Input
                  id="region"
                  value={currentIngredient.region || ''}
                  onChange={(e) =>
                    handleInputChange('region', e.target.value)
                  }
                  placeholder="e.g., Islay, Kentucky, Highland"
                  className={
                    autofilledFields.has('region') ? 'autofill-halo' : ''
                  }
                  disabled={readOnly}
                />
              </div>
              <div>
                <Label htmlFor="abv">ABV (%)</Label>
                <Input
                  id="abv"
                  type="number"
                  step="0.1"
                  value={currentIngredient.abv || ''}
                  onChange={(e) =>
                    handleInputChange(
                      'abv',
                      parseFloat(e.target.value) || 0
                    )
                  }
                  placeholder="e.g., 40"
                  className={
                    autofilledFields.has('abv') ? 'autofill-halo' : ''
                  }
                  disabled={readOnly}
                />
              </div>
            </>
          )}

          {showAlcoholFields && (
            <div>
              <Label htmlFor="tier">Tier</Label>
              <Select
                value={currentIngredient.tier || ''}
                onValueChange={(value) =>
                  handleInputChange('tier', value)
                }
                disabled={readOnly}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select tier (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="well">Well</SelectItem>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="top_shelf">Top Shelf</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Switch
              id="exclusive"
              checked={currentIngredient.exclusive || false}
              onCheckedChange={(checked) =>
                handleInputChange('exclusive', checked)
              }
              disabled={readOnly}
            />
            <Label htmlFor="exclusive">
              {currentIngredient.exclusive ? 'Exclusive' : 'Non-Exclusive'}
            </Label>
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={currentIngredient.description || ''}
              onChange={(e) =>
                handleInputChange('description', e.target.value)
              }
              placeholder="Regional characteristics, production methods, and tasting notes."
              className={`h-24 ${
                autofilledFields.has('description') ? 'autofill-halo' : ''
              }`}
              disabled={readOnly}
            />
          </div>

          {showBottleImageFields && (
            <div className="md:col-span-2">
              <Label htmlFor="bottle_image_url">Bottle Image</Label>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    id="bottle_image_url"
                    value={currentIngredient.bottle_image_url || ''}
                    onChange={(e) =>
                      handleInputChange('bottle_image_url', e.target.value)
                    }
                    placeholder="Paste image URL here"
                    className={
                      autofilledFields.has('bottle_image_url')
                        ? 'autofill-halo'
                        : ''
                    }
                    disabled={readOnly}
                  />
                  {!readOnly && (
                    <>
                      <Label htmlFor="image-upload" className="cursor-pointer">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={isUploadingImage}
                          asChild
                        >
                          <span>
                            {isUploadingImage ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Upload className="w-4 h-4" />
                            )}
                          </span>
                        </Button>
                        <input
                          id="image-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageUpload}
                        />
                      </Label>
                      {currentIngredient.bottle_image_url && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleClearImage}
                          title="Clear image"
                          className="text-red-600 hover:bg-red-50"
                        >
                          <XIcon className="w-4 h-4" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
                {currentIngredient.bottle_image_url && (
                  <div className="relative w-32 h-32 border rounded-lg overflow-hidden bg-gray-50">
                    <img
                      src={currentIngredient.bottle_image_url}
                      alt="Bottle preview"
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* PURCHASED vs SUB-RECIPE */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="ingredient-type-switch"
              checked={currentIngredient.ingredient_type === 'sub_recipe'}
              onCheckedChange={(checked) =>
                handleInputChange(
                  'ingredient_type',
                  checked ? 'sub_recipe' : 'purchased'
                )
              }
              disabled={readOnly}
            />
            <Label htmlFor="ingredient-type-switch">
              This is a house-made ingredient (Sub-Recipe)
            </Label>
          </div>

          {currentIngredient.ingredient_type === 'purchased' ? (
            <div className="p-4 border rounded-lg bg-gray-50/50 space-y-4">
              {/* ALCOHOLIC (variants) */}
              {showAlcoholFields ? (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="text-md font-semibold text-gray-800">
                      Size Variants & Pricing
                    </h3>
                    {!readOnlyPricing && !readOnly && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={addProductVariant}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Size Variant
                      </Button>
                    )}
                  </div>

                  {isLoadingVariants ? (
                    <div className="text-center py-4">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                    </div>
                  ) : productVariants.length === 0 ? (
                    <div className="text-center py-6 text-gray-500">
                      <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">
                        No size variants added yet. Click &quot;Add Size Variant&quot; to
                        create one.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {productVariants
                        .sort(
                          (a, b) =>
                            (parseFloat(a.size_ml) || 0) -
                            (parseFloat(b.size_ml) || 0)
                        )
                        .map((variant, index) => {
                          const sizeMl = parseFloat(variant.size_ml) || 0;
                          let sizeLabel;
                          if (
                            variant.purchase_quantity &&
                            variant.purchase_unit
                          ) {
                            sizeLabel = `${variant.purchase_quantity} ${variant.purchase_unit}`;
                          } else {
                            sizeLabel =
                              sizeMl >= 1000
                                ? `${(sizeMl / 1000).toFixed(2)} L`
                                : `${sizeMl.toFixed(0)} ml`;
                          }

                          const bottlePrice =
                            parseFloat(variant.purchase_price) || 0;
                          const qty =
                            parseFloat(variant.purchase_quantity) || 0;
                          const totalVolumeOz =
                            convertToMl(qty, variant.purchase_unit) / 29.5735;
                          const costPerOzBottle =
                            totalVolumeOz > 0 && bottlePrice > 0
                              ? bottlePrice / totalVolumeOz
                              : 0;

                          const casePrice =
                            parseFloat(variant.case_price) || 0;
                          const bottlesPerCase =
                            parseFloat(variant.bottles_per_case) || 0;
                          const effectiveUnitPrice =
                            casePrice > 0 && bottlesPerCase > 0
                              ? casePrice / bottlesPerCase
                              : 0;
                          const costPerOzCase =
                            totalVolumeOz > 0 && effectiveUnitPrice > 0
                              ? effectiveUnitPrice / totalVolumeOz
                              : 0;

                          return (
                            <div
                              key={index}
                              className="border border-gray-300 rounded-lg p-4 bg-white"
                            >
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-lg font-bold text-gray-800">
                                  {sizeLabel}
                                </h4>
                                {!readOnlyPricing && !readOnly && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() =>
                                      removeProductVariant(index)
                                    }
                                  >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  </Button>
                                )}
                              </div>

                              <div className="grid grid-cols-[1fr,0.7fr,0.7fr,0.9fr,0.9fr,1fr] gap-2 mb-2">
                                <div>
                                  <Label className="text-xs text-gray-600">
                                    Bottle Price ($)
                                  </Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={variant.purchase_price || ''}
                                    onChange={(e) =>
                                      updateProductVariant(
                                        index,
                                        'purchase_price',
                                        e.target.value
                                      )
                                    }
                                    placeholder="24.99"
                                    className="h-9"
                                    disabled={readOnlyPricing || readOnly}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs text-gray-600">
                                    Size Qty
                                  </Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={variant.purchase_quantity || ''}
                                    onChange={(e) =>
                                      updateProductVariant(
                                        index,
                                        'purchase_quantity',
                                        e.target.value
                                      )
                                    }
                                    placeholder="750"
                                    className="h-9"
                                    disabled={readOnlyPricing || readOnly}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs text-gray-600">
                                    Unit
                                  </Label>
                                  <Select
                                    value={variant.purchase_unit || 'ml'}
                                    onValueChange={(value) =>
                                      updateProductVariant(
                                        index,
                                        'purchase_unit',
                                        value
                                      )
                                    }
                                    disabled={readOnlyPricing || readOnly}
                                  >
                                    <SelectTrigger className="h-9">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="ml">ml</SelectItem>
                                      <SelectItem value="L">L</SelectItem>
                                      <SelectItem value="oz">oz</SelectItem>
                                      <SelectItem value="fl oz">
                                        fl oz
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label className="text-xs text-gray-600">
                                    Bottles/Case
                                  </Label>
                                  <Input
                                    type="number"
                                    step="1"
                                    value={variant.bottles_per_case || ''}
                                    onChange={(e) =>
                                      updateProductVariant(
                                        index,
                                        'bottles_per_case',
                                        e.target.value
                                      )
                                    }
                                    placeholder="6"
                                    className="h-9"
                                    disabled={readOnlyPricing || readOnly}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs text-gray-600">
                                    Cost/oz (Bottle)
                                  </Label>
                                  <div className="h-9 flex items-center justify-center bg-blue-50 border border-blue-200 rounded px-2 text-sm font-bold text-blue-700">
                                    ${costPerOzBottle.toFixed(2)}
                                  </div>
                                </div>
                                <div>
                                  <Label className="text-xs text-gray-600">
                                    SKU
                                  </Label>
                                  <Input
                                    value={variant.sku_number || ''}
                                    onChange={(e) =>
                                      updateProductVariant(
                                        index,
                                        'sku_number',
                                        e.target.value
                                      )
                                    }
                                    placeholder="SKU-123"
                                    className="h-9"
                                    disabled={readOnly}
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-[1fr,0.7fr,0.7fr,0.9fr,0.9fr,1fr] gap-2">
                                <div>
                                  <Label className="text-xs text-gray-600">
                                    Case Price ($)
                                  </Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={variant.case_price || ''}
                                    onChange={(e) =>
                                      updateProductVariant(
                                        index,
                                        'case_price',
                                        e.target.value
                                      )
                                    }
                                    placeholder="144.00"
                                    className="h-9"
                                    disabled={readOnlyPricing || readOnly}
                                  />
                                </div>
                                <div className="col-span-2" />
                                <div>
                                  <Label className="text-xs text-gray-600">
                                    Eff. Unit ($/btl)
                                  </Label>
                                  <div className="h-9 flex items-center justify-center bg-gray-50 border rounded px-2 text-sm font-semibold text-gray-700">
                                    $
                                    {effectiveUnitPrice > 0
                                      ? effectiveUnitPrice.toFixed(2)
                                      : '—'}
                                  </div>
                                </div>
                                <div>
                                  <Label className="text-xs text-gray-600">
                                    Cost/oz (Case)
                                  </Label>
                                  <div className="h-9 flex items-center justify-center bg-green-50 border border-green-200 rounded px-2 text-sm font-bold text-green-700">
                                    $
                                    {costPerOzCase > 0
                                      ? costPerOzCase.toFixed(2)
                                      : '—'}
                                  </div>
                                </div>
                                <div />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}

                  {!readOnlyPricing && !readOnly &&
                    showBottleSizeSuggestions &&
                    productVariants.length === 0 && (
                      <div className="pt-2">
                        <p className="text-xs text-gray-600 mb-2">
                          Quick add common sizes:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {commonBottleSizes.map(size => (
                            <Button
                              key={size.label}
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={() => {
                                const newVariant = {
                                  size_ml: convertToMl(
                                    size.quantity,
                                    size.unit
                                  ),
                                  purchase_quantity: size.quantity,
                                  purchase_unit: size.unit,
                                  purchase_price: '',
                                  case_price: '',
                                  bottles_per_case: '',
                                  sku_number: '',
                                  isNew: true,
                                };
                                setProductVariants(prev => [
                                  ...prev,
                                  newVariant,
                                ]);
                              }}
                            >
                              {size.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                </>
              ) : (
                // NON-ALC PRICING
                <div className="space-y-4">
                  <h3 className="text-md font-semibold text-gray-800">
                    Pricing
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="purchase_price">Package Price ($)</Label>
                      <Input
                        id="purchase_price"
                        type="number"
                        step="0.01"
                        value={currentIngredient.purchase_price || ''}
                        onChange={(e) =>
                          handleCostCalculation(
                            'purchase_price',
                            e.target.value
                          )
                        }
                        placeholder="0.00"
                        disabled={readOnlyPricing || readOnly}
                      />
                    </div>
                    <div>
                      <Label htmlFor="purchase_quantity">
                        Package Quantity
                      </Label>
                      <Input
                        id="purchase_quantity"
                        type="number"
                        step="0.01"
                        value={currentIngredient.purchase_quantity || ''}
                        onChange={(e) =>
                          handleCostCalculation(
                            'purchase_quantity',
                            e.target.value
                          )
                        }
                        placeholder="1"
                        disabled={readOnlyPricing || readOnly}
                      />
                    </div>
                    <div>
                      <Label htmlFor="purchase_unit">Package Unit</Label>
                      <Select
                        value={packageUnitValue}
                        onValueChange={handlePackageUnitChange}
                        disabled={readOnlyPricing || readOnly}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                        <SelectContent>
                          {/* 1. Standard units */}
                          {standardUnits.map((unit) => (
                            <SelectItem key={`unit:${unit}`} value={`unit:${unit}`}>
                              {unit}
                            </SelectItem>
                          ))}

                          {/* 2. Custom presets, e.g. stalk (4 oz), stalk (5 oz) */}
                          {globalCustomPresets.map((preset) => {
                            const value = `preset:${preset.unit}:${preset.to_amount}:${preset.to_unit}`;
                            const label = `${preset.unit} (${preset.to_amount} ${preset.to_unit})`;
                            return (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            );
                          })}

                          {!readOnly && (
                            <SelectItem value="add_custom" className="text-blue-600 font-medium">
                              + Add Custom Unit
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Case Pricing Option - Only if included in opening orders */}
                  {currentIngredient.include_in_opening_orders && (
                    <div className="pt-4 border-t border-gray-200">
                      <div className="flex items-center space-x-2 mb-4">
                        <Switch
                          id="use_case_pricing"
                          checked={currentIngredient.use_case_pricing || false}
                          onCheckedChange={(checked) =>
                            handleCostCalculation('use_case_pricing', checked)
                          }
                          disabled={readOnlyPricing || readOnly}
                        />
                        <Label htmlFor="use_case_pricing" className="font-medium text-gray-700">
                          Use Case Pricing
                        </Label>
                      </div>

                      {currentIngredient.use_case_pricing && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 bg-gray-50 p-3 rounded-md border border-gray-200">
                          <div>
                            <Label htmlFor="case_price">Case Price ($)</Label>
                            <Input
                              id="case_price"
                              type="number"
                              step="0.01"
                              value={currentIngredient.case_price || ''}
                              onChange={(e) =>
                                handleCostCalculation('case_price', e.target.value)
                              }
                              placeholder="0.00"
                              className="bg-white"
                              disabled={readOnlyPricing || readOnly}
                            />
                          </div>
                          <div>
                            <Label htmlFor="bottles_per_case">Units per Case</Label>
                            <Input
                              id="bottles_per_case"
                              type="number"
                              step="1"
                              value={currentIngredient.bottles_per_case || ''}
                              onChange={(e) =>
                                handleCostCalculation('bottles_per_case', e.target.value)
                              }
                              placeholder="12"
                              className="bg-white"
                              disabled={readOnlyPricing || readOnly}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {(() => {
                    const costPer = parseFloat(currentIngredient.cost_per_unit) || 0;
                    const baseUnit = currentIngredient.unit || 'unit';
                    const purchaseUnit = currentIngredient.purchase_unit;
                    const conversions = currentIngredient.custom_conversions || [];

                    let conversionLabel = '';

                    if (purchaseUnit && baseUnit && purchaseUnit !== baseUnit) {
                      // find a conversion that links purchaseUnit <-> baseUnit
                      const conv =
                        conversions.find(
                          (c) => c.from_unit === purchaseUnit && c.to_unit === baseUnit
                        ) ||
                        conversions.find(
                          (c) => c.from_unit === baseUnit && c.to_unit === purchaseUnit
                        );

                      if (conv) {
                        const fromAmt = parseFloat(conv.from_amount) || 0;
                        const toAmt = parseFloat(conv.to_amount) || 0;

                        let amountBasePerPurchase = 0;

                        if (conv.from_unit === purchaseUnit && conv.to_unit === baseUnit) {
                          amountBasePerPurchase = toAmt;
                        } else if (conv.from_unit === baseUnit && conv.to_unit === purchaseUnit) {
                          amountBasePerPurchase = toAmt > 0 ? fromAmt / toAmt : 0;
                        }

                        if (amountBasePerPurchase > 0) {
                          conversionLabel = ` (1 ${purchaseUnit} = ${amountBasePerPurchase} ${baseUnit})`;
                        }
                      }
                    }

                    return (
                      <div className="text-sm text-gray-500">
                        Cost per unit:{' '}
                        <strong>
                          ${costPer.toFixed(2)} / {baseUnit}
                          {conversionLabel}
                        </strong>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* CONVERSIONS & YIELD */}
              <div className="pt-4 border-t space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="advanced-conversions-switch"
                    checked={showAdvancedConversions}
                    onCheckedChange={setShowAdvancedConversions}
                  />
                  <Label htmlFor="advanced-conversions-switch">
                    Enable Conversions &amp; Yield Settings
                  </Label>
                </div>

                <AnimatePresence>
                  {showAdvancedConversions && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-6 overflow-hidden"
                    >
                      {/* Prep Actions */}
                      <div className="pt-4 border-t">
                        <h4 className="text-md font-semibold text-gray-800">
                          Yields from Preparation
                        </h4>
                        <p className="text-sm text-gray-600">
                          Define yields for different preparations (e.g., juicing
                          a citrus, chopping herbs).
                        </p>
                        <div className="space-y-3 mt-3">
                          {currentIngredient.prep_actions.map(
                            (action, index) => (
                              <div
                                key={index}
                                className="flex items-end gap-2"
                              >
                                <div className="flex-grow grid grid-cols-3 gap-2">
                                  <div>
                                    <Label
                                      htmlFor={`prep-name-${index}`}
                                      className="text-xs"
                                    >
                                      Prep Name
                                    </Label>
                                    <Input
                                      id={`prep-name-${index}`}
                                      value={action.name}
                                      onChange={(e) =>
                                        handlePrepActionChange(
                                          index,
                                          'name',
                                          e.target.value
                                        )
                                      }
                                      placeholder="e.g., juice, peel"
                                      disabled={readOnly}
                                    />
                                  </div>
                                  <div>
                                    <Label
                                      htmlFor={`prep-yield-${index}`}
                                      className="text-xs"
                                    >
                                      Yield Amount{' '}
                                      <span className="text-gray-500 font-normal">
                                        per 1{' '}
                                        {currentIngredient.purchase_unit ||
                                          'unit'}
                                      </span>
                                    </Label>
                                    <Input
                                      id={`prep-yield-${index}`}
                                      type="number"
                                      step="0.1"
                                      value={action.yield_amount}
                                      onChange={(e) =>
                                        handlePrepActionChange(
                                          index,
                                          'yield_amount',
                                          e.target.value
                                        )
                                      }
                                      placeholder="e.g., 1.5"
                                      disabled={readOnly}
                                    />
                                  </div>
                                  <div>
                                    <Label
                                      htmlFor={`prep-unit-${index}`}
                                      className="text-xs"
                                    >
                                      Yield Unit
                                    </Label>
                                    <Select
                                      value={action.yield_unit}
                                      onValueChange={(value) =>
                                        handlePrepActionChange(
                                          index,
                                          'yield_unit',
                                          value
                                        )
                                      }
                                      disabled={readOnly}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {availableUnitsForConversions.map(
                                          unit => (
                                            <SelectItem
                                              key={unit}
                                              value={unit}
                                            >
                                              {unit}
                                            </SelectItem>
                                          )
                                        )}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                {!readOnly && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removePrepAction(index)}
                                  >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  </Button>
                                )}
                              </div>
                            )
                          )}
                        </div>
                        {!readOnly && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={addPrepAction}
                            className="mt-3"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Prep Action
                          </Button>
                        )}
                      </div>

                      {/* Density */}
                      <div>
                        <h4 className="text-md font-semibold text-gray-800">
                          Density
                        </h4>
                        <p className="text-sm text-gray-600">
                          Define the ingredient&apos;s density for accurate
                          weight-to-volume conversions.
                        </p>
                        <div className="grid md:grid-cols-3 gap-4 mt-3">
                          <div>
                            <Label htmlFor="density_value">Density Value</Label>
                            <div className="flex gap-2 items-center">
                              <Input
                                id="density_value"
                                type="number"
                                step="0.01"
                                value={currentIngredient.density_value || ''}
                                onChange={(e) =>
                                  handleInputChange(
                                    'density_value',
                                    e.target.value
                                  )
                                }
                                placeholder="e.g., 1 for water"
                                className={
                                  autofilledFields.has('density_value')
                                    ? 'autofill-halo'
                                    : ''
                                }
                                disabled={readOnly}
                              />
                              {!readOnly && currentIngredient.name &&
                                !currentIngredient.density_value && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={handleDensityAutofill}
                                    className="flex-shrink-0"
                                    title="Auto-fill density if available"
                                  >
                                    <Wand2 className="w-4 h-4" />
                                  </Button>
                                )}
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="density_unit">Density Unit</Label>
                            <Select
                              value={currentIngredient.density_unit || 'g/ml'}
                              onValueChange={(value) =>
                                handleInputChange('density_unit', value)
                              }
                              disabled={readOnly}
                            >
                              <SelectTrigger
                                className={
                                  autofilledFields.has('density_unit')
                                    ? 'autofill-halo'
                                    : ''
                                }
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="g/ml">g/ml</SelectItem>
                                <SelectItem value="kg/L">kg/L</SelectItem>
                                <SelectItem value="lb/gal">lb/gal</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      {/* Custom conversions manager */}
                      {!readOnly && (
                        <CustomConversionsManager
                          customConversions={
                            currentIngredient.custom_conversions || []
                          }
                          onConversionsChange={handleConversionsChange}
                          availableUnits={availableUnitsForConversions}
                          readOnly={readOnly}
                        />
                      )}
                      {readOnly && currentIngredient.custom_conversions && currentIngredient.custom_conversions.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-md font-semibold text-gray-800">Custom Conversions</h4>
                          <ul className="list-disc pl-5 text-sm text-gray-600">
                            {currentIngredient.custom_conversions.map((c, idx) => (
                              <li key={idx}>{c.from_amount} {c.from_unit} = {c.to_amount} {c.to_unit}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          ) : (
            // SUB-RECIPE
            <div className="p-4 border rounded-lg bg-blue-50/70 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-md font-semibold text-blue-800">
                    Sub-Recipe Link
                  </h3>
                  <p className="text-sm text-blue-700">
                    Link this ingredient to its defining recipe.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCreateOrEditSubRecipe}
                  className="bg-white"
                >
                  {currentIngredient.sub_recipe_id ? (
                    <Edit className="w-4 h-4 mr-2" />
                  ) : (
                    <FlaskConical className="w-4 h-4 mr-2" />
                  )}
                  {currentIngredient.sub_recipe_id
                    ? 'Edit Sub-Recipe'
                    : 'Create Sub-Recipe'}
                </Button>
              </div>
              {currentIngredient.sub_recipe_id ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    <FlaskConical className="w-4 h-4 inline mr-1" />
                    Linked to recipe:{' '}
                    <a
                      href={createPageUrl(
                        `CreateSubRecipe?id=${currentIngredient.sub_recipe_id}`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {currentIngredient.name}
                    </a>
                  </p>
                </div>
              ) : (
                <div className="text-sm text-blue-700 bg-blue-100 p-2 rounded-md">
                  No sub-recipe linked to this ingredient.
                </div>
              )}
            </div>
          )}
        </div>

        {/* INCLUDE IN TOGGLES */}
        <div className="pt-6 border-t space-y-3">
          <div className="flex items-center space-x-2">
            <Switch
              id="include_in_opening_orders"
              checked={currentIngredient.include_in_opening_orders || false}
              onCheckedChange={(checked) =>
                handleInputChange('include_in_opening_orders', checked)
              }
              disabled={readOnly}
            />
            <Label htmlFor="include_in_opening_orders">
              Include in Orders
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_liquor_portfolio_item"
              checked={currentIngredient.is_liquor_portfolio_item || false}
              onCheckedChange={(checked) =>
                handleInputChange('is_liquor_portfolio_item', checked)
              }
              disabled={readOnly}
            />
            <Label htmlFor="is_liquor_portfolio_item">
              Include in Inventory
            </Label>
          </div>
        </div>

        {/* FOOTER BUTTONS */}
        <div className="flex justify-between pt-6 border-t">
          {!readOnly ? (
            <Button 
              type="button" 
              variant="ghost" 
              onClick={() => setShowAliasModal(true)}
              className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
            >
              Manage Aliases ({currentIngredient.aliases?.length || 0})
            </Button>
          ) : (
            <div className="text-sm text-gray-500 self-center">
              Aliases: {currentIngredient.aliases?.join(', ') || 'None'}
            </div>
          )}
          <div className="flex gap-3 ml-auto">
            <Button type="button" variant="outline" onClick={onCancel}>
              <X className="w-4 h-4 mr-2" />
              {readOnly ? 'Close' : 'Cancel'}
            </Button>
            {!readOnly && (
              <Button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {currentIngredient.id ? 'Update Ingredient' : 'Create Ingredient'}
              </Button>
            )}
          </div>
        </div>
      </form>

      {/* ADD CATEGORY MODAL */}
      <Dialog open={showAddCategoryModal} onOpenChange={setShowAddCategoryModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new_category">Category Name</Label>
              <Input
                id="new_category"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g., Cordial, Infusion"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowAddCategoryModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddNewCategory}
                disabled={!newCategoryName.trim() || isAddingCategory}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isAddingCategory && (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                )}
                Create Category
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* CUSTOM UNIT MODAL */}
      <Dialog open={showCustomUnitModal} onOpenChange={setShowCustomUnitModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Define Custom Unit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="custom_unit_name">Custom Unit Name</Label>
              <Input
                id="custom_unit_name"
                value={customUnitDefinition.customUnit}
                onChange={(e) =>
                  setCustomUnitDefinition(prev => ({
                    ...prev,
                    customUnit: e.target.value,
                  }))
                }
                placeholder="e.g., bunch, bag, box"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">
                1 {customUnitDefinition.customUnit || "unit"} =
              </span>
              <Input
                type="number"
                step="0.01"
                value={customUnitDefinition.equivalentAmount}
                onChange={(e) =>
                  setCustomUnitDefinition(prev => ({
                    ...prev,
                    equivalentAmount: e.target.value,
                  }))
                }
                placeholder="2.5"
                className="w-20"
              />
              <Select
                value={customUnitDefinition.equivalentUnit}
                onValueChange={(value) =>
                  setCustomUnitDefinition(prev => ({
                    ...prev,
                    equivalentUnit: value,
                  }))
                }
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['ml', 'L', 'oz', 'g', 'kg', 'piece', 'gallon'].map(
                    unit => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowCustomUnitModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleCustomUnitSave}
                disabled={
                  !customUnitDefinition.customUnit ||
                  !customUnitDefinition.equivalentAmount
                }
              >
                Save Custom Unit
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ALIAS MANAGER MODAL */}
      <AliasManagerModal
        isOpen={showAliasModal}
        onClose={() => setShowAliasModal(false)}
        aliases={currentIngredient.aliases || []}
        onAliasesChange={(newAliases) => setCurrentIngredient(prev => ({ ...prev, aliases: newAliases }))}
      />
    </>
  );
}

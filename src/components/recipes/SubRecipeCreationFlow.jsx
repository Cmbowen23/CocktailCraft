import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Edit, FileText, FlaskConical, X, Plus, Settings2 } from 'lucide-react';
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import RecipeForm from './RecipeForm';
import SubRecipeTextImport from './SubRecipeTextImport';
import SubRecipeAuditAndMapping from './SubRecipeAuditAndMapping';
import { calculateSubRecipeABV } from "../utils/subRecipeAbvCalculation";

export default function SubRecipeCreationFlow({
  recipe,
  onSubmit,
  onCancel,
  allIngredients,
  onAddIngredientCost,
  onRecipeChange,
  calculateTotalVolumeMl,
  onTextImportComplete,
  showCalculator,
  activeCalculator,
  calculatorSubType,
  calculatorInput,
  setCalculatorInput,
  setCalculatorSubType,
  setShowCalculator,
  variableConfig,
  setVariableConfig,
  cordialAction,
  setCordialAction,
  cordialTargetAbv,
  setCordialTargetAbv,
  useRecipeSpirit,
  setUseRecipeSpirit,
  selectedSpiritId,
  setSelectedSpiritId,
  manualSpiritAbv,
  setManualSpiritAbv,
  recipeSpirits,
  handleApplyCalculator
}) {
  const [parsedRecipes, setParsedRecipes] = useState(null);
  const [activeTab, setActiveTab] = useState('manual');

  const handleTextImportComplete = (recipes) => {
      setParsedRecipes(recipes);
  };

  if (parsedRecipes) {
      return (
          <SubRecipeAuditAndMapping
              parsedRecipes={parsedRecipes}
              allIngredients={allIngredients}
              onSaveComplete={(updatedRecipes) => {
                  setParsedRecipes(null);
                  if (onTextImportComplete) onTextImportComplete(updatedRecipes);
              }}
              onCancel={() => setParsedRecipes(null)}
          />
      );
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="manual">
          <Edit className="w-4 h-4 mr-2" />
          Create Manually
        </TabsTrigger>
        <TabsTrigger value="text">
          <FileText className="w-4 h-4 mr-2" />
          Create from Text
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="manual" className="pt-4">
        <RecipeForm
          recipe={recipe}
          onSubmit={onSubmit}
          onCancel={onCancel}
          allIngredients={allIngredients}
          onAddIngredientCost={onAddIngredientCost}
          isSubRecipe={true}
          onRecipeChange={onRecipeChange}
          calculateTotalVolumeMl={calculateTotalVolumeMl}
          showAdvancedTools={showCalculator}
          onToggleAdvancedTools={() => setShowCalculator(!showCalculator)}
          activeCalculator={activeCalculator}
          calculatorSubType={calculatorSubType}
          calculatorInput={calculatorInput}
          setCalculatorInput={setCalculatorInput}
          setCalculatorSubType={setCalculatorSubType}
          variableConfig={variableConfig}
          setVariableConfig={setVariableConfig}
          cordialAction={cordialAction}
          setCordialAction={setCordialAction}
          cordialTargetAbv={cordialTargetAbv}
          setCordialTargetAbv={setCordialTargetAbv}
          useRecipeSpirit={useRecipeSpirit}
          setUseRecipeSpirit={setUseRecipeSpirit}
          selectedSpiritId={selectedSpiritId}
          setSelectedSpiritId={setSelectedSpiritId}
          manualSpiritAbv={manualSpiritAbv}
          setManualSpiritAbv={setManualSpiritAbv}
          recipeSpirits={recipeSpirits}
          handleApplyCalculator={handleApplyCalculator}
        />
      </TabsContent>
      
      <TabsContent value="text" className="pt-4">
        <SubRecipeTextImport
          onComplete={handleTextImportComplete}
          onCancel={onCancel}
        />
      </TabsContent>
    </Tabs>
  );
}
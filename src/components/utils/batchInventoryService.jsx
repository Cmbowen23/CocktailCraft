import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { convertToMl } from "./costCalculations";

export async function ensureInventoryItemForBatchRecipe({
    recipe,
    allIngredients,
    accountId
}) {
    if (!recipe || !accountId) return null;

    const settings = recipe.batch_settings || {};
    const inventoryBottle = settings.inventory_bottle || {};
    
    // Only proceed if tracking is enabled and we have a bottle size
    if (!inventoryBottle.enabled || !inventoryBottle.size_ml) {
        return null; // Do nothing, keep existing item if any
    }

    const sizeMl = inventoryBottle.size_ml;
    const label = inventoryBottle.label || recipe.name;
    const colors = inventoryBottle.colors || [];

    // 1. Ensure Ingredient exists
    let ingredient = allIngredients.find(i => i.sub_recipe_id === recipe.id);
    if (!ingredient) {
        ingredient = await base44.entities.Ingredient.create({
            name: recipe.name,
            category: recipe.category || 'Batch',
            ingredient_type: 'sub_recipe',
            sub_recipe_id: recipe.id,
            unit: 'bottle',
            description: `Batch ingredient for ${recipe.name}`
        });
    }

    // 2. Ensure ProductVariant exists
    const variants = await base44.entities.ProductVariant.filter({ ingredient_id: ingredient.id });
    let variant = variants?.find(v => v.size_ml === sizeMl);
    
    if (!variant) {
        variant = await base44.entities.ProductVariant.create({
            ingredient_id: ingredient.id,
            size_ml: sizeMl,
            purchase_quantity: 1,
            purchase_unit: 'bottle',
            purchase_price: 0 // Price updated by cost calc elsewhere if needed
        });
    }

    // 3. Ensure InventoryItem exists
    const items = await base44.entities.InventoryItem.filter({ product_variant_id: variant.id, account_id: accountId });
    if (!items || items.length === 0) {
        await base44.entities.InventoryItem.create({
            product_variant_id: variant.id,
            ingredient_id: ingredient.id,
            account_id: accountId,
            current_stock: 0,
            unit: 'bottle',
            bottle_label: label,
            bottle_colors: colors
        });
    } else {
        // Update label/colors
        await base44.entities.InventoryItem.update(items[0].id, {
            bottle_label: label,
            bottle_colors: colors
        });
    }
}
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { ensureInventoryItemForBatchRecipe } from "./batchInventoryService";

export async function updateRecipeBatchSettings({
    recipe,
    newBatchSettings,
    allIngredients = [],
    accountId = null
}) {
    if (!recipe?.id) throw new Error("Missing recipe id");

    console.log('[BatchSettings] Saving:', recipe.name);
    
    try {
        // Only set is_batched flag, do NOT overwrite category
        const rootUpdates = {
            batch_settings: newBatchSettings,
            is_batched: newBatchSettings.track_batch_inventory || false
        };

        await base44.entities.Recipe.update(recipe.id, rootUpdates);

        const updatedRecipe = { ...recipe, ...rootUpdates };

        if (accountId && allIngredients.length > 0) {
            try {
                await ensureInventoryItemForBatchRecipe({
                    recipe: updatedRecipe,
                    allIngredients,
                    accountId
                });
            } catch (inventoryError) {
                console.error("Inventory sync warning:", inventoryError);
            }
        }

        toast.success("Batch settings saved");
        return updatedRecipe;

    } catch (error) {
        console.error("Save failed:", error);
        toast.error("Failed to save settings");
        throw error;
    }
}
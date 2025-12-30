import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { rows } = await req.json()
    if (!rows || !Array.isArray(rows)) throw new Error("Invalid payload: 'rows' array is missing.");

    // 1. Init Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. Load Existing Ingredients (Cache for Speed)
    // This makes the import 50x faster by avoiding thousands of separate DB calls
    const { data: existing } = await supabase.from('ingredients').select('id, name');
    const ingredientMap = new Map();
    if (existing) existing.forEach(i => ingredientMap.set(i.name.toLowerCase().trim(), i.id));

    // 3. Separate New vs Existing
    const newIngredients = [];
    const processedRows = [];

    for (const row of rows) {
        if (!row.name) continue;
        const normName = row.name.toLowerCase().trim();
        
        // Prepare new ingredient if we haven't seen it
        if (!ingredientMap.has(normName) && !newIngredients.some(i => i.name.toLowerCase() === normName)) {
            newIngredients.push({
                name: row.name,
                supplier: row.supplier || '',
                category: row.category || 'Spirit',
                spirit_type: row.spirit_type,
                style: row.style, substyle: row.substyle,
                flavor: row.flavor, region: row.region,
                description: row.description, 
                abv: parseFloat(row.abv) || 0,
                unit: 'oz'
            });
        }
        processedRows.push(row);
    }

    // 4. Bulk Insert New Ingredients
    if (newIngredients.length > 0) {
        const { data: created, error } = await supabase.from('ingredients')
            .insert(newIngredients).select('id, name');
            
        if (error) throw new Error("Ingredient Creation Failed: " + error.message);
        
        // Add newly created IDs to the map so we can link variants
        created.forEach(i => ingredientMap.set(i.name.toLowerCase().trim(), i.id));
    }

    // 5. Prepare Variants (Bottles)
    const variants = [];
    for (const row of processedRows) {
        const ingId = ingredientMap.get(row.name.toLowerCase().trim());
        if (!ingId) continue;

        // Smart Size Logic (Handle '750ml', '1L', '32oz')
        let size_ml = 750;
        const s = (row.variant_size || '750ml').toString().toLowerCase();
        const n = parseFloat(s.match(/[\d.]+/)?.[0] || 750);
        if (s.includes('l') && !s.includes('ml')) size_ml = n * 1000;
        else if (s.includes('oz')) size_ml = n * 29.57;
        else size_ml = n;

        variants.push({
            ingredient_id: ingId,
            sku_number: row.sku_number || row.sku || '',
            purchase_price: parseFloat(row.purchase_price) || 0,
            case_price: parseFloat(row.case_price) || 0,
            bottles_per_case: parseFloat(row.bottles_per_case) || 1,
            size_ml: size_ml,
            purchase_quantity: parseFloat(row.purchase_quantity) || 1,
            purchase_unit: row.purchase_unit || 'bottle',
            tier: row.tier,
            exclusive: String(row.exclusive).toLowerCase() === 'true',
            bottle_image_url: row.bottle_image_url
        });
    }

    // 6. Bulk Upsert Variants
    // Upserting in batches of 100 prevents timeouts
    const CHUNK = 100;
    let savedCount = 0;
    for (let i = 0; i < variants.length; i += CHUNK) {
        const batch = variants.slice(i, i + CHUNK);
        const { error } = await supabase.from('product_variants')
            .upsert(batch, { onConflict: 'sku_number' });
            
        if (error) console.error("Variant Batch Error:", error);
        else savedCount += batch.length;
    }

    return new Response(
      JSON.stringify({ success: true, count: savedCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
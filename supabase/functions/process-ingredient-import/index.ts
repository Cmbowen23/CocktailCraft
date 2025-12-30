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
    
    // 1. CREATE CLIENT WITH USER CONTEXT
    // We use the Authorization header from the request. 
    // This ensures RLS (Row Level Security) is respected.
    // User A can only insert into User A's rows.
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // 2. Validate User
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) throw new Error("Unauthorized: User not found")

    // 3. Process Ingredients (With User Context)
    // We map rows to the DB structure. 
    const ingredientsToUpsert = [];
    const ingredientMap = new Map(); // name -> id (if exists)

    // A. Resolve Ingredients (We need IDs to link variants)
    // We fetch existing ingredients for THIS user (RLS handles filtering)
    const { data: existingIngs } = await supabaseClient
        .from('ingredients')
        .select('id, name');
        
    if (existingIngs) existingIngs.forEach(i => ingredientMap.set(i.name.toLowerCase().trim(), i.id));

    const newIngredients = [];
    for (const row of rows) {
        const name = row.name.trim();
        const key = name.toLowerCase();
        
        if (!ingredientMap.has(key)) {
             // Create new ingredient object
             // NOTE: RLS will automatically attach user_id/org_id if your policies are set up correctly
             newIngredients.push({
                 name: name,
                 supplier: row.supplier,
                 category: row.category,
                 spirit_type: row.spirit_type,
                 style: row.style, 
                 substyle: row.substyle,
                 flavor: row.flavor, 
                 region: row.region, 
                 description: row.description,
                 abv: parseFloat(row.abv) || 0,
                 unit: 'oz' // Default
             });
             // Add dummy placeholder so we don't add duplicate names in this batch
             ingredientMap.set(key, 'PENDING');
        }
    }

    // B. Insert New Ingredients
    if (newIngredients.length > 0) {
        const { data: created, error: createError } = await supabaseClient
            .from('ingredients')
            .upsert(newIngredients, { onConflict: 'name', ignoreDuplicates: false })
            .select('id, name');
            
        if (createError) throw new Error("Ingredient Insert Error: " + createError.message);
        
        // Update Map with real IDs
        created.forEach(i => ingredientMap.set(i.name.toLowerCase().trim(), i.id));
    }

    // 4. Upsert Variants
    const variantsToUpsert = [];
    for (const row of rows) {
        const ingId = ingredientMap.get(row.name.toLowerCase().trim());
        if (!ingId || ingId === 'PENDING') continue; // Skip if failed

        variantsToUpsert.push({
            ingredient_id: ingId,
            sku_number: row.sku_number,
            purchase_price: parseFloat(row.purchase_price) || 0,
            case_price: parseFloat(row.case_price) || 0,
            bottles_per_case: parseFloat(row.bottles_per_case) || 1,
            size_ml: parseFloat(row.size_ml) || 750, // Frontend handles parsing
            purchase_quantity: parseFloat(row.purchase_quantity) || 1,
            purchase_unit: row.purchase_unit,
            tier: row.tier,
            exclusive: row.exclusive === true || String(row.exclusive).toLowerCase() === 'true',
            bottle_image_url: row.bottle_image_url
        });
    }

    // C. Bulk Upsert Variants
    if (variantsToUpsert.length > 0) {
        const { error: varError } = await supabaseClient
            .from('product_variants')
            .upsert(variantsToUpsert, { onConflict: 'sku_number' });
            
        if (varError) throw new Error("Variant Upsert Error: " + varError.message);
    }

    return new Response(
      JSON.stringify({ success: true, count: variantsToUpsert.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
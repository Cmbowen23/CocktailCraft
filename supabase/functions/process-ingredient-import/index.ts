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
    const { rows, dry_run } = await req.json()
    
    // 1. Initialize Supabase with the USER'S context (Secure & Scalable)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // --- AUDIT MODE (DRY RUN) ---
    // Compares CSV rows against DB without saving
    if (dry_run) {
        // Fetch all existing SKUs for comparison
        const { data: allVariants, error } = await supabaseClient
            .from('product_variants')
            .select(`
                sku_number, purchase_price, case_price, bottle_image_url, tier, exclusive, 
                bottles_per_case, purchase_quantity, purchase_unit,
                ingredient:ingredient_id ( name, supplier, category )
            `);

        if (error) throw new Error("Inventory Load Failed: " + error.message);

        // Create fast lookup map
        const inventoryMap = new Map();
        allVariants.forEach((v: any) => {
            if (v.sku_number) {
                // Flatten ingredient data for easier diffing
                const flat = { ...v, ...(v.ingredient || {}) };
                delete flat.ingredient;
                inventoryMap.set(String(v.sku_number).trim().toLowerCase(), flat);
            }
        });

        const report = [];
        const stats = { new: 0, updated: 0, unchanged: 0 };

        for (const row of rows) {
            if (!row.name) continue;

            const skuKey = String(row.sku_number || '').trim().toLowerCase();
            const existing = inventoryMap.get(skuKey);
            
            let status = 'NEW';
            const changes = [];

            if (existing) {
                status = 'SAME';

                // Helper to detect changes
                const check = (field: string, label: string, type = 'string') => {
                    let newVal = row[field];
                    let oldVal = existing[field];
                    
                    if (newVal === undefined || newVal === '') return; 

                    let isDiff = false;

                    if (type === 'currency' || type === 'number') {
                        const n = parseFloat(String(newVal).replace(/[^0-9.-]/g, ''));
                        const o = parseFloat(String(oldVal).replace(/[^0-9.-]/g, ''));
                        if (isNaN(n)) return; 
                        if (Math.abs(n - (o || 0)) > 0.01) isDiff = true;
                    } else if (type === 'boolean') {
                        const n = String(newVal).toLowerCase() === 'true';
                        const o = Boolean(oldVal);
                        if (n !== o) isDiff = true;
                    } else {
                        if (String(newVal).trim() !== String(oldVal || '').trim()) isDiff = true;
                    }

                    if (isDiff) {
                        status = 'UPDATE';
                        changes.push({ field: label, old: oldVal, new: newVal, type });
                    }
                };

                check('purchase_price', 'Price', 'currency');
                check('case_price', 'Case Price', 'currency');
                check('supplier', 'Supplier');
                check('category', 'Category');
                check('bottle_image_url', 'Image');
                check('tier', 'Tier');
                check('exclusive', 'Exclusive', 'boolean');
            }

            if (status === 'NEW') stats.new++;
            else if (status === 'UPDATE') stats.updated++;
            else stats.unchanged++;

            report.push({ ...row, status, changes });
        }

        return new Response(
            JSON.stringify({ report, stats }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // --- IMPORT MODE (ACTUAL SAVE) ---
    // 1. Upsert Ingredients
    const { data: existingIngs } = await supabaseClient.from('ingredients').select('id, name');
    const ingredientMap = new Map();
    if (existingIngs) existingIngs.forEach((i: any) => ingredientMap.set(i.name.toLowerCase().trim(), i.id));

    const newIngredients = [];
    for (const row of rows) {
        const key = row.name.toLowerCase().trim();
        if (!ingredientMap.has(key)) {
             newIngredients.push({
                 name: row.name,
                 supplier: row.supplier,
                 category: row.category,
                 spirit_type: row.spirit_type,
                 style: row.style, substyle: row.substyle,
                 flavor: row.flavor, region: row.region, description: row.description,
                 abv: parseFloat(row.abv) || 0,
                 unit: 'oz'
             });
             ingredientMap.set(key, 'PENDING');
        }
    }

    if (newIngredients.length > 0) {
        const { data: created, error } = await supabaseClient
            .from('ingredients')
            .upsert(newIngredients, { onConflict: 'name' })
            .select('id, name');
        if (error) throw new Error("Ingredient Save Failed: " + error.message);
        created.forEach((i: any) => ingredientMap.set(i.name.toLowerCase().trim(), i.id));
    }

    // 2. Upsert Variants
    const variants = [];
    for (const row of rows) {
        const ingId = ingredientMap.get(row.name.toLowerCase().trim());
        if (!ingId || ingId === 'PENDING') continue;

        variants.push({
            ingredient_id: ingId,
            sku_number: row.sku_number,
            purchase_price: parseFloat(row.purchase_price) || 0,
            case_price: parseFloat(row.case_price) || 0,
            bottles_per_case: parseFloat(row.bottles_per_case) || 1,
            size_ml: parseFloat(row.variant_size) || 750,
            purchase_quantity: parseFloat(row.purchase_quantity) || 1,
            purchase_unit: row.purchase_unit,
            tier: row.tier,
            exclusive: String(row.exclusive).toLowerCase() === 'true',
            bottle_image_url: row.bottle_image_url
        });
    }

    if (variants.length > 0) {
        const { error } = await supabaseClient
            .from('product_variants')
            .upsert(variants, { onConflict: 'sku_number' });
        if (error) throw new Error("Variant Save Failed: " + error.message);
    }

    return new Response(
      JSON.stringify({ success: true, count: variants.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
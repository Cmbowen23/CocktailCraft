// --- ROBUST CSV PARSING ---
  // 1. Parse lines properly (handling quoted commas)
  const parseLine = (text) => {
    const result = [];
    let curValue = '';
    let inQuote = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (inQuote) {
        if (char === '"') {
          if (i + 1 < text.length && text[i + 1] === '"') { curValue += '"'; i++; } // Handle escaped quote
          else { inQuote = false; }
        } else { curValue += char; }
      } else {
        if (char === '"') { inQuote = true; }
        else if (char === ',') { result.push(curValue.trim()); curValue = ''; }
        else { curValue += char; }
      }
    }
    result.push(curValue.trim());
    return result;
  };

  const handleParseFile = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);
    setError('');
    setProgress('Reading CSV file...');

    try {
      const text = await selectedFile.text();
      const lines = text.split(/\r?\n/).filter(line => line.trim());

      if (lines.length < 2) {
        setError('CSV file must contain headers and at least one data row');
        setIsProcessing(false);
        return;
      }

      // 1. Parse Headers (Robustly)
      const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/^"|"$/g, '').trim());
      setParsedHeaders(headers);

      // 2. Parse Rows
      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseLine(lines[i]);
        if (values.length === headers.length) { // Only add valid rows
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index].replace(/^"|"$/g, '');
            });
            rows.push(row);
        }
      }

      if (rows.length === 0) {
        setError('No valid data rows found in CSV');
        setIsProcessing(false);
        return;
      }
      setParsedRows(rows);

      // 3. SMART AUTO-MAPPING
      // We define aliases to help the importer find the right columns
      const fieldAliases = {
        name: ['name', 'item', 'product', 'title'],
        category: ['category', 'type', 'group', 'class'],
        spirit_type: ['spirit', 'liquor type', 'subtype'],
        supplier: ['supplier', 'vendor', 'distributor'],
        sku_number: ['sku', 'id', 'code', 'item #'],
        purchase_price: ['price', 'cost', 'unit cost', 'bottle price'],
        purchase_quantity: ['size', 'volume', 'qty', 'capacity'],
        purchase_unit: ['unit', 'uom', 'measurement'],
        case_price: ['case cost', 'case price'],
        bottles_per_case: ['pack', 'bottles', 'case size', 'qty per case'],
        abv: ['abv', 'alcohol', 'proof'],
        description: ['description', 'notes', 'details']
      };

      const expectedFields = [
        'name', 'category', 'spirit_type', 'substyle', 'flavor', 'region', 'supplier', 'sku_number', 'exclusive', 'tier',
        'purchase_price', 'purchase_quantity', 'purchase_unit', 'use_case_pricing', 'case_price', 'bottles_per_case', 'abv', 'description'
      ];

      const initialMappings = {};
      
      expectedFields.forEach(field => {
        // 1. Check exact match
        let match = headers.find(h => h === field);
        
        // 2. If no match, check aliases
        if (!match && fieldAliases[field]) {
            match = headers.find(h => fieldAliases[field].some(alias => h.includes(alias)));
        }
        
        // 3. If still no match, fuzzy check (header includes field name)
        if (!match) {
            match = headers.find(h => h.includes(field.replace(/_/g, ' ')));
        }

        initialMappings[field] = match || '';
      });

      setColumnMappings(initialMappings);
      setStep('mapping');
      setProgress('');

    } catch (error) {
      console.error("Error parsing CSV:", error);
      setError(`Failed to parse CSV: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };
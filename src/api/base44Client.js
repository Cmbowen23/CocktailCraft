import { supabase } from '@/lib/supabase'

const TABLE_NAME_MAP = {
  Ingredient: 'ingredients',
  Recipe: 'recipes',
  Checklist: 'checklists',
  Menu: 'menus',
  Account: 'accounts',
  IngredientCategory: 'ingredient_categories',
  Tasting: 'tastings',
  Task: 'tasks',
  RequisitionList: 'requisition_lists',
  MenuPresentation: 'menu_presentations',
  PublicLink: 'public_links',
  RecipeCustomization: 'recipe_customizations',
  OpeningOrderTemplate: 'opening_order_templates',
  ProductVariant: 'product_variants',
  StandardOrderPreset: 'standard_order_presets',
  UserInvitation: 'user_invitations',
  UserAccountAccess: 'user_account_access',
  AppSetting: 'app_settings',
  RepInvitation: 'rep_invitations',
  MenuInvitation: 'menu_invitations',
  Location: 'locations',
  InventoryItem: 'inventory_items',
  InventoryCountLog: 'inventory_count_logs',
  InventoryReport: 'inventory_reports',
  TrainingDocument: 'training_documents',
  PrepSession: 'prep_sessions',
  MenuTemplate: 'menu_templates',
  RecipeVersion: 'recipe_versions',
  Glassware: 'glassware',
  RecipeCategory: 'recipe_categories',
  Profile: 'profiles',
}

function createEntityMethods(tableName) {
  return {
    async list(orderBy = '-created_at', limit = 1000) {
      let query = supabase.from(tableName).select('*')

      if (orderBy) {
        const ascending = !orderBy.startsWith('-')
        const column = ascending ? orderBy : orderBy.substring(1)
        query = query.order(column, { ascending })
      }

      if (limit) {
        query = query.limit(limit)
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    },

    async get(id) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (error) throw error
      return data
    },

    async create(payload) {
      const { data, error } = await supabase
        .from(tableName)
        .insert(payload)
        .select()
        .single()

      if (error) throw error
      return data
    },

    async update(id, payload) {
      const { data, error } = await supabase
        .from(tableName)
        .update(payload)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },

    async delete(id) {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id)

      if (error) throw error
      return { success: true }
    },

    async filter(filters, limit = 1000) {
      let query = supabase.from(tableName).select('*')

      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value)
      })

      if (limit) {
        query = query.limit(limit)
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    },
  }
}

export const base44 = {
  auth: {
    async me() {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) return null
      if (!user) return null

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (!profile) {
        return {
          ...user,
          role: 'user',
          user_type: 'internal',
          onboarding_complete: false,
        }
      }

      return {
        ...user,
        ...profile,
      }
    },

    async updateMe(updates) {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single()

      if (error) throw error
      return data
    },

    async signIn(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      return data
    },

    async signOut() {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      return { success: true }
    },

    async getSession() {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) return null
      return session
    },

    async signUp(email, password, metadata = {}) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
        },
      })
      if (error) throw error
      return data
    },

    async signInWithGoogle() {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
      return data
    },
  },

  entities: new Proxy(
    {},
    {
      get(_target, entityName) {
        const tableName = TABLE_NAME_MAP[entityName]

        if (!tableName) {
          console.warn(`No table mapping for entity: ${entityName}`)
          return createEntityMethods(entityName.toLowerCase() + 's')
        }

        return createEntityMethods(tableName)
      },
    }
  ),

  functions: new Proxy(
    {},
    {
      get(_target, functionName) {
        return async (...args) => {
          // Convert camelCase to kebab-case for Supabase function slugs
          const slug = functionName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
          const { data, error } = await supabase.functions.invoke(slug, {
            body: args[0] || {},
          })
          if (error) throw error
          return data
        }
      },
    }
  ),

  integrations: {
    InvokeLLM: async (prompt, options = {}) => {
      try {
        const { data, error } = await supabase.functions.invoke('invoke-llm', {
          body: { prompt, options },
        })
        if (error) throw error
        return data
      } catch (error) {
        console.warn('LLM integration not available:', error.message)
        throw new Error('LLM integration not yet implemented')
      }
    },
  },
}

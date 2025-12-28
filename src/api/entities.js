import { base44 } from './base44Client';


export const Ingredient = base44.entities.Ingredient;

export const Recipe = base44.entities.Recipe;

export const Checklist = base44.entities.Checklist;

export const Menu = base44.entities.Menu;

export const Account = base44.entities.Account;

export const IngredientCategory = base44.entities.IngredientCategory;

export const Tasting = base44.entities.Tasting;

export const Task = base44.entities.Task;

export const RequisitionList = base44.entities.RequisitionList;

export const MenuPresentation = base44.entities.MenuPresentation;

export const PublicLink = base44.entities.PublicLink;

export const RecipeCustomization = base44.entities.RecipeCustomization;

export const OpeningOrderTemplate = base44.entities.OpeningOrderTemplate;

export const ProductVariant = base44.entities.ProductVariant;

export const StandardOrderPreset = base44.entities.StandardOrderPreset;

export const UserInvitation = base44.entities.UserInvitation;

export const UserAccountAccess = base44.entities.UserAccountAccess;

export const AppSetting = base44.entities.AppSetting;

export const RepInvitation = base44.entities.RepInvitation;

export const MenuInvitation = base44.entities.MenuInvitation;

export const Location = base44.entities.Location;

export const InventoryItem = base44.entities.InventoryItem;

export const InventoryCountLog = base44.entities.InventoryCountLog;

export const InventoryReport = base44.entities.InventoryReport;

export const TrainingDocument = base44.entities.TrainingDocument;

export const PrepSession = base44.entities.PrepSession;

export const MenuTemplate = base44.entities.MenuTemplate;

export const RecipeVersion = base44.entities.RecipeVersion;

export const Glassware = base44.entities.Glassware;

export const RecipeCategory = base44.entities.RecipeCategory;

export const Profile = base44.entities.Profile;

export const RecipeAuditLog = base44.entities.RecipeAuditLog;

export const User = {
  ...base44.auth,
  list: async () => {
    return await base44.entities.Profile.list();
  },
  get: async (id) => {
    return await base44.entities.Profile.get(id);
  },
  update: async (id, payload) => {
    return await base44.entities.Profile.update(id, payload);
  },
  delete: async (id) => {
    return await base44.entities.Profile.delete(id);
  },
  filter: async (filters, limit) => {
    return await base44.entities.Profile.filter(filters, limit);
  }
};
import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Layout from './Layout.jsx';

import AcceptInvitation from './AcceptInvitation.jsx';
import AccessCodeOnboarding from './AccessCodeOnboarding.jsx';
import AccountDetails from './AccountDetails.jsx';
import Accounts from './Accounts.jsx';
import AdminUsers from './AdminUsers.jsx';
import Authentication from './Authentication.jsx';
import BuyerSpecs from './BuyerSpecs.jsx';
import CreateRecipe from './CreateRecipe.jsx';
import CreateSubRecipe from './CreateSubRecipe.jsx';
import CustomerMenuPreview from './CustomerMenuPreview.jsx';
import Dashboard from './Dashboard.jsx';
import EditRecipe from './EditRecipe.jsx';
import ImageUploadAudit from './ImageUploadAudit.jsx';
import IngredientSync from './IngredientSync.jsx';
import Ingredients from './Ingredients.jsx';
import Inventory from './Inventory.jsx';
import MenuBuilder from './MenuBuilder.jsx';
import MenuDetails from './MenuDetails.jsx';
import MenuReport from './MenuReport.jsx';
import Menus from './Menus.jsx';
import OpeningOrderTemplates from './OpeningOrderTemplates.jsx';
import RecipeBuilder from './RecipeBuilder.jsx';
import Presentation from './Presentation.jsx';
import PrintableMenu from './PrintableMenu.jsx';
import PublicMenuSpec from './PublicMenuSpec.jsx';
import Recipes from './Recipes.jsx';
import Settings from './Settings.jsx';
import SubRecipeDetail from './SubRecipeDetail.jsx';
import TestDistributorUpload from './TestDistributorUpload.jsx';
import UserProfile from './UserProfile.jsx';
import AuthRedirect from './AuthRedirect.jsx';

const PAGES = {
  AcceptInvitation,
  AccessCodeOnboarding,
  AccountDetails,
  Accounts,
  AdminUsers,
  Authentication,
  BuyerSpecs,
  CreateRecipe,
  CreateSubRecipe,
  CustomerMenuPreview,
  Dashboard,
  EditRecipe,
  ImageUploadAudit,
  IngredientSync,
  Ingredients,
  Inventory,
  MenuBuilder,
  MenuDetails,
  MenuReport,
  Menus,
  OpeningOrderTemplates,
  RecipeBuilder,
  Presentation,
  PrintableMenu,
  PublicMenuSpec,
  Recipes,
  Settings,
  SubRecipeDetail,
  TestDistributorUpload,
  UserProfile,
};

function _getCurrentPage(url) {
  if (!url || url === '/') {
    return 'Authentication';
  }
  if (url.endsWith('/')) {
    url = url.slice(0, -1);
  }
  let urlLastPart = url.split('/').pop();
  if (urlLastPart.includes('?')) {
    urlLastPart = urlLastPart.split('?')[0];
  }
  const pageName = Object.keys(PAGES).find(
    (page) => page.toLowerCase() === urlLastPart.toLowerCase()
  );
  return pageName || 'Dashboard';
}

function PagesContent() {
  const location = useLocation();
  const currentPage = _getCurrentPage(location.pathname);

  return (
    <Layout currentPageName={currentPage}>
      <Routes>
        {/* Root → nice auth screen */}
        <Route path="/" element={<Authentication />} />

        <Route path="/acceptinvitation" element={<AcceptInvitation />} />
        <Route path="/accesscodeonboarding" element={<AccessCodeOnboarding />} />
        <Route path="/accountdetails" element={<AccountDetails />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/adminusers" element={<AdminUsers />} />
        <Route path="/authentication" element={<Authentication />} />
        <Route path="/login" element={<AuthRedirect />} />
        <Route path="/signin" element={<AuthRedirect />} />
        <Route path="/buyerspecs" element={<BuyerSpecs />} />
        <Route path="/createrecipe" element={<CreateRecipe />} />
        <Route path="/createsubrecipe" element={<CreateSubRecipe />} />
        <Route path="/customermenupreview" element={<CustomerMenuPreview />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/editrecipe" element={<EditRecipe />} />
        <Route path="/imageuploadaudit" element={<ImageUploadAudit />} />
        <Route path="/ingredientsync" element={<IngredientSync />} />
        <Route path="/ingredients" element={<Ingredients />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/menubuilder" element={<MenuBuilder />} />
        <Route path="/menudetails" element={<MenuDetails />} />
        <Route path="/menureport" element={<MenuReport />} />
        <Route path="/menus" element={<Menus />} />
        <Route path="/openingordertemplates" element={<OpeningOrderTemplates />} />
        <Route path="/recipebuilder" element={<RecipeBuilder />} />
        <Route path="/presentation" element={<Presentation />} />
        <Route path="/printablemenu" element={<PrintableMenu />} />
        <Route path="/publicmenuspec" element={<PublicMenuSpec />} />
        <Route path="/recipes" element={<Recipes />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/subrecipedetail" element={<SubRecipeDetail />} />
        <Route path="/testdistributorupload" element={<TestDistributorUpload />} />
        <Route path="/userprofile" element={<UserProfile />} />
      </Routes>
    </Layout>
  );
}

export default function Pages() {
  return (
    <Router>
      <PagesContent />
    </Router>
  );
}
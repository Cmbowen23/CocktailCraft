
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { 
  Wine, 
  Building2,
  BookOpen,
  CalendarDays,
  User as UserIcon,
  Users,
  LogOut,
  Menu as MenuIcon,
  Search,
  ShoppingCart,
  Settings,
  Package,
  FlaskConical,
  Database
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { ShowTagsProvider } from "@/components/contexts/ShowTagsContext";
import { AppSettingsProvider } from "@/components/contexts/AppSettingsContext";
import CocktailLoader from "@/components/ui/CocktailLoader";

// Manual BottleWine icon definition – forwards className so sidebar styling works
const IconBottleWine = ({ className, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M10 3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a6 6 0 0 0 1.2 3.6l.6.8A6 6 0 0 1 17 13v8a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-8a6 6 0 0 1 1.2-3.6l.6-.8A6 6 0 0 0 10 5z" />
    <path d="M17 13h-4a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h4" />
  </svg>
);

// Helper function to retry base44.auth.me() with exponential backoff
const fetchUserWithRetry = async (maxAttempts = 3) => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const user = await base44.auth.me();
            if (user) {
                return user;
            }
        } catch (error) {
            if (attempt === maxAttempts) {
                return null;
            }
            const delay = 200 * Math.pow(2, attempt - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    return null;
};

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [currentUser, setCurrentUser] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isProcessingTokens, setIsProcessingTokens] = React.useState(false);

  React.useEffect(() => {
    const loadUserAndProcessTokens = async () => {
      try {
        const user = await fetchUserWithRetry();
        setCurrentUser(user);

        // Process Invitations if user is authenticated
        if (user) {
          const repCode = localStorage.getItem('cc_rep_code');
          const inviteToken = localStorage.getItem('cc_invite_token');

          if (repCode || inviteToken) {
            setIsProcessingTokens(true);
            try {
              const response = await base44.functions.invoke("processPostLoginToken", {
                repCode,
                inviteToken
              });
              
              const { repResult, buyerResult } = response.data;

              // Clear tokens after attempt
              localStorage.removeItem('cc_rep_code');
              localStorage.removeItem('cc_invite_token');

              if (buyerResult && buyerResult.success) {
                 window.location.href = createPageUrl(`MenuDetails?id=${buyerResult.menu_id}`);
                 return;
              }

              if (repResult && repResult.success) {
                window.location.href = createPageUrl("Dashboard");
                return;
              }

              if (response.data.repResult?.error || response.data.buyerResult?.error) {
                  console.warn("Invitation processing issues:", response.data);
              }

            } catch (err) {
              console.error("Error processing post-login tokens:", err);
            } finally {
              setIsProcessingTokens(false);
            }
          }
        }

      } catch (error) {
        console.error('Error loading user:', error);
        setCurrentUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    loadUserAndProcessTokens();
  }, []);

  React.useEffect(() => {
    // Redirect unauthenticated users to Authentication page
    if (!isLoading && !currentUser) {
      const isPublicPage = location.pathname.includes('AcceptInvitation') || location.pathname.includes('PublicLink') || location.pathname.includes('CustomerMenuPreview') || location.pathname.includes('Authentication') || location.pathname.includes('InviteWelcome') || location.pathname.toLowerCase().includes('/signin') || location.pathname.toLowerCase().includes('/login');

      if (!isPublicPage) {
          // Instead of auto-redirecting to potentially broken login, send to Authentication landing
          window.location.href = createPageUrl('Authentication');
      }
    } else if (currentUser && !isLoading) {
        // Prevent authenticated users from staying on Authentication page
        const isAuthPage = location.pathname.includes('Authentication');
        if (isAuthPage) {
            window.location.href = createPageUrl('Dashboard');
            return;
        }

        // Access Code Onboarding Check
        const isOnboardingPage = location.pathname.includes('AccessCodeOnboarding');
        const isBuyerAdmin = currentUser.user_type === 'buyer_admin';

        if (!currentUser.onboarding_complete && !isBuyerAdmin && !isOnboardingPage) {
             window.location.href = createPageUrl("AccessCodeOnboarding");
        }
    }
  }, [isLoading, currentUser, location.pathname]);

  const handleLogout = async () => {
    try {
      // Clear local user state
      setCurrentUser(null);

      // Clear tokens
      try {
        localStorage.removeItem('cc_rep_code');
        localStorage.removeItem('cc_invite_token');
      } catch (e) {
        console.warn('Unable to clear tokens', e);
      }

      // Log out of Base44 and redirect to Authentication page
      await base44.auth.logout(createPageUrl('Authentication'));
    } catch (error) {
      console.error('Error logging out:', error);
      window.location.href = createPageUrl('Authentication');
    }
  };

  // User Role Logic
  const isAdmin = currentUser?.role === 'admin';
  const isBuyerUser = !isAdmin && currentUser?.user_type === 'buyer_admin' && currentUser?.account_id;

  // Navigation Config
  const internalNavigationItems = [
    { title: "Dashboard", url: createPageUrl("Dashboard"), icon: CalendarDays },
    { title: "Accounts", url: createPageUrl("Accounts"), icon: Building2 },
    { title: "Menus", url: createPageUrl("Menus"), icon: MenuIcon },
    { title: "Recipes", url: createPageUrl("Recipes"), icon: BookOpen },
    { title: "Ingredients", url: createPageUrl("Ingredients"), icon: IconBottleWine },
    { title: "Inventory", url: createPageUrl("Inventory"), icon: Package },
    ...(isAdmin ? [{ title: "Prep", url: createPageUrl("PrepDashboard"), icon: FlaskConical }] : []),
    ...(isAdmin ? [{ title: "Training", url: createPageUrl("TrainingDocs"), icon: BookOpen }] : [])
  ];

  const builderNavigationItems = [
    { title: "Menu Builder", url: createPageUrl("MenuBuilder"), icon: Search },
    { title: "Recipe Builder", url: createPageUrl("RecipeBuilder"), icon: Wine },
    { title: "Order Builder", url: createPageUrl("OpeningOrderTemplates"), icon: ShoppingCart },
  ];

  const isOnPremise = currentUser?.user_type === 'on_premise';

  const buyerNavigationItems = [
      { title: "My Menus", url: createPageUrl(`AccountDetails?id=${currentUser?.account_id}`), icon: MenuIcon },
      { title: "Recipes", url: createPageUrl("Recipes"), icon: BookOpen },
      { title: "Ingredients", url: createPageUrl("Ingredients"), icon: IconBottleWine },
      ...(!isOnPremise ? [{ title: "Inventory", url: createPageUrl("Inventory"), icon: Package }] : []),
      { title: "Prep", url: createPageUrl("PrepDashboard"), icon: FlaskConical },
      { title: "Training", url: createPageUrl("TrainingDocs"), icon: BookOpen },
    ];

  const buyerBuilderNavigationItems = [
    { title: "Menu Builder", url: createPageUrl("MenuBuilder"), icon: Search },
    { title: "Recipe Builder", url: createPageUrl("RecipeBuilder"), icon: Wine },
    { title: "Order Builder", url: createPageUrl("OpeningOrderTemplates"), icon: ShoppingCart },
  ];

  const navigationItems = isBuyerUser ? buyerNavigationItems : internalNavigationItems;
  const builderItems = isBuyerUser ? buyerBuilderNavigationItems : builderNavigationItems;

  const settingsNavigation = [
    { title: "My Profile", url: createPageUrl("UserProfile"), icon: UserIcon },
  ];

  if (isAdmin) {
    settingsNavigation.push({ title: "User Management", url: createPageUrl("AdminUsers"), icon: Users });
    settingsNavigation.push({ title: "Recipe Cost Fix", url: createPageUrl("AdminRecipeCostFix"), icon: Settings });
    settingsNavigation.push({ title: "Export Data", url: createPageUrl("ExportData"), icon: Database });
    settingsNavigation.push({ title: "Export Schemas", url: createPageUrl("ExportSchemas"), icon: Database });
  }

  settingsNavigation.push({ title: "App Settings", url: createPageUrl("Settings"), icon: Settings });
  
  // Determine Layout Mode
  const isAuthPage = location.pathname.includes('Authentication') || location.pathname.toLowerCase().includes('/signin') || location.pathname.toLowerCase().includes('/login');
  const isPublicSharePage = location.pathname.includes('AcceptInvitation') || location.pathname.includes('PublicLink') || location.pathname.includes('CustomerMenuPreview');
  const isOnboarding = location.pathname.includes('AccessCodeOnboarding');
  
  // We hide the sidebar if:
  // 1. User is not logged in
  // 2. It's an authentication page
  // 3. It's a public share page (like a menu preview)
  // 4. It's the onboarding page
  // Note: We show sidebar on Home (/) if user IS logged in
  const shouldHideSidebar = !currentUser || isAuthPage || isPublicSharePage || isOnboarding;

  return (
    <AppSettingsProvider>
    <ShowTagsProvider>
      <style>
          {`
            @import url('https://fonts.googleapis.com/css2?family=Work+Sans:ital,wght@0,100..900;1,100..900&display=swap');
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&family=Playfair+Display:wght@400;600&family=Cormorant+Garamond:wght@400;600&family=Nunito:wght@300;600&family=Courier+Prime&family=Oswald:wght@300;500&display=swap');
            
            :root {
              --primary-blue-50: #eff6ff;
              --primary-blue-100: #dbeafe;
              --primary-blue-600: #2563eb;
              --primary-blue-700: #1d4ed8;
              --primary-blue-800: #1e40af;
              --neutral-white: #ffffff;
              --neutral-gray-50: #f9fafb;
              --neutral-gray-100: #f3f4f6;
              --neutral-gray-200: #e5e7eb;
              --neutral-gray-300: #d1d5db;
              --neutral-gray-400: #9ca3af;
              --neutral-gray-50: #6b7280;
              --neutral-gray-600: #4b5563;
              --neutral-gray-700: #374151;
              --neutral-gray-800: #1f2937;
              --neutral-gray-900: #111827;
            }
            
            * {
              font-family: 'Work Sans', sans-serif;
              letter-spacing: -0.025em;
            }
            
            .autofill-halo {
              border-color: var(--primary-blue-600) !important;
              box-shadow: 0 0 0 1px var(--primary-blue-100), 0 0 0 4px rgba(37, 99, 235, 0.2) !important;
              transition: box-shadow 0.3s ease-in-out, border-color 0.3s ease-in-out;
            }

            .font-modern {
              font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            }
            .font-classic {
              font-family: 'Playfair Display', 'Georgia', serif;
            }
            .font-elegant {
              font-family: 'Cormorant Garamond', 'Times New Roman', serif;
            }
            .font-rounded {
              font-family: 'Nunito', system-ui, sans-serif;
            }
            .font-typewriter {
              font-family: 'Courier Prime', 'Courier New', monospace;
            }
            .font-condensed {
              font-family: 'Oswald', 'Arial Narrow', sans-serif;
            }
          `}
        </style>

        {shouldHideSidebar ? (
          /* Full Screen Layout */
          <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 to-white overflow-x-hidden">
             {isLoading ? (
                <div className="h-screen w-full flex items-center justify-center">
                   <CocktailLoader className="w-24 h-24 text-blue-600" />
                </div>
             ) : (
                children
             )}
          </div>
        ) : (
          /* Authenticated Sidebar Layout */
          <SidebarProvider>
            <div className="min-h-screen flex w-full bg-gradient-to-br from-gray-50 to-white overflow-x-hidden">
              <Sidebar collapsible="icon" className="border-r border-gray-200 bg-white">
                <SidebarHeader className="border-b border-gray-200 p-6 group-data-[collapsible=icon]:p-4 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
                  <div className="flex items-center justify-between w-full group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-3">
                    <Link to={isBuyerUser ? createPageUrl(`AccountDetails?id=${currentUser?.account_id}`) : createPageUrl("Dashboard")} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-md flex-shrink-0">
                        <Wine className="w-6 h-6 text-white" />
                      </div>
                      <div className="group-data-[collapsible=icon]:hidden">
                        <h2 className="font-bold text-gray-900 text-lg">CocktailCraft</h2>
                        <p className="text-xs text-gray-600 font-medium">Professional Bar Management</p>
                      </div>
                    </Link>
                    <SidebarTrigger className="text-gray-500 hover:bg-gray-100 rounded-md p-1" />
                  </div>
                </SidebarHeader>
                
                <SidebarContent className="p-4">
                  {isLoading || isProcessingTokens ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                      <CocktailLoader className="w-8 h-8 text-blue-600" />
                      {isProcessingTokens && <span className="text-xs text-gray-500">Processing invitation...</span>}
                    </div>
                  ) : (
                    <>
                      <SidebarGroup>
                        <SidebarGroupLabel className="text-xs font-semibold text-gray-700 uppercase tracking-wider px-2 py-3 group-data-[collapsible=icon]:hidden">
                          Navigation
                        </SidebarGroupLabel>
                        <SidebarGroupContent>
                          <SidebarMenu className="space-y-1 group-data-[collapsible=icon]:space-y-1 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
                            {navigationItems.map((item) => (
                              <SidebarMenuItem key={item.title} className="group-data-[collapsible=icon]:w-auto">
                                <SidebarMenuButton 
                                  asChild 
                                  tooltip={item.title}
                                  className={`hover:bg-blue-50 hover:text-blue-700 transition-all duration-200 rounded-lg group ${
                                    location.pathname.startsWith(item.url)
                                      ? 'bg-blue-50 text-blue-700 shadow-sm' 
                                      : 'text-gray-600'
                                  }`}
                                >
                                  <Link to={item.url} className="flex items-center gap-3 px-4 py-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-3 group-data-[collapsible=icon]:py-3">
                                    <item.icon className={`w-5 h-5 transition-colors ${
                                      location.pathname.startsWith(item.url) ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-500'
                                    }`} />
                                    <span className="font-medium group-data-[collapsible=icon]:hidden">{item.title}</span>
                                  </Link>
                                </SidebarMenuButton>
                              </SidebarMenuItem>
                            ))}
                          </SidebarMenu>
                        </SidebarGroupContent>
                      </SidebarGroup>

                      <SidebarGroup className="mt-4 pt-4 border-t border-gray-200 group-data-[collapsible=icon]:border-t-0 group-data-[collapsible=icon]:pt-0">
                        <SidebarGroupLabel className="text-xs font-semibold text-gray-700 uppercase tracking-wider px-2 py-3 group-data-[collapsible=icon]:hidden">
                          Builders
                        </SidebarGroupLabel>
                        <SidebarGroupContent>
                          <SidebarMenu className="space-y-1 group-data-[collapsible=icon]:space-y-1 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
                            {builderItems.map((item) => (
                              <SidebarMenuItem key={item.title} className="group-data-[collapsible=icon]:w-auto">
                                <SidebarMenuButton 
                                  asChild 
                                  tooltip={item.title}
                                  className={`hover:bg-blue-50 hover:text-blue-700 transition-all duration-200 rounded-lg group ${
                                    location.pathname.startsWith(item.url)
                                      ? 'bg-blue-50 text-blue-700 shadow-sm' 
                                      : 'text-gray-600'
                                  }`}
                                >
                                  <Link to={item.url} className="flex items-center gap-3 px-4 py-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-3 group-data-[collapsible=icon]:py-3">
                                    <item.icon className={`w-5 h-5 transition-colors ${
                                      location.pathname.startsWith(item.url) ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-500'
                                    }`} />
                                    <span className="font-medium group-data-[collapsible=icon]:hidden">{item.title}</span>
                                  </Link>
                                </SidebarMenuButton>
                              </SidebarMenuItem>
                            ))}
                          </SidebarMenu>
                        </SidebarGroupContent>
                      </SidebarGroup>
                      
                      <SidebarGroup className="mt-auto pt-4 border-t border-gray-200 group-data-[collapsible=icon]:border-t-0 group-data-[collapsible=icon]:pt-0">
                        <SidebarGroupLabel className="text-xs font-semibold text-gray-700 uppercase tracking-wider px-2 py-3 group-data-[collapsible=icon]:hidden">
                          Settings
                        </SidebarGroupLabel>
                        <SidebarGroupContent>
                          <SidebarMenu className="space-y-1 group-data-[collapsible=icon]:space-y-1 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
                            {settingsNavigation.map((item) => (
                              <SidebarMenuItem key={item.title} className="group-data-[collapsible=icon]:w-auto">
                                <SidebarMenuButton 
                                  asChild 
                                  tooltip={item.title}
                                  className={`hover:bg-blue-50 hover:text-blue-700 transition-all duration-200 rounded-lg group ${
                                    location.pathname.startsWith(item.url)
                                      ? 'bg-blue-50 text-blue-700 shadow-sm' 
                                      : 'text-gray-600'
                                  }`}
                                >
                                  <Link to={item.url} className="flex items-center gap-3 px-4 py-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-3 group-data-[collapsible=icon]:py-3">
                                    <item.icon className={`w-5 h-5 transition-colors ${
                                      location.pathname.startsWith(item.url) ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-500'
                                    }`} />
                                    <span className="font-medium group-data-[collapsible=icon]:hidden">{item.title}</span>
                                  </Link>
                                </SidebarMenuButton>
                              </SidebarMenuItem>
                            ))}
                          </SidebarMenu>
                        </SidebarGroupContent>
                      </SidebarGroup>
                    </>
                  )}
                </SidebarContent>

                <SidebarFooter className="border-t border-gray-200 p-4 group-data-[collapsible=icon]:p-2">
                  {currentUser && (
                    <div className="space-y-2 group-data-[collapsible=icon]:space-y-0">
                      <div className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 group-data-[collapsible=icon]:hidden">
                        <p className="text-sm font-medium text-gray-900 truncate">{currentUser.full_name}</p>
                        <p className="text-xs text-gray-600 truncate">{currentUser.email}</p>
                        {currentUser.company_name && (
                          <p className="text-xs text-gray-600 mt-1 truncate">{currentUser.company_name}</p>
                        )}
                      </div>
                      
                      {/* Collapsed User Profile Trigger */}
                      <div className="hidden group-data-[collapsible=icon]:flex items-center justify-center w-full py-2">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-xs border border-blue-200" title={currentUser.full_name}>
                            {currentUser.full_name ? currentUser.full_name.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4" />}
                        </div>
                      </div>

                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-red-50 hover:text-red-700 rounded-lg transition-colors group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2"
                        title="Logout"
                      >
                        <LogOut className="w-4 h-4" />
                        <span className="group-data-[collapsible=icon]:hidden">Logout</span>
                      </button>
                    </div>
                  )}
                </SidebarFooter>
              </Sidebar>

              <main className="flex-1 flex flex-col min-h-screen">
                <header className="bg-white border-b border-gray-200 px-6 py-4 flex md:hidden">
                  <div className="flex items-center gap-4">
                    <SidebarTrigger className="hover:bg-blue-50 p-2 rounded-lg transition-colors duration-200" />
                    <Link to={isBuyerUser ? createPageUrl(`AccountDetails?id=${currentUser?.account_id}`) : createPageUrl("Dashboard")} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                      <Wine className="w-6 h-6 text-blue-600" />
                      <h1 className="text-lg font-bold text-gray-900">CocktailCraft</h1>
                    </Link>
                  </div>
                </header>

                <div className="flex-1 overflow-auto bg-gray-50 flex flex-col">
                  <div className="flex-1">
                    {isLoading ? (
                      <div className="h-full flex items-center justify-center">
                          <CocktailLoader className="w-24 h-24 text-blue-600" />
                      </div>
                    ) : (
                      children
                    )}
                  </div>
                  <footer className="py-4 px-6 border-t border-gray-200 bg-white text-center text-xs text-gray-400">
                    <a href="https://www.flaticon.com/free-animated-icons/jigger" title="jigger animated icons" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 transition-colors">
                      Jigger animated icons created by Freepik - Flaticon
                    </a>
                  </footer>
                </div>
              </main>
            </div>
          </SidebarProvider>
        )}
    </ShowTagsProvider>
    </AppSettingsProvider>
  );
}

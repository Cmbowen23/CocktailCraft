import { createClient } from '@base44/sdk';
// import { getAccessToken } from '@base44/sdk/utils/auth-utils';

// Create a client with authentication required
export const base44 = createClient({
  appId: "68648b7f4ac37377589a671c", 
  requiresAuth: true // Ensure authentication is required for all operations
});

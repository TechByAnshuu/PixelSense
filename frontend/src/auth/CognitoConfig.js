/**
 * CognitoConfig.js
 *
 * AWS Amplify v6 configuration for Cognito User Pool authentication.
 * All values come from environment variables injected by Vite at build time.
 *
 * Set these in a .env file (never commit to git):
 *   VITE_COGNITO_REGION=us-east-1
 *   VITE_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
 *   VITE_COGNITO_CLIENT_ID=XXXXXXXXXXXXXXXXXXXX
 *   VITE_API_BASE_URL=https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/dev
 */

export const cognitoConfig = {
  Auth: {
    Cognito: {
      region:           import.meta.env.VITE_COGNITO_REGION     || 'us-east-1',
      userPoolId:       import.meta.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
      loginWith: {
        email: true,
      },
    },
  },
};

// API base URL — exported for use in apiClient.js
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

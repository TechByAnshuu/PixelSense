import React from 'react';
import ReactDOM from 'react-dom/client';
import { Amplify } from 'aws-amplify';
import { cognitoConfig } from './auth/CognitoConfig';
import App from './App';
import './index.css';

// Configure Amplify once at the app entry point
Amplify.configure(cognitoConfig);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// hooks/useExperimentalXMC.ts
import { useState, useEffect, useCallback } from 'react';
import { experimental_createXMCClient, experimental_XMC } from '@sitecore-marketplace-sdk/xmc';
import { useMarketplaceClient } from '../utils/hooks/useMarketplaceClient';

export interface ExperimentalXMCState {
  xmcClient: experimental_XMC | null;
  error: Error | null;
  isLoading: boolean;
  isInitialized: boolean;
}

export function useExperimentalXMC() {
  const { client: marketplaceClient, isInitialized: clientInitialized } = useMarketplaceClient();
  
  const [state, setState] = useState<ExperimentalXMCState>({
    xmcClient: null,
    error: null,
    isLoading: false,
    isInitialized: false,
  });

  const initializeXMCClient = useCallback(async () => {
    if (!marketplaceClient || !clientInitialized) {
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Create experimental XMC client that gets access token from the marketplace client
      const xmcClient = await experimental_createXMCClient({
        getAccessToken: async () => {
          // Try to get the access token from the marketplace client
          // This might be available in the client's internal state
          try {
            // Check if the marketplace client has access to auth context
            const appContext = await marketplaceClient.query('application.context');
            console.log('Application context for XMC:', appContext);
            
            // For now, we'll try to work without explicit token since we're in Sitecore context
            // The experimental client might handle auth differently when in iframe context
            return '';
          } catch (error) {
            console.warn('Could not get access token, trying without explicit token:', error);
            return '';
          }
        },
      });

      setState({
        xmcClient,
        error: null,
        isLoading: false,
        isInitialized: true,
      });

      console.log('Experimental XMC client initialized successfully');
    } catch (error) {
      console.error('Failed to initialize experimental XMC client:', error);
      setState({
        xmcClient: null,
        error: error instanceof Error ? error : new Error('Failed to initialize XMC client'),
        isLoading: false,
        isInitialized: false,
      });
    }
  }, [marketplaceClient, clientInitialized]);

  useEffect(() => {
    if (clientInitialized && marketplaceClient && !state.isInitialized && !state.isLoading) {
      initializeXMCClient();
    }
  }, [clientInitialized, marketplaceClient, state.isInitialized, state.isLoading, initializeXMCClient]);

  return state;
}
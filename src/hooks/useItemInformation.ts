// hooks/useItemInformation.ts
import { useState, useEffect, useCallback } from 'react';
import { useMarketplaceClient } from '../utils/hooks/useMarketplaceClient';
import { getItemsFromAuthoring, getItemsFromLive } from '../utils/graphqlQueries';
import { 
  extractItemIds, 
  processItemData, 
  createItemInformationResponse 
} from '../utils/dataProcessing';
import type { 
  ItemInformationResponse, 
  ProcessedItemInfo 
} from '../types/itemInformation';

export interface UseItemInformationResult {
  /** The processed item information response */
  data: ItemInformationResponse | null;
  /** Individual processed items for direct access */
  items: ProcessedItemInfo[];
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: string | null;
  /** Function to manually refetch data */
  refetch: () => Promise<void>;
  /** Function to refetch only a specific set of items */
  refetchItems: (itemIds: string[]) => Promise<void>;
}

export const useItemInformation = (): UseItemInformationResult => {
  const { client, error: clientError, isInitialized } = useMarketplaceClient();
  const [data, setData] = useState<ItemInformationResponse | null>(null);
  const [items, setItems] = useState<ProcessedItemInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchItemInformation = useCallback(async (specificItemIds?: string[]) => {
    if (!client || !isInitialized) {
      setError('Marketplace client not initialized');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let itemIds: string[] = [];
      let currentItemId: string | undefined;

      if (specificItemIds && specificItemIds.length > 0) {
        itemIds = specificItemIds;
        // For specific items, assume the first one is current (could be improved)
        currentItemId = specificItemIds[0];
      } else {
        // Get current context to identify items
        const { data: pageContext } = await client.query('pages.context');
        console.log('Page context retrieved:', pageContext);
        
        // Extract current item ID from page context
        if (pageContext && typeof pageContext === 'object') {
          const context = pageContext as Record<string, unknown>;
          
          // Try to find current item ID in pageInfo first
          if (context.pageInfo && typeof context.pageInfo === 'object') {
            const pageInfo = context.pageInfo as Record<string, unknown>;
            currentItemId = pageInfo.itemId as string || 
                           pageInfo.id as string ||
                           pageInfo.pageId as string;
          }
          
          // Fallback to other locations
          if (!currentItemId) {
            currentItemId = context.itemId as string || 
                           context.id as string ||
                           context.pageId as string;
          }
        }
        
        // Extract item IDs from context
        itemIds = extractItemIds(pageContext);
        
        if (itemIds.length === 0) {
          throw new Error('No item IDs found in current context');
        }
        
        // Make sure currentItemId is in the itemIds array
        if (currentItemId && !itemIds.includes(currentItemId)) {
          itemIds.unshift(currentItemId); // Add to beginning
        } else if (!currentItemId && itemIds.length > 0) {
          currentItemId = itemIds[0]; // Use first item as fallback
        }
      }

      console.log('Fetching information for items:', itemIds);
      console.log('Current item ID identified as:', currentItemId);

      // Get application context to extract sitecoreContextId (official approach)
      let sitecoreContextId: string | undefined;
      try {
        const { data: appContext } = await client.query('application.context');
        console.log('Application context retrieved:', appContext);
        
        // Extract sitecoreContextId according to official documentation
        sitecoreContextId = appContext?.resourceAccess?.[0]?.context?.preview;
        
        if (!sitecoreContextId) {
          console.error('Sitecore Context ID not found in application context. Make sure your app is configured to use XM Cloud APIs.');
          // Try alternative locations as fallback
          sitecoreContextId = appContext?.resourceAccess?.[0]?.context?.live ||
                              (appContext as Record<string, unknown>)?.sitecoreContextId as string;
        }
        
        console.log('Extracted sitecore context ID:', sitecoreContextId);
      } catch (error) {
        console.error('Failed to get application context:', error);
      }

      // Query both endpoints in parallel for better performance
      const [authoringResult, liveResult] = await Promise.all([
        getItemsFromAuthoring(client, itemIds, sitecoreContextId),
        getItemsFromLive(client, itemIds, sitecoreContextId)
      ]);

      console.log('Authoring result:', authoringResult);
      console.log('Live result:', liveResult);

      // Process the data
      const processedItems = processItemData(
        authoringResult,
        liveResult,
        itemIds,
        currentItemId // Use the correctly identified current item ID
      );

      // Create the complete response
      const itemInformationResponse = createItemInformationResponse(processedItems);

      setData(itemInformationResponse);
      setItems(processedItems);

      console.log('Processed item information:', {
        response: itemInformationResponse,
        items: processedItems
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('Error fetching item information:', err);
      setError(errorMessage);
      setData(null);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [client, isInitialized]);

  const refetchItems = useCallback(async (itemIds: string[]) => {
    await fetchItemInformation(itemIds);
  }, [fetchItemInformation]);

  const refetch = useCallback(async () => {
    await fetchItemInformation();
  }, [fetchItemInformation]);

  // Initial load
  useEffect(() => {
    if (isInitialized && !clientError) {
      fetchItemInformation();
    } else if (clientError) {
      setError(clientError.message || 'Client initialization error');
    }
  }, [isInitialized, clientError, fetchItemInformation]);

  return {
    data,
    items,
    loading,
    error,
    refetch,
    refetchItems
  };
};

/**
 * Hook for getting information about a specific set of items
 */
export const useSpecificItemsInformation = (itemIds: string[]): UseItemInformationResult => {
  const { client, error: clientError, isInitialized } = useMarketplaceClient();
  const [data, setData] = useState<ItemInformationResponse | null>(null);
  const [items, setItems] = useState<ProcessedItemInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSpecificItems = useCallback(async () => {
    if (!client || !isInitialized || itemIds.length === 0) {
      setError(itemIds.length === 0 ? 'No item IDs provided' : 'Marketplace client not initialized');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Fetching specific items:', itemIds);

      const [authoringResult, liveResult] = await Promise.all([
        getItemsFromAuthoring(client, itemIds),
        getItemsFromLive(client, itemIds)
      ]);

      const processedItems = processItemData(
        authoringResult,
        liveResult,
        itemIds,
        itemIds[0]
      );

      const itemInformationResponse = createItemInformationResponse(processedItems);

      setData(itemInformationResponse);
      setItems(processedItems);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('Error fetching specific items:', err);
      setError(errorMessage);
      setData(null);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [client, isInitialized, itemIds]);

  const refetch = useCallback(async () => {
    await fetchSpecificItems();
  }, [fetchSpecificItems]);

  const refetchItems = useCallback(async () => {
    // For this hook, refetchItems would need to be handled by parent component
    // since it changes the itemIds dependency
    console.warn('refetchItems called on useSpecificItemsInformation - use parent component to change itemIds');
    await fetchSpecificItems();
  }, [fetchSpecificItems]);

  useEffect(() => {
    if (isInitialized && !clientError && itemIds.length > 0) {
      fetchSpecificItems();
    } else if (clientError) {
      setError(clientError.message || 'Client initialization error');
    }
  }, [isInitialized, clientError, fetchSpecificItems, itemIds.length]);

  return {
    data,
    items,
    loading,
    error,
    refetch,
    refetchItems
  };
};
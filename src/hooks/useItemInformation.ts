// hooks/useItemInformation.ts
import { useState, useEffect, useCallback } from 'react';
import { useMarketplaceClient } from '../utils/hooks/useMarketplaceClient';
import { 
  getItemsFromAuthoring, 
  getItemsFromLive, 
  resolveLocalDatasourcePaths 
} from '../utils/graphqlQueries';
import { 
  extractItemIdsWithLocalPaths,
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
  /** Function to force refresh (clears cache and refetches) */
  forceRefresh: () => void;
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
      let pageContext: unknown = null;
      let localPathsToResolve: string[] = [];
      let currentPagePath = '';

      if (specificItemIds && specificItemIds.length > 0) {
        itemIds = specificItemIds;
        // For specific items, assume the first one is current (could be improved)
        currentItemId = specificItemIds[0];
      } else {
        // Get current context to identify items
        const { data: contextData } = await client.query('pages.context');
        pageContext = contextData;
        console.log('🔍 Page context retrieved for current page:', pageContext);
        
        // Log key identifiers to help debug page navigation issues
        const context = pageContext as Record<string, unknown>;
        const pageInfo = context?.pageInfo as Record<string, unknown>;
        const currentPageId = pageInfo?.id as string;
        const currentPageName = pageInfo?.name as string;
        console.log('📄 Current page details:', {
          id: currentPageId,
          name: currentPageName, 
          path: pageInfo?.path as string
        });
        
        // Extract ALL items from context (current + editable items)
        const extractionResult = extractItemIdsWithLocalPaths(pageContext);
        itemIds = extractionResult.itemIds;
        localPathsToResolve = extractionResult.localPathsToResolve;
        currentPagePath = extractionResult.currentPagePath;
        
        console.log('All items from context:', itemIds);
        console.log('Local paths to resolve:', localPathsToResolve);
        console.log('Current page path:', currentPagePath);
        
        if (itemIds.length === 0) {
          throw new Error('No item IDs found in current context');
        }
        
        // The first item should be the current page item (extractItemIds puts it first)
        currentItemId = itemIds[0];
        console.log('Current item ID identified as:', currentItemId);
      }

      console.log('Fetching information for initial items:', itemIds);
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

      // Resolve local datasource paths to item IDs if needed
      if (localPathsToResolve.length > 0 && sitecoreContextId) {
        console.log('🔍 Resolving local datasource paths:', localPathsToResolve);
        try {
          const resolvedPaths = await resolveLocalDatasourcePaths(
            client, 
            localPathsToResolve, 
            currentPagePath, 
            sitecoreContextId
          );
          
          // Add resolved item IDs to the list
          Object.values(resolvedPaths).forEach(resolvedId => {
            if (resolvedId && !itemIds.includes(resolvedId)) {
              console.log(`✅ Adding resolved datasource item: ${resolvedId}`);
              itemIds.push(resolvedId);
            }
          });
          
          console.log('📝 Updated item IDs after local path resolution:', itemIds);
        } catch (error) {
          console.error('❌ Error resolving local datasource paths:', error);
        }
      }

      // Query all items (from context) for both authoring and live data
      console.log('Querying authoring and live data for', itemIds.length, 'items...');
      console.log('🔍 Checking for target item 9C8262E4-6456-4946-B04E-D5873874615E in final list:', 
                  itemIds.includes('9C8262E4-6456-4946-B04E-D5873874615E') ? '✅ FOUND' : '❌ MISSING');
      
      const [authoringResult, liveResult] = await Promise.all([
        getItemsFromAuthoring(client, itemIds, sitecoreContextId),
        getItemsFromLive(client, itemIds, sitecoreContextId)
      ]);

      console.log('Final authoring result for', itemIds.length, 'items:', authoringResult);
      console.log('Final live result for', itemIds.length, 'items:', liveResult);

      // Process the data
      const processedItems = processItemData(
        authoringResult,
        liveResult,
        itemIds,
        currentItemId
      );

      // Create the complete response
      const itemInformationResponse = createItemInformationResponse(processedItems);

      setData(itemInformationResponse);
      setItems(processedItems);

      console.log('Processed item information:', {
        totalItems: itemIds.length,
        currentItem: itemInformationResponse.currentItem,
        referencedItems: itemInformationResponse.referencedItems.length,
        summary: itemInformationResponse.summary
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

  // Add a mechanism to force refresh when page changes
  // This is important for when navigating between different pages in Sitecore
  const forceRefresh = useCallback(() => {
    console.log('🔄 Force refresh triggered - clearing cached data');
    setData(null);
    setItems([]);
    setError(null);
    fetchItemInformation();
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
    refetchItems,
    forceRefresh
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

  const forceRefresh = useCallback(async () => {
    console.log('Force refresh triggered');
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
    refetchItems,
    forceRefresh
  };
};
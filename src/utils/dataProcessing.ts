// utils/dataProcessing.ts
import type { 
  ProcessedItemInfo, 
  ItemInformationResponse,
  ItemInformationSummary,
  AuthoringItemResponse,
  LiveItemResponse,
  ItemType,
  ItemQueryResult
} from '../types/itemInformation';

/**
 * Extract item IDs from pages context
 * This function should extract the current page item ID and any related items
 */
export const extractItemIds = (pageContext: unknown): string[] => {
  console.log('Pages context:', pageContext);
  
  if (!pageContext || typeof pageContext !== 'object') {
    console.warn('Invalid page context provided');
    return [];
  }

  const context = pageContext as Record<string, unknown>;
  const itemIds: string[] = [];

  // Try to extract current page item ID from different possible locations
  let currentItemId: string | undefined;

  // Check pageInfo for current item
  if (context.pageInfo && typeof context.pageInfo === 'object') {
    const pageInfo = context.pageInfo as Record<string, unknown>;
    
    // Common locations for current item ID
    currentItemId = pageInfo.itemId as string || 
                   pageInfo.id as string ||
                   pageInfo.pageId as string;
    
    console.log('Found current item ID from pageInfo:', currentItemId);
  }

  // Check siteInfo for current item (fallback)
  if (!currentItemId && context.siteInfo && typeof context.siteInfo === 'object') {
    const siteInfo = context.siteInfo as Record<string, unknown>;
    currentItemId = siteInfo.itemId as string || siteInfo.id as string;
    console.log('Found current item ID from siteInfo:', currentItemId);
  }

  // Check root level for item ID (fallback)
  if (!currentItemId) {
    currentItemId = context.itemId as string || 
                   context.id as string ||
                   context.pageId as string;
    console.log('Found current item ID from root context:', currentItemId);
  }

  // Add current item ID if found
  if (currentItemId && typeof currentItemId === 'string') {
    itemIds.push(currentItemId);
  } else {
    console.warn('Could not extract current item ID from page context');
    // Return empty array instead of mock data when we can't find the actual item
    return [];
  }

  // TODO: Extract related items (datasources, references, etc.) from the context
  // For now, we'll just return the current item
  
  console.log('Extracted item IDs:', itemIds);
  return itemIds;
};

/**
 * Determine item type based on context and relationships
 */
export const determineItemType = (itemId: string, currentItemId?: string): ItemType => {
  if (itemId === currentItemId) {
    return 'current';
  }
  
  // TODO: Implement logic to determine if item is datasource, link, or reference
  // This would require analyzing the item's relationship to the current item
  
  // Placeholder logic
  return 'reference';
};

/**
 * Process raw GraphQL responses into ProcessedItemInfo objects
 */
export const processItemData = (
  authoringResult: ItemQueryResult,
  liveResult: ItemQueryResult,
  itemIds: string[],
  currentItemId?: string
): ProcessedItemInfo[] => {
  const processedItems: ProcessedItemInfo[] = [];

  // Validate both responses
  const authoringValidation = validateResponse(authoringResult);
  const liveValidation = validateResponse(liveResult);

  if (!authoringValidation.isValid) {
    console.error('Authoring data validation failed:', authoringValidation.errors);
  }

  if (!liveValidation.isValid) {
    console.error('Live data validation failed:', liveValidation.errors);
  }

  itemIds.forEach((itemId, index) => {
    const authoringItem = authoringValidation.data?.[`item${index}`] as AuthoringItemResponse | undefined;
    const liveItem = liveValidation.data?.[`item${index}`] as LiveItemResponse | undefined;

    console.log(`Processing item ${index} (${itemId}):`);
    console.log('  Authoring item:', authoringItem);
    console.log('  Live item:', liveItem);

    const latestVersion = authoringItem?.version || 0;
    const publishedVersion = liveItem?.version || null;
    const isPublished = publishedVersion !== null;
    const isOutdated = isPublished && publishedVersion < latestVersion;

    console.log(`  Latest version: ${latestVersion}, Published version: ${publishedVersion}`);

    processedItems.push({
      id: itemId,
      name: authoringItem?.name || liveItem?.name || 'Unknown Item',
      path: authoringItem?.path || '',
      latestVersion,
      publishedVersion,
      isPublished,
      isOutdated,
      versionDifference: isPublished ? latestVersion - publishedVersion : latestVersion,
      itemType: determineItemType(itemId, currentItemId),
      template: authoringItem?.template?.name,
      language: authoringItem?.language?.name || liveItem?.language?.name || 'en'
    });
  });

  return processedItems;
};

/**
 * Generate summary statistics from processed item data
 */
export const generateSummary = (items: ProcessedItemInfo[]): ItemInformationSummary => {
  return {
    totalItems: items.length,
    publishedItems: items.filter(item => item.isPublished).length,
    unpublishedItems: items.filter(item => !item.isPublished).length,
    outdatedItems: items.filter(item => item.isOutdated).length
  };
};

/**
 * Create complete ItemInformationResponse from processed items
 */
export const createItemInformationResponse = (
  items: ProcessedItemInfo[]
): ItemInformationResponse => {
  const currentItem = items.find(item => item.itemType === 'current');
  const referencedItems = items.filter(item => item.itemType !== 'current');

  // If no current item is explicitly marked, use the first item
  const finalCurrentItem = currentItem || items[0];
  const finalReferencedItems = currentItem ? referencedItems : items.slice(1);

  return {
    currentItem: finalCurrentItem || {
      id: 'unknown',
      name: 'No Current Item',
      path: '',
      latestVersion: 0,
      publishedVersion: null,
      isPublished: false,
      isOutdated: false,
      versionDifference: 0,
      itemType: 'current'
    },
    referencedItems: finalReferencedItems,
    summary: generateSummary(items)
  };
};

/**
 * Helper function to validate GraphQL response structure
 */
const validateResponse = (response: ItemQueryResult): {
  isValid: boolean;
  errors: string[];
  data: Record<string, unknown> | null;
} => {
  const errors: string[] = [];

  if (response.error) {
    errors.push(`Response error: ${String(response.error)}`);
    return { isValid: false, errors, data: null };
  }

  if (!response.data?.data) {
    errors.push('No data in response');
    return { isValid: false, errors, data: null };
  }

  if (response.data.errors && response.data.errors.length > 0) {
    response.data.errors.forEach((error: unknown) => {
      if (typeof error === 'object' && error !== null && 'message' in error) {
        errors.push(`GraphQL error: ${String((error as { message: unknown }).message)}`);
      } else {
        errors.push(`GraphQL error: ${String(error)}`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: response.data.data as Record<string, unknown>
  };
};

/**
 * Extract datasource references from item fields
 * This would analyze the item's fields to find references to other items
 */
export const extractDatasourceReferences = (item: AuthoringItemResponse): string[] => {
  const references: string[] = [];
  
  if (!item.fields?.nodes) {
    return references;
  }

  // Look for fields that might contain item references
  item.fields.nodes.forEach(field => {
    // Check for GUID patterns in field values (Sitecore item IDs)
    const guidRegex = /\{?[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\}?/g;
    const matches = field.value.match(guidRegex);
    
    if (matches) {
      matches.forEach(match => {
        const cleanGuid = match.replace(/[{}]/g, '').toUpperCase();
        if (!references.includes(cleanGuid)) {
          references.push(cleanGuid);
        }
      });
    }
  });

  return references;
};

/**
 * Extract all related item IDs from the current item's data
 */
export const extractAllRelatedItems = (
  pageContext: unknown,
  authoringItem?: AuthoringItemResponse
): string[] => {
  const itemIds = new Set<string>();

  // Add current item ID from context
  const contextIds = extractItemIds(pageContext);
  contextIds.forEach(id => itemIds.add(id));

  // Add datasource references if we have authoring item data
  if (authoringItem) {
    const datasourceRefs = extractDatasourceReferences(authoringItem);
    datasourceRefs.forEach(id => itemIds.add(id));
  }

  return Array.from(itemIds);
};
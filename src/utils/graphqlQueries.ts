// utils/graphqlQueries.ts
import { ClientSDK } from '@sitecore-marketplace-sdk/client';
import type { ItemQueryResult } from '../types/itemInformation';
import { formatGuidWithHyphens } from './dataProcessing';

// Configuration for direct live endpoint calls
const LIVE_ENDPOINT = 'https://edge.sitecorecloud.io/api/graphql/v1';
const LIVE_TOKEN = 'YWZGOHA4NmhnRXZZNVJhWmttQ1FMbWd2em5QejlIU1IzSjJxejZ4SWlrdz18cHJvZmVzc2lvbmFhZDQ3LXBzc2hhcmVkMjNkYi1wc3NoYXJlZGRldmFkNjgtNjUyZQ==';

/**
 * Format GUID for live endpoint (needs hyphens)
 */
export const formatGuidForLive = (guid: string): string => {
  return formatGuidWithHyphens(guid);
};

/**
 * Query the authoring endpoint for multiple items to get latest versions
 */
export const getItemsFromAuthoring = async (
  client: ClientSDK,
  itemIds: string[],
  sitecoreContextId?: string
): Promise<ItemQueryResult> => {
  if (!client || itemIds.length === 0) {
    return { data: { data: {} } };
  }

  if (!sitecoreContextId) {
    throw new Error('sitecoreContextId is required for authoring GraphQL queries');
  }

  const query = `
    query GetAuthoringItems {
      ${itemIds.map((id, index) => `
        item${index}: item(where: {
          database: "master"
          itemId: "${id}"
          language: "en"
        }) {
          itemId
          name
          path
          version
          template {
            name
          }
          language {
            name
          }
          fields {
            nodes {
              name
              value
            }
          }
        }
      `).join('')}
    }
  `;

  try {
    console.log('Executing authoring GraphQL query with item IDs:', itemIds);
    console.log('sitecoreContextId:', sitecoreContextId);
    console.log('Query:', query.trim());
    
    // Use official SDK approach with sitecoreContextId in query params
    const result = await client.mutate('xmc.authoring.graphql', {
      params: {
        query: {
          sitecoreContextId
        },
        body: {
          query: query.trim()
        }
      }
    });

    console.log('Authoring GraphQL result:', result);
    
    // Add detailed logging to understand the response structure
    if (result?.data?.data) {
      const responseData = result.data.data;
      console.log('Authoring GraphQL response data:', responseData);
      Object.keys(responseData).forEach(key => {
        console.log(`Authoring item ${key}:`, responseData[key]);
      });
    }
    
    return result;
  } catch (error) {
    console.error('Error querying authoring endpoint:', error);
    return { error };
  }
};

/**
 * Query the live endpoint for multiple items to get published versions
 * Uses direct HTTP call to ensure we hit the correct Experience Edge endpoint
 */
export const getItemsFromLive = async (
  _client: ClientSDK, // Unused but kept for API compatibility
  itemIds: string[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _sitecoreContextId?: string // Unused but kept for API compatibility
): Promise<ItemQueryResult> => {
  if (itemIds.length === 0) {
    return { data: { data: {} } };
  }

  const query = `
    query GetLiveItems {
      ${itemIds.map((id, index) => `
        item${index}: item(path: "{${formatGuidForLive(id)}}", language: "en") {
          id
          name
          version
          language {
            name
          }
        }
      `).join('')}
    }
  `;

  try {
    console.log('Executing DIRECT live GraphQL query with item IDs:', itemIds);
    console.log('Query:', query.trim());
    
    // Make direct HTTP call to Experience Edge endpoint instead of using SDK
    const response = await fetch(LIVE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'sc_apikey': LIVE_TOKEN
      },
      body: JSON.stringify({
        query: query.trim()
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    console.log('DIRECT Live GraphQL result:', result);
    
    // Add detailed logging to understand the response structure
    if (result?.data) {
      const responseData = result.data;
      console.log('DIRECT Live GraphQL response data:', responseData);
      Object.keys(responseData).forEach(key => {
        console.log(`DIRECT Live item ${key}:`, responseData[key]);
      });
    }
    
    // Return in the same format as the SDK would
    return { data: result };
  } catch (error) {
    console.error('Error querying DIRECT live endpoint:', error);
    return { error };
  }
};

/**
 * Query the preview endpoint for multiple items
 */
export const getItemsFromPreview = async (
  client: ClientSDK,
  itemIds: string[],
  sitecoreContextId?: string
): Promise<ItemQueryResult> => {
  if (!client || itemIds.length === 0) {
    return { data: { data: {} } };
  }

  if (!sitecoreContextId) {
    throw new Error('sitecoreContextId is required for preview GraphQL queries');
  }

  const query = `
    query GetPreviewItems {
      ${itemIds.map((id, index) => `
        item${index}: item(path: "${id}", language: "en") {
          id
          name
          version
          language {
            name
          }
        }
      `).join('')}
    }
  `;

  try {
    console.log('Executing preview GraphQL query with item IDs:', itemIds);
    console.log('sitecoreContextId:', sitecoreContextId);
    console.log('Query:', query.trim());
    
    // Use official SDK approach with sitecoreContextId in query params
    const result = await client.mutate('xmc.preview.graphql', {
      params: {
        query: {
          sitecoreContextId
        },
        body: {
          query: query.trim()
        }
      }
    });

    console.log('Preview GraphQL result:', result);
    return result;
  } catch (error) {
    console.error('Error querying preview endpoint:', error);
    return { error };
  }
};

/**
 * Helper function to validate GraphQL response structure
 */
export const validateGraphQLResponse = (response: ItemQueryResult): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];
  
  if (!response) {
    errors.push('Response is null or undefined');
    return { isValid: false, errors };
  }

  if (response.error) {
    errors.push(`Response error: ${response.error}`);
  }

  if (!response.data) {
    errors.push('No data in response');
  } else if (!response.data.data) {
    errors.push('No nested data in response.data');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Resolve local datasource paths to item IDs using GraphQL
 * @param client - Marketplace SDK client
 * @param localPaths - Array of local paths like ['Data/Article Header', 'Data/Text 1']
 * @param basePath - Base path of the current page (e.g., '/sitecore/content/.../Article Page')
 * @param sitecoreContextId - Context ID for the query
 * @returns Object mapping local paths to resolved item IDs
 */
export const resolveLocalDatasourcePaths = async (
  client: ClientSDK,
  localPaths: string[],
  basePath: string,
  sitecoreContextId: string
): Promise<Record<string, string | null>> => {
  if (!client || localPaths.length === 0) {
    return {};
  }

  // Construct full paths by combining base path with local paths
  const fullPaths = localPaths.map(localPath => {
    const cleanPath = localPath.replace('Data/', '');
    return `${basePath}/Data/${cleanPath}`;
  });

  const query = `
    query ResolveLocalDatasources {
      ${localPaths.map((_, index) => `
        path${index}: item(where: {
          database: "master"
          path: "${fullPaths[index]}"
          language: "en"
        }) {
          itemId
          name
          path
        }
      `).join('')}
    }
  `;

  try {
    console.log('🔍 Resolving local datasource paths via GraphQL:', localPaths);
    console.log('📍 Full paths to query:', fullPaths);
    console.log('🔎 GraphQL query:', query.trim());

    const response = await client.mutate('xmc.authoring.graphql', {
      params: {
        query: {
          sitecoreContextId
        },
        body: {
          query: query.trim()
        }
      }
    });

    console.log('✅ Local path resolution GraphQL result:', response);

    const result: Record<string, string | null> = {};
    
    if (response?.data?.data) {
      localPaths.forEach((localPath, index) => {
        const responseData = response.data?.data;
        if (responseData) {
          const item = responseData[`path${index}`] as { itemId?: string; name?: string } | null;
          if (item && item.itemId) {
            result[localPath] = item.itemId.replace(/[{}]/g, '').toUpperCase();
            console.log(`📝 Resolved ${localPath} → ${result[localPath]} (${item.name || 'Unknown'})`);
          } else {
            result[localPath] = null;
            console.log(`❌ Could not resolve ${localPath} at path ${fullPaths[index]}`);
          }
        }
      });
    }

    return result;

  } catch (error) {
    console.error('❌ Error resolving local datasource paths:', error);
    // Return empty results for failed resolution
    const result: Record<string, string | null> = {};
    localPaths.forEach((path: string) => {
      result[path] = null;
    });
    return result;
  }
};
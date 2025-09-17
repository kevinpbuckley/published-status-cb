// utils/graphqlQueries.ts
import { ClientSDK } from '@sitecore-marketplace-sdk/client';
import type { ItemQueryResult } from '../types/itemInformation';

// Configuration for direct live endpoint calls
const LIVE_ENDPOINT = 'https://edge.sitecorecloud.io/api/graphql/v1';
const LIVE_TOKEN = 'YWZGOHA4NmhnRXZZNVJhWmttQ1FMbWd2em5QejlIU1IzSjJxejZ4SWlrdz18cHJvZmVzc2lvbmFhZDQ3LXBzc2hhcmVkMjNkYi1wc3NoYXJlZGRldmFkNjgtNjUyZQ==';

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
  _sitecoreContextId?: string // Unused but kept for API compatibility
): Promise<ItemQueryResult> => {
  if (itemIds.length === 0) {
    return { data: { data: {} } };
  }

  const query = `
    query GetLiveItems {
      ${itemIds.map((id, index) => `
        item${index}: item(path: "{${id}}", language: "en") {
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
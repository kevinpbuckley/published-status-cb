// components/PublishedStatusTable.tsx
import React from 'react';
import {
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  VStack,
  Text,
  Button,
  HStack,
  Box,
  Heading,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Spinner,
  Center,
  Flex,
  Spacer
} from '@chakra-ui/react';
import { useItemInformation } from '../hooks/useItemInformation';
import { 
  PublishingStatusIndicator, 
  PublishingStatusSummary, 
  ItemTypeBadge 
} from './PublishingStatusIndicator';

export const PublishedStatusTable: React.FC = () => {
  const { 
    data, 
    items, 
    loading, 
    error, 
    refetch 
  } = useItemInformation();

  if (loading) {
    return (
      <Center py={10}>
        <VStack spacing={4}>
          <Spinner size="xl" color="blue.500" />
          <Text>Loading item information...</Text>
        </VStack>
      </Center>
    );
  }

  if (error) {
    return (
      <Alert status="error">
        <AlertIcon />
        <VStack align="start" spacing={2}>
          <AlertTitle>Error Loading Item Information</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <Button size="sm" colorScheme="red" onClick={refetch}>
            Try Again
          </Button>
        </VStack>
      </Alert>
    );
  }

  if (!data || items.length === 0) {
    return (
      <Alert status="info">
        <AlertIcon />
        <VStack align="start" spacing={2}>
          <AlertTitle>No Items Found</AlertTitle>
          <AlertDescription>
            No item information could be retrieved from the current context.
          </AlertDescription>
          <Button size="sm" colorScheme="blue" onClick={refetch}>
            Refresh
          </Button>
        </VStack>
      </Alert>
    );
  }

  return (
    <VStack spacing={6} align="stretch">
      {/* Header */}
      <Flex align="center">
        <VStack align="start" spacing={1}>
          <Heading size="lg">Item Publishing Status</Heading>
          <Text color="gray.600" fontSize="sm">
            Current item and referenced items publishing information
          </Text>
        </VStack>
        <Spacer />
        <Button colorScheme="blue" onClick={refetch} size="sm">
          Refresh
        </Button>
      </Flex>

      {/* Summary */}
      <Box>
        <Text fontSize="md" fontWeight="semibold" mb={3}>
          Publishing Summary
        </Text>
        <PublishingStatusSummary items={items} />
      </Box>

      {/* Current Item Section */}
      {data.currentItem && (
        <Box>
          <Heading size="md" mb={4}>Current Item</Heading>
          <Table variant="simple" size="md">
            <Thead>
              <Tr>
                <Th>Item Information</Th>
                <Th>Type</Th>
                <Th>Latest Version</Th>
                <Th>Published Version</Th>
                <Th>Publishing Status</Th>
              </Tr>
            </Thead>
            <Tbody>
              <Tr>
                <Td>
                  <VStack align="start" spacing={1}>
                    <Text fontWeight="bold">{data.currentItem.name}</Text>
                    <Text fontSize="sm" color="gray.500">
                      {data.currentItem.path || data.currentItem.id}
                    </Text>
                    {data.currentItem.template && (
                      <Text fontSize="xs" color="gray.400">
                        Template: {data.currentItem.template}
                      </Text>
                    )}
                  </VStack>
                </Td>
                <Td>
                  <ItemTypeBadge itemType={data.currentItem.itemType} />
                </Td>
                <Td>
                  <Text fontWeight="semibold">v{data.currentItem.latestVersion}</Text>
                </Td>
                <Td>
                  <Text>
                    {data.currentItem.publishedVersion 
                      ? `v${data.currentItem.publishedVersion}`
                      : 'Not Published'
                    }
                  </Text>
                </Td>
                <Td>
                  <PublishingStatusIndicator 
                    item={data.currentItem} 
                    showDetails={true}
                  />
                </Td>
              </Tr>
            </Tbody>
          </Table>
        </Box>
      )}

      {/* Referenced Items Section */}
      {data.referencedItems.length > 0 && (
        <Box>
          <Heading size="md" mb={4}>
            Referenced Items ({data.referencedItems.length})
          </Heading>
          <Table variant="simple" size="sm">
            <Thead>
              <Tr>
                <Th>Item Information</Th>
                <Th>Type</Th>
                <Th>Latest</Th>
                <Th>Published</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {data.referencedItems.map((item) => (
                <Tr key={item.id}>
                  <Td>
                    <VStack align="start" spacing={1}>
                      <Text fontWeight="medium" fontSize="sm">
                        {item.name}
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        {item.path || item.id}
                      </Text>
                      {item.template && (
                        <Text fontSize="xs" color="gray.400">
                          {item.template}
                        </Text>
                      )}
                    </VStack>
                  </Td>
                  <Td>
                    <ItemTypeBadge itemType={item.itemType} size="sm" />
                  </Td>
                  <Td>
                    <Text fontSize="sm" fontWeight="medium">
                      v{item.latestVersion}
                    </Text>
                  </Td>
                  <Td>
                    <Text fontSize="sm">
                      {item.publishedVersion 
                        ? `v${item.publishedVersion}`
                        : '-'
                      }
                    </Text>
                  </Td>
                  <Td>
                    <PublishingStatusIndicator item={item} size="sm" />
                  </Td>
                  <Td>
                    <HStack spacing={2}>
                      <Button 
                        size="xs" 
                        variant="outline"
                        onClick={() => {
                          // TODO: Implement view details functionality
                          console.log('View details for item:', item.id);
                        }}
                      >
                        Details
                      </Button>
                      {item.isOutdated && (
                        <Button 
                          size="xs" 
                          colorScheme="orange"
                          onClick={() => {
                            // TODO: Implement publish functionality
                            console.log('Publish item:', item.id);
                          }}
                        >
                          Publish
                        </Button>
                      )}
                    </HStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}

      {/* Debug Information (can be removed in production) */}
      {process.env.NODE_ENV === 'development' && (
        <Box>
          <Text fontSize="sm" fontWeight="semibold" mb={2} color="gray.500">
            Debug Information
          </Text>
          <Text fontSize="xs" color="gray.400" fontFamily="mono">
            Total Items: {data.summary.totalItems} | 
            Published: {data.summary.publishedItems} | 
            Outdated: {data.summary.outdatedItems}
          </Text>
        </Box>
      )}
    </VStack>
  );
};
import React, { createContext, useContext, useState, useEffect } from 'react';
import { gql, useQuery } from '@apollo/client';
import { useAccount } from 'wagmi';

// Define the shape of a stream
interface PoolMember {
  id: string;
  units: string;
  isConnected: boolean;
  totalAmountClaimed: string;
  totalAmountReceivedUntilUpdatedAt: string;
  poolTotalAmountDistributedUntilUpdatedAt: string;
  updatedAtTimestamp: string;
  updatedAtBlockNumber: string;
  syncedPerUnitSettledValue: string;
  syncedPerUnitFlowRate: string;
  account: {
    id: string;
    outflows: {
      deposit: string;
      currentFlowRate: string;
      createdAtTimestamp: string;
    }[];
    poolMemberships: {
      totalAmountClaimed: string;
      pool: {
        perUnitSettledValue: string;
      };
    }[];
  };
}

// Define the shape of the position data
interface PositionData {
  pools: {
    id: string;
    poolMembers: PoolMember[];
  }[];
}

// Define the shape of the context value
interface PositionContextValue {
  positionData: PositionData | null;
  loading: boolean;
  error: any;
  refetchWithDelay: (delayMs: number) => void;
}

// Create the context
const PositionContext = createContext<PositionContextValue | undefined>(undefined);

// Define the GraphQL query
const POOLS_QUERY = gql`
  query getFlowEvents($poolAdmin: String!, $account: String!) {
    pools(where: {admin_contains: $poolAdmin}) {
      id
      poolMembers(where: {account_contains: $account}) {
        id
        units
        isConnected
        totalAmountClaimed
        totalAmountReceivedUntilUpdatedAt
        poolTotalAmountDistributedUntilUpdatedAt
        updatedAtTimestamp
        updatedAtBlockNumber
        syncedPerUnitSettledValue
        syncedPerUnitFlowRate
        account {
          id
          outflows {
            deposit
            currentFlowRate
            createdAtTimestamp
          }
          poolMemberships {
            totalAmountClaimed
            pool {
              perUnitSettledValue
            }
          }
        }
      }
    }
  }
`;

// Create the provider component
export const PositionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { address, isConnected } = useAccount();
  const poolAdmin = "0xda09bfa42eb482858f54c92d083e79a44191327b";

  const [positionData, setPositionData] = useState<PositionData | null>(null);

  const { loading, error, data, refetch } = useQuery<PositionData>(POOLS_QUERY, {
    variables: { poolAdmin: poolAdmin, account: address?.toLowerCase() },
    skip: !address, // Skip the query if there's no address
  });

  const refetchWithDelay = (delayMs: number) => {
    setTimeout(() => {
      refetch({ account: address?.toLowerCase(), poolAdmin: poolAdmin });
    }, delayMs);
  };

  useEffect(() => {
    console.log("Query variables:", { poolAdmin, account: address?.toLowerCase() });
  }, [poolAdmin, address]);

  useEffect(() => {
    if (data && data.pools) {
      console.log("Raw query data:", data);
      const positionData: PositionData = { pools: data.pools };
      console.log("Processed position data:", positionData);
    }
  }, [data]);

  useEffect(() => {
    if (isConnected && address) {
      refetch({ account: address.toLowerCase(), poolAdmin: poolAdmin });
    }
  }, [address, isConnected, refetch, poolAdmin]);

  const value: PositionContextValue = {
    positionData: data || null,
    loading,
    error,
    refetchWithDelay
  };

  return <PositionContext.Provider value={value}>{children}</PositionContext.Provider>;
};

// Create a custom hook to use the context
export const usePosition = (): PositionContextValue => {
  const context = useContext(PositionContext);
  if (context === undefined) {
    throw new Error('usePosition must be used within a PositionProvider');
  }
  return context;
};
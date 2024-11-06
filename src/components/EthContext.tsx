import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAccount } from 'wagmi';

interface EthContextType {
  ethPrice: number | null;
}

const EthContext = createContext<EthContextType | undefined>(undefined);

export const EthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isConnected } = useAccount();
  const [ethPrice, setEthPrice] = useState<number | null>(null);

  useEffect(() => {
    const fetchEthPrice = async () => {
      try {
        const response = await fetch('https://api.diadata.org/v1/assetQuotation/Ethereum/0x0000000000000000000000000000000000000000');
        const data = await response.json();
        setEthPrice(data.Price);
      } catch (error) {
        console.error('Error fetching ETH price:', error);
      }
    };

    if (isConnected) {
      fetchEthPrice();
    }
  }, [isConnected]);

  return (
    <EthContext.Provider value={{ ethPrice }}>
      {children}
    </EthContext.Provider>
  );
};

export const useEth = () => {
  const context = useContext(EthContext);
  if (context === undefined) {
    throw new Error('useEth must be used within an EthProvider');
  }
  return context;
};
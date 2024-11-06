import { createContext, useContext, useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { useAccount } from 'wagmi'; 
import { useBalance } from 'wagmi';

// Define the shape of the context value
interface TokenContextType {
  validateTorexAndFetchTokenInfo: (
    torexAddr: string,
    address: string
  ) => Promise<{ balance: string; allowance: string; }>;
  inTokenAddress: string | null; // Export inTokenAddress
  underlyingTokenAddress: string | null; // Export underlyingTokenAddress
  tokenBalance: string; // Export tokenBalance
  tokenAllowance: string; // Export tokenAllowance
}

// Create the context with a default value of null
const TokenContext = createContext<TokenContextType | null>(null);

const erc20ABI = [
  'function balanceOf(address account) external view returns (uint256)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function decimals() external view returns (uint8)',
];

const torexABI = [
  'function getPairedTokens() external view returns (address inToken, address outToken)',
];

const superTokenABI = [
  'function getUnderlyingToken() external view returns (address)',
];

// Addresses
const SB_MACRO_ADDRESS  = "0x383329703f346d72F4b86111a502daaa8f2c69C7";
const TOREX_ADDRESS = "0xda09bfa42eb482858f54c92d083e79a44191327b";

export const TokenProvider = ({ children }: { children: React.ReactNode }) => {
  const { isConnected, address } = useAccount();
  const nativeBalance = useBalance({
    address: address
  }) 

  const [inTokenAddress, setInTokenAddress] = useState<string | null>(null); // State for inTokenAddress
  const [underlyingTokenAddress, setUnderlyingTokenAddress] = useState<string | null>(null); // State for underlyingTokenAddress
  const [isTorexValid, setIsTorexValid] = useState<boolean>(false); // State for Torex validity
  const [tokenBalance, setTokenBalance] = useState<string>(''); // New state for token balance
  const [tokenAllowance, setTokenAllowance] = useState<string>(''); // New state for token allowance
  
  useEffect(() => {
    if (isConnected && address) { // Check if connected and address is available
      const fetchData = async () => {
        // Call validateTorexAndFetchTokenInfo and set states within that function
        await validateTorexAndFetchTokenInfo(TOREX_ADDRESS, address);
      };

      fetchData();
    }
  }, [isConnected, address]); 

  const validateTorexAndFetchTokenInfo = async (torexAddr: string, address: string) => {
    const provider = new ethers.providers.JsonRpcProvider('https://optimism.llamarpc.com');
    try {
      const torex = new ethers.Contract(torexAddr, torexABI, provider);
      const [inTokenAddr, outTokenAddr] = await torex.getPairedTokens();
      
      // Set the inTokenAddress state here
      setInTokenAddress(inTokenAddr);
      console.log('inTokenAddr', inTokenAddr);
      console.log('outTokenAddr', outTokenAddr);

      const superToken = new ethers.Contract(inTokenAddr, superTokenABI, provider);
      const underlyingAddr = await superToken.getUnderlyingToken();
      
      // Set the underlyingTokenAddress state here
      setUnderlyingTokenAddress(underlyingAddr);
      console.log('underlyingAddr', underlyingAddr);

      setIsTorexValid(true);

      const providerRPC = new ethers.providers.JsonRpcProvider('https://optimism.llamarpc.com');

      try {
        console.log("bruh")
        if (underlyingAddr === ethers.constants.AddressZero) {
          // Native token (ETH)
          const balance = await providerRPC.getBalance(address || '');
          if (nativeBalance.data?.value) {
            console.log(ethers.utils.formatEther(nativeBalance.data.value), "nativebalance")
          }
          return { balance: ethers.utils.formatEther(balance), allowance: '' };
        } else {
          console.log("bruh2")
          // ERC20 tokens
          const erc20 = new ethers.Contract(underlyingAddr, erc20ABI, providerRPC);
          const balance = await erc20.balanceOf(address);
          console.log("balance", balance)
          const decimals = await erc20.decimals();
          console.log("decimals", decimals)
          const formattedBalance = ethers.utils.formatUnits(balance, decimals);
          
          // Set tokenBalance state
          setTokenBalance(formattedBalance);
          console.log("formattedBalance", formattedBalance)
  
          const allowance = await erc20.allowance(address, SB_MACRO_ADDRESS);
          const formattedAllowance = ethers.utils.formatUnits(allowance, decimals);
          
          // Set tokenAllowance state
          setTokenAllowance(formattedAllowance);
          console.log("formattedAllowance", formattedAllowance)
  
          return { balance: formattedBalance, allowance: formattedAllowance };
        }
      } catch (error) {
        console.error("Error fetching balance and allowance:", error);
        return { balance: '', allowance: '' };
      }
      
    } catch (error) {
      console.error("Error validating Torex address:", error);
      setIsTorexValid(false);
      return { balance: '', allowance: '' };
    }
  };

  return (
    <TokenContext.Provider value={{
      validateTorexAndFetchTokenInfo, 
      inTokenAddress, // Export inTokenAddress
      underlyingTokenAddress, // Export underlyingTokenAddress
      tokenBalance, // Export tokenBalance
      tokenAllowance // Export tokenAllowance
    }}>
      {children}
    </TokenContext.Provider>
  );
};

export const useTokenContext = () => useContext(TokenContext);
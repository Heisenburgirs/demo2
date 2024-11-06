import { ConnectButton } from '@rainbow-me/rainbowkit';
import type { NextPage } from 'next';
import Head from 'next/head';
import { useRef, useState, useCallback, useEffect } from 'react';
import noise from "../../public/noise.0eeb5824.png"
import { useAccount} from 'wagmi';
import usdc from "../../public/usdc.png"
import eth from "../../public/eth.webp"
import DCAOverlay from "../components/DCAOverlay";
import { ethers } from "ethers";
import { usePosition } from "../components/PositionContext";
import { useTokenContext } from '../components/TokenContext';
import { useConnect } from 'wagmi';

// Mock data for DCA rewards and portfolio
const dcaRewards = [
  { 
    name: 'USDC / ETH',
    tokens: { from: 'USDC', to: 'ETH' },
    monthlyVolume: '21,734.632',
    dailyRewards: { amount: '15000', token: 'FLOW' },
    apr: '3.15%',
    isLive: true 
  },
];

const cfaABI = [
  'function deleteFlow(address token, address sender, address receiver, bytes userData) external returns (bool)',
];

const sbIncentivesABI = [
  'function registerOrUpdateStream(address user)',
    'function startStreamToPool(int96 requestedFlowRate) external', // Added new function

];

const Home: NextPage = () => {
  const [activeTab, setActiveTab] = useState('boosts');
  const [currentStreamedAmounts, setCurrentStreamedAmounts] = useState<{ [key: string]: string }>({});

  const [deletingPositions, setDeletingPositions] = useState<{ [key: string]: boolean }>({});

  const [isDCAOverlayOpen, setIsDCAOverlayOpen] = useState(false);
  const [updateAmount, setUpdateAmount] = useState('');

  const [cfa, setCfa] = useState('0xcfA132E353cB4E398080B9700609bb008eceB125');

  const { address, isConnected } = useAccount();
  const [openConnectModalFn, setOpenConnectModalFn] = useState<(() => void) | null>(null);
  const { positionData, loading, error } = usePosition();
  
  const tokenContext = useTokenContext();

  // Ensure tokenContext is not null before destructuring
  const { inTokenAddress, underlyingTokenAddress, tokenBalance, tokenAllowance } = tokenContext || {
    inTokenAddress: null,
    underlyingTokenAddress: null,
    tokenBalance: '',
    tokenAllowance: ''
  };

  const deleteButtonRef = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const setDeleteButtonRef = useCallback((poolId: string) => (el: HTMLButtonElement | null) => {
    deleteButtonRef.current[poolId] = el;
  }, []);

  const calculateMonthlyFlowRate = (flowRate: string) => {
    const flowRateBN = ethers.BigNumber.from(flowRate);
    const secondsInMonth = 30 * 24 * 60 * 60;
    const monthlyFlowRateWei = flowRateBN.mul(secondsInMonth);
    return parseFloat(ethers.utils.formatUnits(monthlyFlowRateWei, 18)).toFixed(4);
  };

  const calculateTotalStreamed = useCallback((flowRate: string, createdTimestamp: string) => {
    const flowRatePerSecond = parseFloat(ethers.utils.formatUnits(flowRate, 18));
    const startTime = parseInt(createdTimestamp);
    const currentTime = Date.now() / 1000; // Use millisecond precision
    const secondsElapsed = currentTime - startTime;
    return (flowRatePerSecond * secondsElapsed).toString();
  }, []);

  // Modified useEffect for smooth animation
  useEffect(() => {
    if (!positionData?.pools) return;

    // Cleanup function to store all animation frame IDs
    const animations: { [key: string]: number } = {};

    positionData.pools.forEach((pool) => {
      pool.poolMembers.forEach((member) => {
        const latestOutflow = member.account.outflows
          .filter(outflow => outflow.currentFlowRate !== "1")
          .sort((a, b) => parseInt(b.createdAtTimestamp) - parseInt(a.createdAtTimestamp))[0];

        if (!latestOutflow || parseFloat(latestOutflow.currentFlowRate) <= 0) return;

        // Animation function
        const animate = () => {
          const streamedAmount = calculateTotalStreamed(
            latestOutflow.currentFlowRate,
            latestOutflow.createdAtTimestamp
          );

          setCurrentStreamedAmounts(prev => ({
            ...prev,
            [pool.id]: streamedAmount
          }));

          // Store animation frame ID for this pool
          animations[pool.id] = requestAnimationFrame(animate);
        };

        // Start animation
        animations[pool.id] = requestAnimationFrame(animate);
      });
    });

    // Cleanup function
    return () => {
      Object.values(animations).forEach(frameId => {
        cancelAnimationFrame(frameId);
      });
    };
  }, [positionData, calculateTotalStreamed]);


  const handleDCAClick = () => {
    if (!isConnected) {
      openConnectModalFn?.();
      return;
    }

    // Proceed with opening DCA overlay if connected
    setIsDCAOverlayOpen(true);
  };

  const handleDelete = async (poolId: string) => {
    if (!window.ethereum) {
      console.error("Ethereum provider not found");
      return;
    }

    setDeletingPositions(prev => ({ ...prev, [poolId]: true }));

    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const cfaContract = new ethers.Contract(cfa, cfaABI, signer);

    const poolAddress = "0xda09bfa42eb482858f54c92d083e79a44191327b";

    try {
      console.log("InTokenAddress:", inTokenAddress);
      console.log("Address:", address);
      console.log("PoolAddress:", poolAddress);
      const tx = await cfaContract.deleteFlow(
        inTokenAddress,
        address,
        poolAddress,
        '0x',
        { gasLimit: 3000000 }
      );

      // Disable the button and show loading state
      if (deleteButtonRef.current[poolId]) {
        deleteButtonRef.current[poolId]!.disabled = true;
      }

      await tx.wait();
      console.log("Flow deleted successfully");
      // You might want to add some UI feedback here, like a success message
    } catch (error) {
      console.error("Error deleting flow:", error);
      // You might want to add some UI feedback here, like an error message
    } finally {
      // Re-enable the button and restore original text
      if (deleteButtonRef.current[poolId]) {
        deleteButtonRef.current[poolId]!.disabled = false;
      }
      setDeletingPositions(prev => ({ ...prev, [poolId]: false }));
    }
  };

  const handleRegistration = async (poolId: string) => {
    if (!window.ethereum) {
      console.error("Ethereum provider not found");
      return;
    }

    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const sbIncentives = new ethers.Contract("0x5A42F800e27773d09376464934e59517fDD88371", sbIncentivesABI, signer);

    try {
      const tx = await sbIncentives.registerOrUpdateStream(
        address,
        { gasLimit: 3000000 }
      );

      // Disable the button and show loading state
      if (deleteButtonRef.current[poolId]) {
        deleteButtonRef.current[poolId]!.disabled = true;
        deleteButtonRef.current[poolId]!.textContent = 'Deleting...';
      }

      await tx.wait();
      console.log("Registered successfully");
      // You might want to add some UI feedback here, like a success message
    } catch (error) {
      console.error("Error deleting flow:", error);
      // You might want to add some UI feedback here, like an error message
    } finally {
      // Re-enable the button and restore original text
      if (deleteButtonRef.current[poolId]) {
        deleteButtonRef.current[poolId]!.disabled = false;
        deleteButtonRef.current[poolId]!.textContent = 'Delete';
      }
    }
  };

  return (
    <div className="flex flex-col min-h-screen h-screen w-screen bg-[#f4f6fc] text-white">
      <Head>
        <title>Super Boring DCA</title>
        <meta
          content="Super Boring DCA with Superfluid"
          name="description"
        />
        <link href="/favicon.ico" rel="icon" />
      </Head>

      <header className="py-4 sticky top-0 z-10 z-50">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-end space-x-6">
            <h1 className="text-[22px] font-bold text-[#222222] opacity-90">SuperBoost</h1>
            <nav>
              <ul className="flex space-x-4">
                <li>
                  <button
                    className={`text-[16px] w-20 transition-colors duration-200 transition ${
                      activeTab === 'boosts' ? 'text-[#0664d1]' : 'text-[#222222]'
                    }`}
                    onClick={() => setActiveTab('boosts')}
                  >
                    Boosts
                  </button>
                </li>
                <li>
                  <button
                    className={`text-[16px] w-20 transition-colors duration-200 transition ${
                      activeTab === 'portfolio' ? 'text-[#0664d1]' : 'text-[#222222]'
                    }`}
                    onClick={() => setActiveTab('portfolio')}
                  >
                    Portfolio
                  </button>
                </li>
              </ul>
            </nav>
          </div>
          <ConnectButton.Custom>
            {({
              account,
              chain,
              openAccountModal,
              openChainModal,
              openConnectModal,
              mounted,
            }) => {
              useEffect(() => {
                setOpenConnectModalFn(() => openConnectModal);
              }, [openConnectModal]);
              
              const ready = mounted;
              const connected = ready && account && chain;

              return (
                <div
                  {...(!ready && {
                    'aria-hidden': true,
                    'style': {
                      opacity: 0,
                      pointerEvents: 'none',
                      userSelect: 'none',
                    },
                  })}
                >
                  {(() => {
                    if (!connected) {
                      return (
                        <button onClick={openConnectModal} className="bg-[#1a1b1f] text-white rounded-md px-4 py-[6px] hover:bg-[#2c2d33] border border-[#00D6E5]">
                          Connect
                        </button>
                      );
                    }

                    return (
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={openChainModal} 
                          className="rounded-md px-3 py-2 text-sm bg-[#fff] text-[#222222] flex items-center justify-center gap-2 transition"
                        >
                          <div className="flex items-center gap-[2px]">
                            {chain.hasIcon && (
                              <div className="mr-2">
                                <div style={{
                                  background: chain.iconBackground,
                                  width: 20,
                                  height: 20,
                                  borderRadius: 999,
                                  overflow: 'hidden',
                                }}>
                                  {chain.iconUrl && (
                                    <img
                                      alt={chain.name ?? 'Chain icon'}
                                      src={chain.iconUrl}
                                      style={{ width: 20, height: 20 }}
                                    />
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          <svg className="h-full w-4" fill="none" height="7" width="14" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12.75 1.54001L8.51647 5.0038C7.77974 5.60658 6.72026 5.60658 5.98352 5.0038L1.75 1.54001" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"/>
                          </svg>
                        </button>

                        <button 
                          onClick={openAccountModal} 
                          className="rounded-md px-3 py-2 text-sm bg-[#fff] text-[#222222] flex items-center"
                        >
                          {account.balanceFormatted && parseFloat(account.balanceFormatted).toFixed(2)}
                          {account.displayName}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </header>

      <main className="flex-grow p-8 overflow-auto z-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold mb-3 text-[#222222]">
            {activeTab === 'boosts' ? 'Discover Incentives' : activeTab === 'portfolio' && 'Your Portfolio'}
          </h2>
          {activeTab === 'boosts' && (
            <div className="mb-6 text-[#222222] opacity-100">
              <p>
                When you DCA or stream one token into another (e.g., ETH to USDC), you can receive incentive tokens as a reward.
              </p>
            </div>
          )}
          {activeTab === 'boosts' && (
            <div className="overflow-x-auto bg-white rounded-[12px] border border-[#edf0f5] border-opacity-10">
              <table className="w-full text-left">
                <thead className="hover:bg-[#edf0f5] transition hover:cursor-pointer">
                  <tr className="text-[#222222] text-[12px]">
                    <th className="py-4 px-4">Pool</th>
                    <th className="py-4 px-4">Monthly Volume</th>
                    <th className="py-4 px-4">Reward Pool</th>
                    <th className="py-4 px-4">APR</th>
                    <th className="py-4 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dcaRewards.map((reward, index) => (
                    <tr key={index} className="border-t border-[#fff] border-opacity-10 text-black">
                      <td className="px-4 py-4 flex items-center relative gap-4">
                        <div className="flex items-center relative">
                          <img src={usdc.src} alt={reward.tokens.from} className="w-[24px] h-[24px] mr-2" />
                          <img src={eth.src} alt={reward.tokens.to} className="w-[24px] h-[32px] absolute right-0 left-[12px]" />
                        </div>
                        <span className="ml-8">{reward.name}</span>
                      </td>
                      <td className="px-4 py-4">{reward.monthlyVolume} {reward.tokens.to}</td>
                      <td className="px-4 py-4">{reward.dailyRewards.amount} {reward.dailyRewards.token}</td>
                      <td className="px-4 py-4">{reward.apr}</td>
                      <td className="px-4 py-4">
                        <button onClick={handleDCAClick} className="bg-[#2a85f0] text-white rounded px-4 py-1 mr-2 hover:bg-[#0664d1] transition">
                          DCA
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'portfolio' && (
            <div className="grid grid-cols-1 gap-8">
              <div className="flex justify-between items-center mb-4">
              </div>
              {loading && <p>Loading...</p>}
              {error && <p>Error: {error.message}</p>}
              {positionData && positionData.pools.length > 0 && (
                <div className="grid grid-cols-1 gap-4">
                  {positionData.pools.map((pool, poolIndex) => (
                    pool.poolMembers.map((member, memberIndex) => {
                      const latestOutflow = member.account.outflows
                        .filter(outflow => outflow.currentFlowRate !== "1")
                        .sort((a, b) => parseInt(b.createdAtTimestamp) - parseInt(a.createdAtTimestamp))[0];

                      if (!latestOutflow) return null; // Skip if no active outflow

                      const monthlyFlowRate = calculateMonthlyFlowRate(latestOutflow.currentFlowRate);
                      if (parseFloat(monthlyFlowRate) <= 0) return null;

                      return (
                        <div key={`${poolIndex}-${memberIndex}`} className="relative bg-gradient-to-br from-white to-[#f8f9fd] rounded-2xl p-6 shadow-lg border border-[#edf0f5]">
                          {/* Header with token pair */}
                          <div className="absolute -top-4 left-6 bg-[#2a85f0] text-white px-4 py-2 rounded-full shadow-md">
                            <div className="flex items-center gap-2">
                              {/*<div className="flex items-center relative">
                                <img src={usdc.src} alt="USDC" className="w-[20px] h-[20px]" />
                                <img src={eth.src} alt="ETH" className="w-[20px] h-[24px] ml-[-8px]" />
                              </div>*/}
                              <span className="font-medium">USDC → ETH</span>
                            </div>
                          </div>
              
                          {/* Main content grid */}
                          <div className="mt-6 grid grid-cols-2 gap-6">
                            {/* Left column - Flow details */}
                            <div className="space-y-4">
                              <div className="bg-[#f3f5fa] rounded-xl p-4">
                                <p className="text-[#666] text-sm">Monthly Flow</p>
                                <p className="text-[#222] text-xl font-bold mt-1">
                                  {parseFloat(monthlyFlowRate).toFixed(2)} USDC
                                </p>
                              </div>
                              <div className="bg-[#f3f5fa] rounded-xl p-4">
                                <p className="text-[#666] text-sm">Total Streamed</p>
                                <p className="text-[#222] text-xl font-bold mt-1">
                                {currentStreamedAmounts[pool.id] 
                                  ? parseFloat(currentStreamedAmounts[pool.id]).toFixed(10)
                                  : "0.0000"} USDC
                                </p>
                              </div>
                            </div>

                            {/* Right column - Received and rewards */}
                            <div className="space-y-4">
                              <div className="bg-[#f3f5fa] rounded-xl p-4">
                                <p className="text-[#666] text-sm">Total Received</p>
                                <p className="text-[#222] text-xl font-bold mt-1">
                                  {parseFloat(ethers.utils.formatEther(member.account.poolMemberships[0].pool.perUnitSettledValue)).toFixed(6)} ETH
                                </p>
                              </div>
                              <div className="bg-[#f3f5fa] rounded-xl p-4">
                                <p className="text-[#666] text-sm">Accrued Rewards</p>
                                <p className="text-[#222] text-xl font-bold mt-1 flex items-center gap-2">
                                  <span>1,234.56 FLOW</span>
                                  <span className="text-xs text-[#2a85f0] bg-[#2a85f0]/10 px-2 py-1 rounded-full">
                                    +123.45 today
                                  </span>
                                </p>
                              </div>
                            </div>

                            {/* Action buttons - Moved to full width below */}
                            <div className="col-span-2 flex gap-3">
                              <button
                                onClick={() => handleRegistration(pool.id)}
                                className="flex-1 bg-gradient-to-r from-[#7CFFD4] to-[#4EFEB3] text-[#1A1F3C] rounded-xl px-4 py-3 text-sm font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" 
                                    fill="currentColor" stroke="#1A1F3C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                Earn Rewards
                              </button>
                              <button
                                ref={setDeleteButtonRef(pool.id)}
                                onClick={() => handleDelete(pool.id)}
                                disabled={deletingPositions[pool.id]}
                                className={`flex-1 bg-[#f3f5fa] text-[#222] rounded-xl px-4 py-3 text-sm font-semibold 
                                  ${deletingPositions[pool.id] ? 'animate-pulse opacity-75' : 'hover:bg-[#e9ebf2]'} 
                                  transition-all flex items-center justify-center gap-2`}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M3 6H5H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  <path d="M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6" 
                                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                {deletingPositions[pool.id] ? 'Deleting position...' : 'Delete Position'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ))}
                  {(!positionData || positionData.pools.length === 0 || positionData.pools.every(pool => pool.poolMembers.length === 0)) && (
                    <p className="text-white">No active positions</p>
                  )}
                </div>
              )}
              {/* @ts-ignore */}
              {(!positionData?.pools.length || 
                positionData.pools.every(pool => 
                  pool.poolMembers.every(member => 
                    member.account.outflows.every(outflow => 
                      outflow.currentFlowRate === "0" || outflow.currentFlowRate === "1"
                    )
                  )
                )) && (
                <p className="text-[#222222] text-[18px]">No active positions</p>
              )}
            </div>
          )}
        </div>
      </main>

      {isDCAOverlayOpen && (
        <DCAOverlay onClose={() => setIsDCAOverlayOpen(false)} />
      )}

      <footer className="bg-[#f4f6fc] py-4 z-10 border-t border-[#222222] border-opacity-20">
        <div className="container mx-auto text-center text-[#222222]">
          <span className="opacity-75 font-bold">Powered by Superfluid</span>
        </div>
      </footer>


      <div className='w-screen h-screen top-0 z-30 opacity-90 fixed'>
        <div 
          className="w-screen h-screen top-0 bg-cover z-30 opacity-5 fixed" 
          style={{backgroundImage: `url(${noise.src})`}}
        ></div>
      </div>

      {/*<div 
        className="w-screen h-screen top-0 bg-cover z-20 opacity-80 fixed" 
        style={{backgroundImage: "radial-gradient(circle, rgba(0, 0, 0, 0.2) 20%, rgba(0, 0, 0, 0.9) 50%, rgb(0, 0, 0) 90%)"}}
      ></div>*/}
    </div>
  );
};

export default Home;
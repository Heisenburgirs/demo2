import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  optimism,
  optimismSepolia,
} from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Flowcentive',
  projectId: 'YOUR_PROJECT_ID',
  chains: [
    optimism,
    optimismSepolia,
    ...(process.env.NEXT_PUBLIC_ENABLE_TESTNETS === 'true' ? [optimismSepolia] : []),
  ],
  ssr: true,
});
import '../styles/globals.css';
import '@rainbow-me/rainbowkit/styles.css';
import type { AppProps } from 'next/app';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';

import { config } from '../wagmi';

import { TokenProvider } from '../components/TokenContext';
import { EthProvider } from '../components/EthContext';
import { PositionProvider } from '../components/PositionContext';

import { ApolloProvider } from '@apollo/client';
import clientApollo from '../apollo';

const client = new QueryClient();

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={client}>
        <RainbowKitProvider>
          <ApolloProvider client={clientApollo}>
            <TokenProvider>
              <EthProvider>
                <PositionProvider>
                  <Component {...pageProps} />
                </PositionProvider>
              </EthProvider>
            </TokenProvider>
          </ApolloProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default MyApp;

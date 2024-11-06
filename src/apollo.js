// lib/apollo-client.js
import { ApolloClient, InMemoryCache } from '@apollo/client';

const client = new ApolloClient({
  uri: 'https://optimism-mainnet.subgraph.x.superfluid.dev/', 
  cache: new InMemoryCache(),
});

export default client;

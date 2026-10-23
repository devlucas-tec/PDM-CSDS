// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// O expo-sqlite na web usa um módulo WebAssembly (wa-sqlite).
config.resolver.assetExts.push('wasm');

// O SQLite na web precisa de SharedArrayBuffer, que exige estes cabeçalhos.
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  middleware(req, res, next);
};

module.exports = config;

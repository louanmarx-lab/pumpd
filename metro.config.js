const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Support CommonJS (.cjs) modules for Firebase SDK
if (!config.resolver.sourceExts.includes('cjs')) {
  config.resolver.sourceExts.push('cjs');
}

// Disable package exports to ensure Metro resolves the 'react-native' field for @firebase/auth
config.resolver.unstable_enablePackageExports = false;

const defaultBlockList = Array.isArray(config.resolver.blockList)
  ? config.resolver.blockList
  : [config.resolver.blockList].filter(Boolean);

config.resolver.blockList = [
  ...defaultBlockList,
  /\/uiux-designer\/.*/,
  /\/\.git\/.*/,
  /\/\.gemini\/.*/,
];

module.exports = config;

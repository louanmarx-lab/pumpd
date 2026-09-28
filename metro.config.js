const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Support CommonJS (.cjs) modules for Firebase SDK
if (!config.resolver.sourceExts.includes('cjs')) {
  config.resolver.sourceExts.push('cjs');
}

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

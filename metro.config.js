const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const src = path.resolve(__dirname, "src");

const previous = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith("@/")) {
    return (previous ?? context.resolveRequest)(
      context,
      path.join(src, moduleName.slice(2)),
      platform,
    );
  }
  return (previous ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;

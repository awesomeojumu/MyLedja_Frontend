const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const src = path.resolve(__dirname, "src");

const previous = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const normalized = String(moduleName).replace(/\\/g, "/");
  if (platform === "web" && (normalized.endsWith("sync/outbox-sqlite") || normalized === "@/sync/outbox-sqlite")) {
    return {
      type: "sourceFile",
      filePath: path.resolve(__dirname, "src/sync/outbox-sqlite-web.ts"),
    };
  }
  if (moduleName === "sql.js") {
    return {
      type: "sourceFile",
      filePath: path.resolve(__dirname, "node_modules/sql.js/dist/sql-wasm-browser.js"),
    };
  }
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

function posixRequireContext(api) {
  const t = api.types;
  return {
    name: "posix-require-context",
    visitor: {
      CallExpression(path) {
        const { node } = path;
        if (
          !t.isMemberExpression(node.callee) ||
          !t.isIdentifier(node.callee.object, { name: "require" }) ||
          !t.isIdentifier(node.callee.property, { name: "context" })
        ) {
          return;
        }
        const dir = node.arguments[0];
        if (t.isStringLiteral(dir) && dir.value.includes("\\")) {
          dir.value = dir.value.replaceAll("\\", "/");
        }
      },
    },
  };
}

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [{ plugins: [posixRequireContext] }, "babel-preset-expo"],
  };
};

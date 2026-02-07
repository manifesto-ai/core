"use strict";

/**
 * CommonJS wrapper for webpack loader compatibility.
 *
 * Webpack may load loaders via `require()`. The real implementation lives in
 * ESM (`./dist/loader.js`), so we bridge using dynamic import.
 */
module.exports = function manifestoMelLoader(source) {
  const callback = this.async();
  const context = this;

  import("./dist/loader.js")
    .then((mod) => {
      const output = mod.default.call(context, source);
      callback(null, output);
    })
    .catch((error) => callback(error));
};

module.exports.raw = false;


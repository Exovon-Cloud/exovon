#!/usr/bin/env node

/**
 * Exovon CLI Entry Point
 * Invoked via `npx exovon <command>` or global `exovon` install.
 */

const path = require('path');
const fs = require('fs');

try {
  // 1. Resolve installed @exovon/sdk bin
  const sdkBin = require.resolve('@exovon/sdk/bin/exovon.js');
  require(sdkBin);
} catch (e) {
  // 2. Fallback relative path for monorepo development
  const localBin = path.resolve(__dirname, '../../exovon-sdk/bin/exovon.js');
  if (fs.existsSync(localBin)) {
    require(localBin);
  } else {
    console.error('\x1b[31mError:\x1b[0m Could not locate Exovon CLI core runner:', e.message);
    process.exit(1);
  }
}

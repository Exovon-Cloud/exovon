#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

try {
  const exovonBin = require.resolve('exovon/bin/exovon.js');
  require(exovonBin);
} catch (e) {
  try {
    const sdkBin = require.resolve('@exovon/sdk/bin/exovon.js');
    require(sdkBin);
  } catch (err) {
    const localBin = path.resolve(__dirname, '../../exovon-sdk/bin/exovon.js');
    if (fs.existsSync(localBin)) {
      require(localBin);
    } else {
      console.error('Could not locate Exovon CLI runner:', err.message);
      process.exit(1);
    }
  }
}

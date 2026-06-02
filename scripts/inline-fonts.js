#!/usr/bin/env node
/**
 * Post-build script to inline font files as data URIs in the bundled CSS
 * This allows the standalone build to work without external font files
 */

const fs = require('fs');
const path = require('path');

function inlineFonts() {
  try {
    // Process both rollup outputs so icons work in all modes.
    const bundlePaths = [
      path.join(__dirname, '../dist/task-management.js'),
      path.join(__dirname, '../dist/task-management-standalone.js'),
    ].filter((p) => fs.existsSync(p));

    if (bundlePaths.length === 0) {
      console.log('No bundles found, skipping font inlining');
      return;
    }

    // Read font files and convert to base64
    const woff2Path = path.join(__dirname, '../node_modules/@momentum-ui/icons/fonts/momentum-ui-icons.woff2');

    if (!fs.existsSync(woff2Path)) {
      console.warn('WOFF2 font file not found:', woff2Path);
      return;
    }

    const woff2Buffer = fs.readFileSync(woff2Path);
    const woff2Base64 = woff2Buffer.toString('base64');
    console.log(`✓ WOFF2 font loaded: ${woff2Path} (${woff2Buffer.length} bytes)`);

    // WOFF is only needed for IE11 / very old browsers. Since we target evergreen
    // browsers (last 2 Chrome/Firefox/Safari/Edge) we skip it, saving ~500KB.
    console.log(`ℹ Skipping WOFF inlining (modern browsers use WOFF2 only)`);

    for (const bundlePath of bundlePaths) {
      let bundleContent = fs.readFileSync(bundlePath, 'utf-8');

      // Check before replacement
      const woff2Before = (bundleContent.match(/momentum-ui-icons\.woff2/g) || []).length;
      const woffBefore = (bundleContent.match(/momentum-ui-icons\.woff(?!2)/g) || []).length;
      console.log(`[${path.basename(bundlePath)}] Before: ${woff2Before} woff2 refs, ${woffBefore} woff refs`);

      // Inline WOFF2 as a data URI
      bundleContent = bundleContent.replace(
        /url\([^)]*momentum-ui-icons\.woff2[^)]*\)/g,
        `url(data:font/woff2;base64,${woff2Base64})`
      );

      // Remove WOFF fallback url() AND its format() hint (keeps the src syntax valid).
      // The \s* before format handles minified CSS where there's a space between ) and format(.
      bundleContent = bundleContent.replace(
        /,\s*url\([^)]*momentum-ui-icons\.woff(?!2)[^)]*\)\s*(?:format\([^)]*\))?/g,
        ''
      );
      // Also remove an orphaned format("woff") that may remain if the url() was already
      // removed in a previous run but the format() stayed (space between them).
      bundleContent = bundleContent.replace(
        /(\bformat\(["']woff2["']\))\s*format\(["']woff["']\)/g,
        '$1'
      );

      const newFontName = 'momentum-ui-icons-cj-widget';

      // 1) Normalize all momentum-ui-icons family declarations to a namespaced family.
      const allPattern = /font-family:\s*["']?momentum-ui-icons["']?(?=[;}])/g;
      bundleContent = bundleContent.replace(allPattern, `font-family: "${newFontName}"`);

      // 2) Add !important so icon usage beats parent host CSS.
      const usagePattern = /font-family:\s*"momentum-ui-icons-cj-widget"(?=[;}])/g;
      bundleContent = bundleContent.replace(usagePattern, `font-family: "${newFontName}" !important`);

      // 3) Remove !important back from the @font-face definition (invalid there).
      const badFontFacePattern = /(@font-face\s*\{[^}]*font-family:\s*"[^"]*")\s*!important/g;
      let fixedCount = 0;
      bundleContent = bundleContent.replace(badFontFacePattern, (match, group1) => {
        fixedCount++;
        return group1;
      });

      fs.writeFileSync(bundlePath, bundleContent, 'utf-8');
      console.log(`[${path.basename(bundlePath)}] ✓ Font files inlined. Corrected ${fixedCount} @font-face definitions.`);
    }
  } catch (error) {
    console.error('Error inlining fonts:', error.message);
    process.exit(1);
  }
}

inlineFonts();

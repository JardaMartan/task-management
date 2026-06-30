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
      path.join(__dirname, '../dist/bulk-reskill.js'),
      path.join(__dirname, '../dist/bulk-reskill-standalone.js'),
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

    // Load all CiscoSansTT text fonts referenced by momentum-ui/core CSS.
    // These use relative paths (../fonts/<name>.woff2) which break inside shadow DOM
    // on Edge. We inline them as base64 data URIs so the bundle is self-contained.
    const ciscoSansFontsDir = path.join(__dirname, '../node_modules/@momentum-ui/core/fonts');
    const ciscoSansFontNames = [
      'CiscoSansTTRegular',
      'CiscoSansTTBold',
      'CiscoSansTTLight',
      'CiscoSansTTThin',
      'CiscoSansTTHeavy',
      'CiscoSansTTExtraLight',
      'CiscoSansTTRegularOblique',
      'CiscoSansTTBoldOblique',
      'CiscoSansTTLightOblique',
      'CiscoSansTTThinOblique',
      'CiscoSansTTHeavyOblique',
      'CiscoSansTTExtraLightOblique',
    ];
    const ciscoSansBase64Map = {};
    for (const fontName of ciscoSansFontNames) {
      const fontPath = path.join(ciscoSansFontsDir, `${fontName}.woff2`);
      if (fs.existsSync(fontPath)) {
        const buf = fs.readFileSync(fontPath);
        ciscoSansBase64Map[fontName] = buf.toString('base64');
        console.log(`✓ CiscoSansTT font loaded: ${fontName}.woff2 (${buf.length} bytes)`);
      } else {
        console.warn(`⚠ CiscoSansTT font not found, skipping: ${fontPath}`);
      }
    }

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

      // Inline CiscoSansTT text fonts — fixes Edge shadow-DOM font resolution.
      // The momentum-ui CSS uses relative paths like url(../fonts/CiscoSansTTRegular.woff2)
      // which fail inside Shadow DOM when copied by cssText injection.
      let ciscoSansCount = 0;
      for (const [fontName, base64] of Object.entries(ciscoSansBase64Map)) {
        const before = bundleContent.length;
        bundleContent = bundleContent.replace(
          new RegExp(`url\\([^)]*${fontName}\\.woff2[^)]*\\)`, 'g'),
          `url(data:font/woff2;base64,${base64})`
        );
        if (bundleContent.length !== before) ciscoSansCount++;
      }
      console.log(`[${path.basename(bundlePath)}] ✓ CiscoSansTT: inlined ${ciscoSansCount} font variant(s).`);

      fs.writeFileSync(bundlePath, bundleContent, 'utf-8');
      console.log(`[${path.basename(bundlePath)}] ✓ Font files inlined. Corrected ${fixedCount} @font-face definitions.`);
    }
  } catch (error) {
    console.error('Error inlining fonts:', error.message);
    process.exit(1);
  }
}

inlineFonts();

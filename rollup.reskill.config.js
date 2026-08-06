import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import terser from '@rollup/plugin-terser';
import replace from '@rollup/plugin-replace';
import json from '@rollup/plugin-json';
import postcss from 'rollup-plugin-postcss';

// Build modes:
//   'self-contained' → bundles everything (React/Redux inlined) → bulk-reskill-standalone.js
//   'cdn-libs'       → externalizes React + Redux family as CDN globals → bulk-reskill-cdn.js
//                      (loaded via bulk-reskill-cdn-loader.js, which pulls the UMD deps first)
//   (default)        → dev build, React externalized to page globals → bulk-reskill.js
const buildMode = process.env.BUILD_MODE;
const isSelfContained = buildMode === 'self-contained';
const isCdnLibs = buildMode === 'cdn-libs';

// React/Redux packages mapped to their UMD global names for the cdn-libs build.
const cdnGlobals = {
  react: 'React',
  'react-dom': 'ReactDOM',
  'react-dom/client': 'ReactDOM',
  'react-redux': 'ReactRedux',
  '@reduxjs/toolkit': 'RTK',
};
const cdnExternalIds = new Set(Object.keys(cdnGlobals));

// The dev build only externalizes React itself (page provides React/ReactDOM).
const reactGlobals = {
  react: 'React',
  'react-dom': 'ReactDOM',
  'react-dom/client': 'ReactDOM',
};
const isReactExternal = (id) => id === 'react' || id === 'react-dom' || id === 'react-dom/client';

const outputFile = isCdnLibs
  ? 'dist/bulk-reskill-cdn.js'
  : (isSelfContained ? 'dist/bulk-reskill-standalone.js' : 'dist/bulk-reskill.js');

export default {
  input: 'src-reskill/index.jsx',
  output: {
    file: outputFile,
    format: 'iife',
    inlineDynamicImports: true,
    name: 'BulkReskill',
    globals: isCdnLibs ? cdnGlobals : (isSelfContained ? {} : reactGlobals),
  },
  external: isCdnLibs
    ? (id) => cdnExternalIds.has(id)
    : (isSelfContained ? [] : isReactExternal),
  onwarn: (warning, warn) => {
    if (warning.code === 'NAMESPACE_REDEFINE') return;
    if (warning.code === 'THIS_IS_UNDEFINED') return;
    if (warning.code === 'CIRCULAR_DEPENDENCY') {
      if (warning.message.includes('react') ||
          warning.message.includes('redux') ||
          warning.message.includes('@momentum-ui')) {
        return;
      }
    }
    warn(warning);
  },
  plugins: [
    replace({
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env': '{}',
      process: 'undefined',
      'typeof process': '"undefined"',
      'process !== undefined': 'false',
      'process != undefined': 'false',
      'process == undefined': 'true',
      'process === undefined': 'true',
      '!process': 'true',
      'process &&': 'false &&',
      'process ||': 'false ||',
      'global.process': 'undefined',
      'window.process': 'undefined',
      // Dev build only: rewrite CJS require('react') to the page global. The
      // cdn-libs build must NOT do this — it corrupts momentum's react binding;
      // rollup's external + commonjs interop handles the globals correctly there.
      ...((isSelfContained || isCdnLibs) ? {} : {
        'require("react")': 'React',
        "require('react')": 'React',
        'require("react-dom")': 'ReactDOM',
        "require('react-dom')": 'ReactDOM',
        'require("react-dom/client")': 'ReactDOM',
        "require('react-dom/client')": 'ReactDOM',
      }),
      'require("util")': '{ inspect: function(obj) { return JSON.stringify(obj); } }',
      "require('util')": '{ inspect: function(obj) { return JSON.stringify(obj); } }',
      preventAssignment: true,
    }),
    resolve({
      browser: true,
      preferBuiltins: false,
      extensions: ['.js', '.jsx'],
      dedupe: ['react', 'react-dom'],
    }),
    commonjs({
      include: ['node_modules/**'],
      exclude: ['node_modules/@momentum-ui/react/es/**'],
      transformMixedEsModules: true,
      sourceMap: false,
      defaultIsModuleExports: 'auto',
      requireReturnsDefault: 'auto',
    }),
    babel({
      exclude: 'node_modules/**',
      babelHelpers: 'bundled',
      presets: [
        ['@babel/preset-env', { targets: 'last 2 Chrome versions, last 2 Firefox versions, last 2 Safari versions, last 2 Edge versions' }],
        ['@babel/preset-react', { runtime: 'classic' }],
      ],
    }),
    json(),
    postcss({
      extract: false,
      inject: true,
      minimize: true,
      sourceMap: false,
    }),
    terser({
      compress: {
        drop_console: false,
        drop_debugger: false,
        passes: 2,
        pure_getters: true,
        unsafe_arrows: true,
        unsafe_methods: true,
      },
      format: { comments: false },
    }),
  ],
};

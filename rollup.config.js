import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import terser from '@rollup/plugin-terser';
import replace from '@rollup/plugin-replace';
import json from '@rollup/plugin-json';
import postcss from 'rollup-plugin-postcss';

// Build modes:
//   'self-contained' → bundles everything (React/Redux inlined) → task-management-standalone.js
//   'cdn-libs'       → externalizes React + Redux family as CDN globals → task-management-cdn.js
//                      (loaded via task-management-cdn-loader.js, which pulls the UMD deps first)
//   (default)        → dev build, React externalized to page globals → task-management.js
const buildMode = process.env.BUILD_MODE;
const isSelfContained = buildMode === 'self-contained';
const isCdnLibs = buildMode === 'cdn-libs';

// React packages mapped to their UMD global names for the cdn-libs build.
// NOTE: @reduxjs/toolkit is intentionally NOT externalized — it must stay bundled
// so RTK uses the same immer instance that store.js disables auto-freeze on
// (setAutoFreeze(false)). The Desktop passes MobX observables (agent/task/cad)
// that live in the store; the CDN RTK's separate immer would freeze them and hit
// MobX's proxy trap (error 13). Keeping RTK bundled avoids that.
const cdnGlobals = {
  'react': 'React',
  'react-dom': 'ReactDOM',
  'react-dom/client': 'ReactDOM',
  'react-redux': 'ReactRedux',
};
const cdnExternalIds = new Set(Object.keys(cdnGlobals));
const reactGlobals = {
  'react': 'React',
  'react-dom': 'ReactDOM',
  'react-dom/client': 'ReactDOM',
};
const isReactExternal = (id) => id === 'react' || id === 'react-dom' || id === 'react-dom/client';

export default {
  input: 'src/index.jsx',
  output: {
    file: isCdnLibs
      ? 'dist/task-management-cdn.js'
      : (isSelfContained ? 'dist/task-management-standalone.js' : 'dist/task-management.js'),
    format: 'iife',
    inlineDynamicImports: true,
    name: 'TaskManagement',
    globals: isCdnLibs ? cdnGlobals : (isSelfContained ? {} : reactGlobals),
  },
  // External dependencies - only externalize when not self-contained
  external: isCdnLibs
    ? (id) => cdnExternalIds.has(id)
    : (isSelfContained ? [] : isReactExternal),
  onwarn: (warning, warn) => {
    // Suppress "Cannot call a namespace" warnings for React components
    if (warning.code === 'NAMESPACE_REDEFINE') {
      return;
    }

    // Suppress "this has been rewritten to undefined" warnings
    if (warning.code === 'THIS_IS_UNDEFINED') {
      return;
    }

    // Suppress circular dependency warnings for React/Redux
    if (warning.code === 'CIRCULAR_DEPENDENCY') {
      if (warning.message.includes('react') ||
        warning.message.includes('redux') ||
        warning.message.includes('@momentum-ui')) {
        return;
      }
    }

    // Show all other warnings
    warn(warning);
  },
  plugins: [
    // Replace process variables with browser-compatible values
    replace({
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env': '{}',
      'process': 'undefined',
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
      // Only replace React requires in the DEV build. self-contained bundles React;
      // cdn-libs relies on rollup external + commonjs interop (the replace corrupts it).
      ...((isSelfContained || isCdnLibs) ? {} : {
        'require("react")': 'React',
        'require(\'react\')': 'React',
        'require("react-dom")': 'ReactDOM',
        'require(\'react-dom\')': 'ReactDOM',
        'require("react-dom/client")': 'ReactDOM',
        'require(\'react-dom/client\')': 'ReactDOM',
      }),
      // Replace Node.js util with a minimal polyfill
      'require("util")': '{ inspect: function(obj) { return JSON.stringify(obj); } }',
      'require(\'util\')': '{ inspect: function(obj) { return JSON.stringify(obj); } }',
      preventAssignment: true
    }),
    resolve({
      browser: true,
      preferBuiltins: false,
      extensions: ['.js', '.jsx'],
      // Deduplicate React to prevent multiple versions
      dedupe: ['react', 'react-dom']
    }),
    commonjs({
      include: ['node_modules/**'],
      // The @momentum-ui/react/es/ directory is pure ESM — exclude those files so
      // the CJS wrapper is NOT applied and rollup can tree-shake unused components.
      // CJS sub-dependencies (e.g. @momentum-ui/react/node_modules/**) remain included.
      exclude: ['node_modules/@momentum-ui/react/es/**'],
      transformMixedEsModules: true,
      sourceMap: false,
      // Fix "this is undefined" warnings
      defaultIsModuleExports: 'auto',
      // Transform all CommonJS modules properly, even those referencing React
      requireReturnsDefault: 'auto'
    }),
    babel({
      exclude: 'node_modules/**',
      babelHelpers: 'bundled',
      presets: [
        // Target modern evergreen browsers only — avoids heavy polyfills for
        // ES2015–ES2020 syntax that all current browsers support natively.
        ['@babel/preset-env', { targets: 'last 2 Chrome versions, last 2 Firefox versions, last 2 Safari versions, last 2 Edge versions' }],
        ['@babel/preset-react', { runtime: 'classic' }]
      ]
    }),
    json(),
    postcss({
      extract: false,
      inject: true, // Inject CSS into the document automatically
      minimize: true,
      sourceMap: false
    }),
    terser({
      compress: {
        drop_console: false,
        drop_debugger: false,
        passes: 2,          // extra compression pass
        pure_getters: true, // assume getters have no side effects
        unsafe_arrows: true,
        unsafe_methods: true,
      },
      format: {
        comments: false,    // strip all comments
      }
    })
  ]
};
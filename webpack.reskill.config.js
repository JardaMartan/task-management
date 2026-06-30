const path = require('node:path');
const webpack = require('webpack');

module.exports = {
  entry: './src-reskill/index.jsx',
  mode: 'development',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bulk-reskill-dev.js',
    clean: false,
  },
  externals: {
    react: 'React',
    'react-dom': 'ReactDOM',
    'react-redux': 'ReactRedux',
    redux: 'Redux',
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('development'),
    }),
  ],
  devServer: {
    static: [
      { directory: path.join(__dirname), watch: { ignored: /node_modules/ } },
      { directory: path.join(__dirname, 'dist'), watch: true },
    ],
    watchFiles: {
      paths: ['src-reskill/**/*', 'dev-reskill.html'],
      options: { ignored: /node_modules/ },
    },
    compress: true,
    port: 8081,
    open: '/dev-reskill.html',
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', { targets: 'defaults' }],
              ['@babel/preset-react', { runtime: 'automatic' }],
            ],
          },
        },
      },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
    ],
  },
  resolve: { extensions: ['.js', '.jsx'] },
};

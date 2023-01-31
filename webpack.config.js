const path = require('path'); // eslint-disable-line
const webpack = require('webpack');
module.exports = {
  mode: 'production',
  entry: {
    'ts-spel': './src/index.ts',
    'ts-spel.min': './src/index.ts',
  },
  output: {
    path: path.resolve(__dirname, 'build/main'),
    filename: '[name].js',
    libraryTarget: 'umd',
    library: 'TsSpel',
    umdNamedDefine: true,
    globalObject: 'this',
  },
  plugins: [
    new webpack.DefinePlugin({
      process: { env: {} },
    }),
  ],

  resolveLoader: {
    modules: [path.join(__dirname, 'node_modules')],
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    modules: [path.join(__dirname, 'node_modules')],
  },

  // Source maps support ('inline-source-map' also works)
  devtool: 'source-map',
  // Add the loader for .ts files.
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
      },
    ],
  },
};

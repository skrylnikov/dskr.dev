const path = require('path');
const webpack = require('webpack');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = ({
  entry: {
    app: './src/web.tsx',
  },
  //devtool: 'eval-source-map',

  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(ts|js)x?$/,
        exclude: /(node_modules)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              "preact",
              [
                "@babel/preset-env",
                {
                  corejs: {
                    version: '3.1',
                  },
                  useBuiltIns: "usage",
                  targets: {
                    chrome: "67",
                  },
                  modules: false,
                  loose: true,
                },
              ],
              "@babel/preset-typescript",
            ],
            plugins: [
              "@babel/plugin-proposal-optional-chaining",
              "@babel/plugin-proposal-nullish-coalescing-operator",
              "@babel/plugin-syntax-dynamic-import",
              "@babel/proposal-class-properties",
              "@babel/proposal-object-rest-spread",
              //["transform-react-jsx", { "pragma": "h" }],
            ]
          }
        }
      },

    ]
  },

  plugins: [
    //new BundleAnalyzerPlugin(),
    /*
    new webpack.IgnorePlugin({
      resourceRegExp: /node/,
    }),
    */
    new webpack.DefinePlugin({
      'process.env.WEB': JSON.stringify(true),
    }),
  ],


  output: {
    filename: `web.js`,
    chunkFilename: `chunk.[name].js`,
    publicPath: '/dist/',
  },

  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.json', '.css'],
  },

  devServer: {
    contentBase: path.join(__dirname, 'static'),
    compress: true,
    port: 9000,
    host: '127.0.0.1',
    hot: true,
    writeToDisk: true,
    proxy: {
      context: () => true,
      target: 'http://localhost:8000'
    }
  },

});
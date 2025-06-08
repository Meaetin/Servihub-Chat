const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  return {
    entry: './src/index.js',
    mode: isProduction ? 'production' : 'development',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'servihub-chat-widget.js',
      library: 'ServiHubChat',
      libraryTarget: 'umd',
      libraryExport: 'default',
      globalObject: 'this',
      clean: true,
    },
    module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env', {
                  targets: '> 0.25%, not dead',
                  modules: false,
                }],
                ['@babel/preset-react', {
                  runtime: 'automatic'
                }]
              ],
            },
          },
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
      ],
    },
    resolve: {
      extensions: ['.js', '.jsx'],
    },
    externals: isProduction ? {
      'react': {
        commonjs: 'react',
        commonjs2: 'react',
        amd: 'react',
        root: 'React',
      },
      'react-dom': {
        commonjs: 'react-dom',
        commonjs2: 'react-dom',
        amd: 'react-dom',
        root: 'ReactDOM',
      },
      'react-dom/client': {
        commonjs: 'react-dom/client',
        commonjs2: 'react-dom/client',
        amd: 'react-dom/client',
        root: ['ReactDOM', 'client'],
      },
    } : {
      // In development, simple externals
      'react': 'React',
      'react-dom': 'ReactDOM',
    },
    optimization: {
      minimize: isProduction,
      usedExports: true,
      sideEffects: false,
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './public/index.html',
        filename: 'index.html',
      }),
      ...(process.env.ANALYZE ? [new BundleAnalyzerPlugin()] : []),
    ],
    devServer: {
      static: {
        directory: path.join(__dirname, 'dist'),
      },
      compress: true,
      port: 3002,
      open: true,
    },
    performance: isProduction ? {
      maxAssetSize: 25600, // 25kB
      maxEntrypointSize: 25600, // 25kB
      hints: 'error',
    } : false, // Disable performance hints in development
  };
}; 
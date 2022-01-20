const gulp = require('gulp')
const webpack = require('webpack-stream')
const CircularDependencyPlugin = require('circular-dependency-plugin')
const DuplicatePackageCheckerPlugin = require("duplicate-package-checker-webpack-plugin")
const eslint = require('gulp-eslint')

module.exports = function script() {
    return gulp.src('src/jquery-autocomplete.js')
        .pipe(eslint())
        .pipe(eslint.format())
        .pipe(webpack({
            mode: process.env.NODE_ENV,
            output: {
                filename: 'jquery-autocomplete.min.js',
            },
            module: {
                rules: [
                    {
                        test: /\.m?js$/,
                        exclude: /(node_modules|bower_components)/,
                        use: {
                            loader: 'babel-loader',
                            options: {
                                presets: ['@babel/preset-env']
                            }
                        }
                    }
                ]
            },
            plugins: [
                new CircularDependencyPlugin(),
                new DuplicatePackageCheckerPlugin()
            ],
            externals: {
                "jquery": "jQuery"
            }
        }))
        .pipe(gulp.dest('build'))
}
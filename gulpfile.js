const gulp = require('gulp')
const sass = require('gulp-sass')(require('sass'));
const plumber = require('gulp-plumber')
const styleLint = require('gulp-stylelint')
const rename = require("gulp-rename")
const cleanCSS = require('gulp-clean-css')
const server = require('browser-sync').create()
const eslint = require('gulp-eslint')
const webpack = require('webpack-stream')
const CircularDependencyPlugin = require('circular-dependency-plugin')
const DuplicatePackageCheckerPlugin = require("duplicate-package-checker-webpack-plugin")

function setMode(isProduction = false) {
    return cb => {
        process.env.NODE_ENV = isProduction ? 'production' : 'development'
        cb()
    }
}

function styles() {
    return gulp.src('src/jquery-autocomplete.scss')
        .pipe(plumber())
        .pipe(styleLint({
            fix: true,
            failAfterError: false,
            reporters: [
                {
                    formatter: 'string',
                    console: true
                }
            ]
        }))
        .pipe(sass())
        .pipe(cleanCSS({
            debug: true,
            compatibility: '*'
        }, details => {
            console.log(`${details.name}: Original size:${details.stats.originalSize} - Minified size: ${details.stats.minifiedSize}`)
        }))
        .pipe(rename({suffix: '.min'}))
        .pipe(gulp.dest('build'))
}

function script() {
    return gulp.src('src/jquery-autocomplete.js')
        .pipe(plumber())
        .pipe(eslint({fix:true}))
        .pipe(eslint.format())
        .pipe(webpack({
            mode: process.env.NODE_ENV,
            output: {
                filename: 'jquery-autocomplete.min.js',
            },
            externals: {
                "jquery": "jQuery"
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
            ]
        }))
        .pipe(gulp.dest('build'))
}

function readyReload(cb) {
    server.reload()
    cb()
}

function serve(cb) {
    server.init({
        server: 'build',
        notify: false,
        open: true,
        cors: true
    })


    gulp.watch('src/*.scss', gulp.series(styles, cb => gulp.src('build').pipe(server.stream()).on('end', cb)))
    gulp.watch('src/*.js', gulp.series(script, readyReload))

    return cb()
}

const dev = gulp.parallel(styles, script)
const build = gulp.series(dev)

module.exports.serve = gulp.series(setMode(), build, serve)
module.exports.build = gulp.series(setMode(true), build)
const gulp = require('gulp')
const sass = require('gulp-sass')(require('sass'));
const styleLint = require('gulp-stylelint')
const rename = require("gulp-rename")
const cleanCSS = require('gulp-clean-css')
const server = require('browser-sync').create()
const eslint = require('gulp-eslint')
const webpack = require('webpack-stream')

function setMode(isProduction = false) {
    return cb => {
        process.env.NODE_ENV = isProduction ? 'production' : 'development'
        cb()
    }
}

function styles() {
    return gulp.src('src/*.scss')
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
        .pipe(eslint())
        .pipe(eslint.format())
        .pipe(webpack({
            mode: process.env.NODE_ENV,
            output: {
                filename: '[name].min.js',
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
            }
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

const dev = gulp.parallel(styles,script)
const build = gulp.series(dev)

module.exports.serve = gulp.series(setMode(), build,serve)
module.exports.build = gulp.series(setMode(true), build)
const gulp = require('gulp')

const serve = require('./gulp/tasks/serve')
const styles = require('./gulp/tasks/styles')
const script = require('./gulp/tasks/script')

function setMode(isProduction = false) {
    return cb => {
        process.env.NODE_ENV = isProduction ? 'production' : 'development'
        cb()
    }
}

const dev = gulp.parallel(script,styles)

const build = gulp.series(dev)

module.exports.start = gulp.series(setMode(), build, serve)
module.exports.build = gulp.series(setMode(true), build)
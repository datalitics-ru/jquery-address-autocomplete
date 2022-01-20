const gulp = require('gulp')

const styles = require('./styles')
const script = require('./script')
const server = require('browser-sync').create()

function readyReload(cb) {
    server.reload()
    cb()
}

module.exports = function serve(cb) {
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
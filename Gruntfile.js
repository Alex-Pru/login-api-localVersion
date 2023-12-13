module.exports = function (grunt) {
  grunt.initConfig({
    clean: {
      dist: ['dist']
    },
    uglify: {
      my_target: {
        files: {
          'dist/output.min.js': ['./app.js']
        }
      }
    },
    shell: {
      runCode: {
        command: 'node ./dist/output.min.js',
        options: {
          stdout: true,
          stderr: true
        }
      }
    }
  })

  grunt.loadNpmTasks('grunt-contrib-clean')
  grunt.loadNpmTasks('grunt-shell')
  grunt.loadNpmTasks('grunt-contrib-uglify')

  grunt.registerTask('default', ['clean', 'uglify', 'shell:runCode'])
}

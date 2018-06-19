const fs = require('fs-extra')
const walk = require('walk')
const Filter = require('./filter')
const debug = require('@ff0000-ad-tech/debug')
let log = debug('cs-plugin-vendor-ft:utils')

function getUnderscored(str) {
	return str.replace(/(\s|\-)/g, '_')
}

function copyDirectory(from, toReview, toUpload, zip) {
	return new Promise((resolve, reject) => {
		walk
			.walk(from, Filter.excludedFolders())
			.on('file', (root, stat, next) => {
				if (Filter.excludedFiles(stat.name)) {
					// skip the excluded files
					next()
				} else {
					fs.readFile(root + '/' + stat.name, (err, data) => {
						// remove the base file path to get just the directores to copy over
						let baseFolder = '.' + String(root).substr(from.length) + '/'
						// log('file:', stat.name, '| root:', root, '| baseFolder:', baseFolder)

						fs.writeFile((toReview || from) + baseFolder + stat.name, data)

						// write the file into the zip
						// ternary decides if including the entire pathing or just relative file paths
						// console.log('toUpload:', toUpload)
						zip.file((toUpload || from) + baseFolder + stat.name, data)
						next()
					})
				}
			})
			.on('errors', (entry, stat) => {
				// log('walking error:', entry)
				reject()
			})
			.on('end', () => {
				// log('walk.end')
				resolve()
			})
	})
}

function save(zip, path, name) {
	return new Promise((resolve, reject) => {
		zip
			.generateNodeStream({
				type: 'nodebuffer',
				streamFiles: true
			})
			.pipe(fs.createWriteStream(path + name + '.zip'))
			.on('finish', () => {
				// log(path + name, 'save() successful')
				resolve()
			})
	})
}

module.exports = {
	getUnderscored,
	copyDirectory,
	save
}

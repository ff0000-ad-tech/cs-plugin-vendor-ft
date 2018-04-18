const fs = require('fs-extra')
const path = require('path')
const walk = require('walk')
const JSZIP = require('jszip')
const Utils = require('./utils')
const Filter = require('./filter')
const debug = require('@ff0000-ad-tech/debug')
let log = debug('cs-plugin-vendor-ft:packager')

let buildData
const TYPE_STANDARD = 'standard'
const TYPE_EXPANDABLE = 'expandable'
let skipPartners = []

function createVendorPackage(profile, folders, targets) {
	log('createVendorPackage()')
	return new Promise((resolve, reject) => {
		// make the top level directory
		const dir = './4-vendor/' + profile + '/'
		fs.emptyDirSync(dir)

		const dirReview = dir + 'to_review/'
		fs.emptyDirSync(dirReview)

		const dirUpload = dir + 'to_upload/'
		fs.emptyDirSync(dirUpload)

		const dirUploadRich = dirUpload + 'richLoads/'
		fs.emptyDirSync(dirUploadRich)

		const dirUploadBase = dirUpload + 'baseLoad/'
		fs.emptyDirSync(dirUploadBase)

		// top level for each [size] folder
		let masterPromises = []

		Object.keys(targets).forEach(target => {
			const buildData = {}

			// extract the [size] folder name
			const filePath = '.' + targets[target]
			const filePathSplit = filePath.split(path.sep)
			filePathSplit.pop()
			const folderName = filePathSplit.pop()
			buildData['dimensions'] = folderName.match(/^([0-9]+)x([0-9]+)/g)[0].split('x')

			log('  folderName:', folderName)
			log('      target:', target)
			log('    filePath:', filePath)

			// get the ad type; then is expandable, set flag to skip the partner

			// project_name__deploy_profile__size
			const dirOutputName = getUnderscored(folders.project) + '__' + getUnderscored(profile) + '__' + folderName

			buildData.directories = {
				name: {
					base: dirOutputName + '_FT_BASE',
					rich: dirOutputName + '_FT_RICH'
				},
				upload: {
					base: dirUploadBase,
					rich: dirUploadRich
				},
				review: {}
			}

			// REVIEW
			buildData.directories.review['size'] = dirReview + folderName + '/'
			fs.emptyDirSync(buildData.directories.review['size'])

			// RICH
			buildData.directories.review['rich'] = buildData.directories.review['size'] + 'richLoads/'
			fs.emptyDirSync(buildData.directories.review['rich'])

			buildData.directories.review['richStd'] = buildData.directories.review['rich'] + buildData.directories.name.rich + '/'
			fs.emptyDirSync(buildData.directories.review['richStd'])

			let zipRich = new JSZIP()
			masterPromises.push(
				// copy the entire directory
				Utils.copyDirectory(filePath, Filter.excludedFiles, buildData.directories.review['richStd'], './', zipRich).then(() => {
					// return the promise of the zip save
					return Utils.save(zipRich, buildData.directories.upload['rich'], buildData.directories.name['rich'])
				})
			)

			// BASE
			buildData.directories.review['base'] = buildData.directories.review['size'] + 'baseLoad/' + buildData.directories.name.base + '/'
			fs.emptyDirSync(buildData.directories.review['base'])

			let zipBase = new JSZIP()
			let basePromises = [
				// index
				new Promise((resolve, reject) => {
					fs.readFile(path.join(__dirname, '../src') + '/ft_base_standard.html', 'utf8', (err, data) => {
						// modify the index now:
						data = data.replace(get_richload_base_css_regex, val => {
							return val
								.replace(get_width_css_regex, () => 'width: ' + buildData['dimensions'][0])
								.replace(get_height_css_regex, () => 'height: ' + buildData['dimensions'][1])
						})

						// write into the zip
						zipBase.file('index.html', data)

						// write into review
						fs.writeFile(buildData.directories.review['base'] + 'index.html', data, err => {
							if (err) reject()
						})

						resolve()
					})
				}),
				// manifest.js
				new Promise((resolve, reject) => {
					fs.readFile(filePath + 'manifest.js', 'utf8', (err, dataRaw) => {
						const manifestJSON = transformManifest(dataRaw, buildData)
						const backToString = 'FT.manifest(' + JSON.stringify(manifestJSON) + ')'

						// write into the zip
						zipBase.file('manifest.js', backToString)

						// write into review
						fs.writeFile(buildData.directories.review['base'] + 'manifest.js', backToString, err => {
							if (err) reject()
						})

						resolve()
					})
				})
			]
			masterPromises.push(
				Promise.all(basePromises).then(() => {
					return Utils.save(zipBase, buildData.directories.upload['base'], buildData.directories.name['base'])
				})
			)

			log(buildData)
		})

		Promise.all(masterPromises).then(() => {
			log('ALL SIZE ZIPS CREATED')
			skipPartners = []
			resolve()
		})
	})
}

function transformManifest(dataRaw, buildData) {
	// remove comments, TF.manifest(
	let toStringJSON = dataRaw.replace(/\/\/.+/g, '').replace(/FT\.manifest\(/g, '')

	let index = toStringJSON.lastIndexOf('})')
	log('index:', index)
	toStringJSON = toStringJSON.substring(0, index + 1)
	log('toStringJSON:', toStringJSON)

	let manifestJSON = JSON.parse(toStringJSON)
	log(manifestJSON)

	// ----------------------------------------
	// update base properties
	// if (ad_type == TYPE_STANDARD || (ad_type == TYPE_EXPANDABLE && self.is_collapsed(size['build_size'])):
	// 	manifest_json['width'] = self.build_data['dimensions']['width']
	// 	manifest_json['height'] = self.build_data['dimensions']['height']
	// 	manifest_json['clickTagCount'] = len(self.settings.clicktags[size['deploy_size']])

	// add rich-loads
	manifestJSON['richLoads'].push({
		name: 'richloadBase',
		src: buildData.directories.name['rich']
	})

	// set instandAds-reference to richLoads
	manifestJSON['instantAds'].push({
		name: 'richloadBase',
		type: 'richLoad'
	})

	// if expandable, create a manifest node for the expanded params
	// if (ad_type == TYPE_EXPANDABLE && self.is_expanded(size['build_size'])) {
	manifestJSON['expand'] = {
		width: buildData['dimensions'][0],
		height: buildData['dimensions'][1],
		indentAcross: 0,
		indentDown: 0
	}
	// }

	return manifestJSON
}

function getUnderscored(str) {
	return str.replace(/(\s|\-)/g, '_')
}

const get_richload_base_css_regex = /#richload-base\s*\{[^\}]+\}/g
const get_richload_expand_css_regex = /#richload-expand\s*\{[^\}]+\}/g
const get_width_css_regex = /(width\:\s*)[0-9]+/
const get_height_css_regex = /(height\:\s*)[0-9]+/

module.exports = {
	createVendorPackage
}

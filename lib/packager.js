const fs = require('fs-extra')
const path = require('path')
const walk = require('walk')
const JSZIP = require('jszip')
const Utils = require('./utils')
const Manifest = require('./manifest')
const RegEx = require('./regex')
const AdType = require('./adType')
const ClickTag = require('./clicktag')
const debug = require('@ff0000-ad-tech/debug')
let log = debug('cs-plugin-vendor-ft:packager')

let storedCollapsedName = null

function createVendorPackage(profile, context, folders, targets) {
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

		// get FtData for later usage:
		Manifest.parseFtData(context, folders.build).then(() => {
			// top level for each [size] folder
			let masterPromises = []

			Object.keys(targets).forEach(target => {
				const buildData = {}

				// extract the [size] folder name
				const filePath = '.' + targets[target]
				const filePathSplit = filePath.split(path.sep)
				filePathSplit.pop()
				const folderName = filePathSplit.pop()
				buildData['dimensions'] = folderName.match(RegEx.dimension)[0].split('x')

				// log('> folderName:', folderName)
				// log('>     target:', target)
				// log('>   filePath:', filePath)

				const folderNameExtracted = folderName.replace(/_(collapsed|expanded)/g, '')
				// log('> folderNameExtracted:', folderNameExtracted)

				// project_name__deploy_profile__size
				const dirOutputName = Utils.getUnderscored(folders.project) + '__' + Utils.getUnderscored(profile) + '__'

				buildData.directories = {
					name: {
						base: dirOutputName + folderNameExtracted + '_FT_BASE',
						rich: dirOutputName + folderName + '_FT_RICH'
					},
					upload: {
						base: dirUploadBase,
						rich: dirUploadRich
					},
					review: {
						rich: {}
					}
				}

				// get the ad type; then is expandable, set flag to skip the partner
				buildData['buildType'] = buildData['adType'] = AdType.STANDARD
				const isCollapsed = folderName.match(/collapsed/g)
				const isExpanded = folderName.match(/expanded/g)
				if (isCollapsed || isExpanded) {
					buildData['buildType'] = isCollapsed ? 'collapsed' : 'expanded'
					buildData['adType'] = AdType.EXPANDABLE
					buildData['dimensionsExpand'] = folderNameExtracted.split('_')[1].split('x')
				}

				// REVIEW
				buildData.directories.review['size'] = dirReview + folderNameExtracted + '/'
				fs.ensureDirSync(buildData.directories.review['size'])

				// RICH
				buildData.directories.review.rich['root'] = buildData.directories.review['size'] + 'richLoads/'
				fs.ensureDirSync(buildData.directories.review.rich['root'])

				masterPromises.push(copyRichLoad(filePath, buildData))

				if (isCollapsed) {
					// store the collapsed name
					storedCollapsedName = buildData.directories.name.rich
					// log(buildData)
					// don't make the first time
					return
				}
				if (isExpanded) {
					buildData.directories.name['expanded'] = buildData.directories.name['rich']
					buildData.directories.name['rich'] = storedCollapsedName
					storedCollapsedName = null
				}

				// BASE
				buildData.directories.review['base'] = buildData.directories.review['size'] + 'baseLoad/' + buildData.directories.name.base + '/'
				fs.emptyDirSync(buildData.directories.review['base'])

				let zipBase = new JSZIP()
				let basePromises = [
					// index
					new Promise((resolve, reject) => {
						const indexName = buildData['adType'] == AdType.EXPANDABLE ? 'ft_base_expandable' : 'ft_base_standard'
						const indexPath = path.join(__dirname, '../src') + '/' + indexName + '.html'
						fs.readFile(indexPath, 'utf8', (err, data) => {
							// modify the index now:
							data = data.replace(RegEx.cssRichLoadBase, val => {
								return val
									.replace(RegEx.cssWidth, () => 'width: ' + buildData['dimensions'][0])
									.replace(RegEx.cssHeight, () => 'height: ' + buildData['dimensions'][1])
							})

							if (buildData['adType'] == AdType.EXPANDABLE) {
								data = data.replace(RegEx.cssRichLoadExpand, val => {
									return val
										.replace(RegEx.cssWidth, () => 'width: ' + buildData['dimensionsExpand'][0])
										.replace(RegEx.cssHeight, () => 'height: ' + buildData['dimensionsExpand'][1])
								})
							}

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
					ClickTag.parse(context + targets[target]).then(count => {
						buildData.clickTagCount = count
						return new Promise((resolve, reject) => {
							fs.readFile(context + '/' + filePath + 'manifest.js', 'utf8', (err, dataRaw) => {
								if (err) reject()
								const manifestJSON = Manifest.transform(dataRaw, buildData)
								// get the image map data....and text map data?
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
					})
				]
				masterPromises.push(
					Promise.all(basePromises).then(() => {
						return Utils.save(zipBase, buildData.directories.upload['base'], buildData.directories.name['base'])
					})
				)
				// log(buildData)
			})

			Promise.all(masterPromises).then(() => {
				log('ALL SIZE ZIPS CREATED')
				resolve()
			})
		})
	})
}

function copyRichLoad(filePath, buildData) {
	const type = buildData['buildType']
	buildData.directories.review.rich[type] = buildData.directories.review.rich['root'] + buildData.directories.name.rich + '/'
	fs.emptyDirSync(buildData.directories.review.rich[type])
	let zipRich = new JSZIP()
	const richName = buildData.directories.name['rich']
	// copy the entire directory
	return Utils.copyDirectory(filePath, buildData.directories.review.rich[type], './', zipRich).then(() => {
		// return the promise of the zip save
		return Utils.save(zipRich, buildData.directories.upload['rich'], richName)
	})
}

module.exports = {
	createVendorPackage
}

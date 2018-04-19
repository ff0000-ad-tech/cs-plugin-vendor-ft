const excludedFilesList = ['.gitignore', '.DS_Store', '*.txt', 'manifest.js']
const excludedFoldersList = ['instantAssets']

function excludedFiles(filename) {
	for (let str of excludedFilesList) {
		if (str.indexOf('*') == 0) {
			// means to check all file types
			const fileExt = filename.split('.')[1]
			const exclExt = str.split('.')[1]
			if (fileExt == exclExt) return true
		} else {
			// just do straight compare
			if (str == filename) return true
		}
	}
	return false
}

function excludedFolders() {
	return {
		filters: excludedFoldersList
	}
}

module.exports = {
	excludedFiles,
	excludedFolders
}

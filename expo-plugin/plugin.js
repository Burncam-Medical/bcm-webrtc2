// Patch code to fix android gradle bundling issue. Inject jniLibs.useLegacyPackaging preventing minSdkVersion = 24 initiated `couldn't find DSO to load: libhermes.so` bug
// https://github.com/expo/expo/issues/17450

const { createRunOncePlugin, withAppBuildGradle } = require('@expo/config-plugins');

const withAppBuildGradleModified = config => {
	return withAppBuildGradle(config, async file => {
		const modResults = file.modResults;
		modResults.contents = modResults.contents + '\nandroid.packagingOptions.jniLibs.useLegacyPackaging = true\n';
		return file;
	});
};

module.exports = createRunOncePlugin(
	withAppBuildGradleModified,
	'withAppBuildGradleModified',
	'1.0.0'
);
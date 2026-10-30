// Turns off Xcode's User Script Sandboxing, which blocks CocoaPods'
// "[CP] Copy Pods Resources" step. Applied every time Expo regenerates ios/.
const { withXcodeProject } = require('expo/config-plugins');

module.exports = (config) =>
  withXcodeProject(config, (cfg) => {
    const configs = cfg.modResults.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configs)) {
      const settings = configs[key].buildSettings;
      if (settings) settings.ENABLE_USER_SCRIPT_SANDBOXING = 'NO';
    }
    return cfg;
  });

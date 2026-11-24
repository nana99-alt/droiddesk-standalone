const fs = require("node:fs/promises");
const path = require("node:path");
const { withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");

const networkSecurityConfig = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false" />
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="false">127.0.0.1</domain>
    <domain includeSubdomains="false">localhost</domain>
  </domain-config>
</network-security-config>
`;

module.exports = function withLoopbackCleartext(config) {
  config = withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0];
    if (!application) throw new Error("DroidDesk: Android application manifest is missing.");
    application.$ = application.$ || {};
    application.$["android:networkSecurityConfig"] = "@xml/droiddesk_network_security_config";
    application.$["android:usesCleartextTraffic"] = "true";
    return mod;
  });

  return withDangerousMod(config, ["android", async (mod) => {
    const xmlDir = path.join(mod.modRequest.platformProjectRoot, "app/src/main/res/xml");
    await fs.mkdir(xmlDir, { recursive: true });
    await fs.writeFile(path.join(xmlDir, "droiddesk_network_security_config.xml"), networkSecurityConfig, "utf8");
    return mod;
  }]);
};

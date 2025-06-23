const i18n = require("i18n");

// Ensure i18n is configured
if (!i18n.getLocales().length) {
  i18n.configure(i18nConfig());
}

function localize(key, params) {
  return i18n.__(key, params);
}

function i18nConfig() {
  return {
    locales: ["pt_BR"],
    directory: __dirname + "/../locales",
    defaultLocale: "pt_BR",
    objectNotation: true,
  };
}

module.exports = { localize, i18nConfig };

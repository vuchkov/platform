const { Application } = Shopware;
const debug = Shopware.Utils.debug;

export default {
    state: {
        languageId: '',
        locales: [],
        currentLocale: null,
        fallbackLocale: null
    },

    getters: {
        adminLocaleLanguage(state) {
            if (!state || !state.currentLocale) {
                return null;
            }

            return state.currentLocale.split('-')[0];
        },

        adminLocaleRegion(state) {
            if (!state || !state.currentLocale) {
                return null;
            }
            return state.currentLocale.split('-')[1];
        }
    },

    actions: {
        setAdminLocale({ commit }, locale) {
            const loginService = Application.getContainer('service').loginService;

            if (!loginService.isLoggedIn()) {
                commit('setAdminLocale', { locale, languageId: '' });
                return;
            }

            const localeToLanguageService = Application.getContainer('service').localeToLanguageService;
            localeToLanguageService.localeToLanguage(locale).then((languageId) => {
                commit('setAdminLocale', { locale, languageId });
            });
        }
    },

    mutations: {
        registerAdminLocale(state, locale) {
            if (state.locales.find((l) => l === locale)) {
                return;
            }

            state.locales.push(locale);
        },

        setAdminLocale(state, { locale, languageId }) {
            if (!state.locales.find((l) => l === locale)) {
                debug.warn('AdminLocaleStore', `Locale ${locale} not registered at store`);
                return;
            }

            state.languageId = languageId;
            state.currentLocale = locale;
            Application.getContainer('factory').locale.storeCurrentLocale(state.currentLocale);
        },

        setAdminFallbackLocale(state, locale) {
            if (!state.locales.find((l) => l === locale)) {
                debug.warn('AdminLocaleStore', `Locale ${locale} not registered at store`);
                return;
            }

            state.fallbackLocale = locale;
        }
    }
};

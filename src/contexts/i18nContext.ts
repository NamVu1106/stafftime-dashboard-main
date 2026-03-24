/**
 * File này tồn tại để Vite/cache cũ không 404.
 * KHÔNG import ./I18nContext (trên Windows trùng tên file → vòng lặp).
 */
export { I18nProvider } from './IntlProvider';
export { I18nContext, type Language, type I18nContextType } from './i18nContextCore';

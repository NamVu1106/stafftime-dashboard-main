import appLogo from '../../z7440668636038_68aed2d628247a8baacf2c22533159dc-removebg-preview.ico';

export const APP_BRAND_NAME = 'YS-Smart';
export const APP_BRAND_SUBTITLE = 'You Sung Vina';
 
export const APP_LOGO_SRC = appLogo;

export const applyBrandFavicon = () => {
  if (typeof document === 'undefined') return;

  for (const rel of ['icon', 'shortcut icon']) {
    let link = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = rel;
      document.head.appendChild(link);
    }
    link.type = 'image/x-icon';
    link.href = APP_LOGO_SRC;
  }
};

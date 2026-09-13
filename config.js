window.BUS_APP_CONFIG = {
  API_BASE_URL: 'https://backendcompassgroup.vercel.app/api/v1',
  BRAND_NAME: 'Orangegroup'
};

const orangegroupTheme = document.createElement('link');
orangegroupTheme.rel = 'stylesheet';
orangegroupTheme.href = './compass-theme.css';
document.head.appendChild(orangegroupTheme);

const busBannerTheme = document.createElement('link');
busBannerTheme.rel = 'stylesheet';
busBannerTheme.href = './bus-banner.css';
document.head.appendChild(busBannerTheme);

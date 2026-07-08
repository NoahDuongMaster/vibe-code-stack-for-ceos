const API_ROUTES = {
  // Internal BFF (same-origin Next route handlers).
  AUTH_ME: '/api/auth/me',
  AUTH_LOGIN: '/api/auth/login',
};

const WEB_ROUTES = {
  HOME: '/',
  ACCOUNT: '/account',
  NOTFOUND: '/404',
  SIGN_IN: '/sign-in',
};

export { API_ROUTES, WEB_ROUTES };

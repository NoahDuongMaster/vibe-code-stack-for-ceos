import { HttpResponse, http } from 'msw';

export const handlers = [
  http.get('/api/health', () => {
    return HttpResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  }),

  http.post('/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };

    if (body.email === 'test@example.com' && body.password === 'password') {
      return HttpResponse.json({
        success: true,
        user: { id: '1', email: body.email },
      });
    }

    return HttpResponse.json(
      { success: false, message: 'Invalid credentials' },
      { status: 401 },
    );
  }),

  http.post('/api/auth/logout', () => {
    return HttpResponse.json({ success: true });
  }),
];

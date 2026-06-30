type PagesContext = {
  request: Request;
  env: {
    BACKEND_API_ORIGIN?: string;
  };
};

export async function onRequest(context: PagesContext): Promise<Response> {
  return proxyToBackend(context);
}

function proxyToBackend({ request, env }: PagesContext): Response | Promise<Response> {
  const target = new URL(request.url);
  const backendOrigin = new URL(env.BACKEND_API_ORIGIN ?? "https://api.calorie-track.com");

  target.protocol = backendOrigin.protocol;
  target.host = backendOrigin.host;

  return fetch(new Request(target.toString(), request));
}

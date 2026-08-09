interface Env {
  ALLOWED_ORIGINS?: string;
  ENVIRONMENT?: string;
}

type JsonObject = Record<string, unknown>;

interface SubmitResponse {
  id: string;
  polling_url: string;
  cost?: number | null;
  input_mp?: number | null;
  output_mp?: number | null;
}

interface PollResponse {
  status?: string;
  result?: {
    sample?: string;
  };
  error?: unknown;
  detail?: unknown;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

const BFL_API_BASE = "https://api.bfl.ai/v1";
const ALLOWED_MODELS = new Set([
  "flux-2-pro-preview",
  "flux-2-pro",
  "flux-2-max",
]);
const ALLOWED_OUTPUT_FORMATS = new Set(["jpeg", "png", "webp"]);
const REFERENCE_FIELDS = [
  "input_image",
  "input_image_2",
  "input_image_3",
  "input_image_4",
  "input_image_5",
  "input_image_6",
  "input_image_7",
  "input_image_8",
] as const;
const ALLOWED_BODY_FIELDS = new Set([
  "model",
  "prompt",
  "width",
  "height",
  "safety_tolerance",
  "output_format",
  "seed",
  "disable_pup",
  ...REFERENCE_FIELDS,
]);

const MAX_BODY_BYTES = 12 * 1024 * 1024;
const MAX_PROMPT_LENGTH = 10_000;
const MAX_IMAGE_PIXELS = 4_000_000;
const GENERATION_TIMEOUT_MS = 90_000;
const INITIAL_POLL_DELAY_MS = 500;
const MAX_POLL_DELAY_MS = 4_000;
const MAX_UPSTREAM_ERROR_LENGTH = 2_000;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = getCors(request, env);

    try {
      if (!cors.allowed) {
        throw new HttpError(403, "ORIGIN_NOT_ALLOWED", "当前来源不允许访问此代理");
      }

      const url = new URL(request.url);

      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: cors.headers,
        });
      }

      if (request.method === "GET" && url.pathname === "/health") {
        return jsonResponse(
          {
            ok: true,
            service: "clingy-flux-proxy",
          },
          200,
          cors.headers,
        );
      }

      if (request.method === "POST" && url.pathname === "/v1/generate") {
        return await generate(request, cors.headers);
      }

      throw new HttpError(404, "NOT_FOUND", "请求的接口不存在");
    } catch (error) {
      return errorResponse(error, cors.headers);
    }
  },
};

async function generate(request: Request, corsHeaders: Headers): Promise<Response> {
  const apiKey = request.headers.get("x-bfl-key");
  if (!apiKey || apiKey.trim().length === 0) {
    throw new HttpError(401, "MISSING_API_KEY", "缺少 x-bfl-key 请求头");
  }
  if (apiKey.length > 512 || /[\r\n]/.test(apiKey)) {
    throw new HttpError(400, "INVALID_API_KEY", "x-bfl-key 格式无效");
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    throw new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "请求体必须是 application/json");
  }

  const payload = validatePayload(await readJsonBody(request));
  const model = payload.model as string;
  delete payload.model;

  const abortController = new AbortController();
  let timedOut = false;
  const onClientAbort = () => abortController.abort(request.signal.reason);
  request.signal.addEventListener("abort", onClientAbort, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    abortController.abort(new DOMException("Generation timed out", "TimeoutError"));
  }, GENERATION_TIMEOUT_MS);

  try {
    const submitResponse = await safeBflFetch(
      `${BFL_API_BASE}/${model}`,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "x-key": apiKey,
        },
        body: JSON.stringify(payload),
        signal: abortController.signal,
      },
      0,
    );

    if (!submitResponse.ok) {
      throw await upstreamHttpError(submitResponse, "BFL 拒绝了生成请求");
    }

    const submitted = await parseJson<SubmitResponse>(submitResponse, "BFL 提交响应格式无效");
    if (
      typeof submitted.id !== "string" ||
      submitted.id.length === 0 ||
      typeof submitted.polling_url !== "string"
    ) {
      throw new HttpError(502, "INVALID_UPSTREAM_RESPONSE", "BFL 未返回有效的任务信息");
    }
    assertBflUrl(submitted.polling_url);

    const taskHeaders = buildTaskHeaders(submitted);
    const deliveryUrl = await pollForDelivery(
      submitted.polling_url,
      apiKey,
      abortController.signal,
    );
    const imageResponse = await safeBflFetch(
      deliveryUrl,
      {
        method: "GET",
        headers: { accept: "image/*" },
        signal: abortController.signal,
      },
      2,
    );

    if (!imageResponse.ok || !imageResponse.body) {
      throw await upstreamHttpError(imageResponse, "获取生成图片失败");
    }

    const imageContentType = imageResponse.headers.get("content-type") ?? "";
    if (!imageContentType.toLowerCase().startsWith("image/")) {
      throw new HttpError(502, "INVALID_IMAGE_RESPONSE", "BFL 返回了非图片内容");
    }

    const headers = new Headers(corsHeaders);
    headers.set("content-type", imageContentType);
    headers.set("cache-control", "private, no-store");
    headers.set("x-content-type-options", "nosniff");
    copyHeaderIfPresent(imageResponse.headers, headers, "content-length");
    copyHeaderIfPresent(imageResponse.headers, headers, "content-disposition");
    for (const [name, value] of taskHeaders) {
      headers.set(name, value);
    }

    return new Response(imageResponse.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    if (abortController.signal.aborted) {
      if (timedOut) {
        throw new HttpError(504, "GENERATION_TIMEOUT", "图片生成超时，请稍后重试");
      }
      throw new HttpError(499, "CLIENT_ABORTED", "客户端已取消请求");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", onClientAbort);
  }
}

async function pollForDelivery(
  pollingUrl: string,
  apiKey: string,
  signal: AbortSignal,
): Promise<string> {
  let delayMs = INITIAL_POLL_DELAY_MS;

  while (true) {
    await abortableDelay(delayMs, signal);

    const response = await safeBflFetch(
      pollingUrl,
      {
        method: "GET",
        headers: {
          accept: "application/json",
          "x-key": apiKey,
        },
        signal,
      },
      2,
    );

    if (!response.ok) {
      throw await upstreamHttpError(response, "查询 BFL 任务状态失败");
    }

    const data = await parseJson<PollResponse>(response, "BFL 轮询响应格式无效");
    const status = typeof data.status === "string" ? data.status.toLowerCase() : "";

    if (status === "ready") {
      const sample = data.result?.sample;
      if (typeof sample !== "string" || sample.length === 0) {
        throw new HttpError(502, "MISSING_DELIVERY_URL", "BFL 任务完成但未返回图片地址");
      }
      assertBflUrl(sample);
      return sample;
    }

    if (
      status === "error" ||
      status === "failed" ||
      status === "content moderated" ||
      status === "request moderated" ||
      status === "cancelled" ||
      status === "canceled"
    ) {
      throw new HttpError(
        502,
        "GENERATION_FAILED",
        "BFL 图片生成失败",
        sanitizeUpstreamDetails(data.error ?? data.detail ?? data.status),
      );
    }

    if (status !== "pending" && status !== "queued" && status !== "processing") {
      throw new HttpError(
        502,
        "UNKNOWN_UPSTREAM_STATUS",
        "BFL 返回了无法识别的任务状态",
        typeof data.status === "string" ? data.status : undefined,
      );
    }

    delayMs = Math.min(Math.round(delayMs * 1.5), MAX_POLL_DELAY_MS);
  }
}

function validatePayload(body: JsonObject): JsonObject {
  for (const field of Object.keys(body)) {
    if (!ALLOWED_BODY_FIELDS.has(field)) {
      throw new HttpError(400, "UNKNOWN_PARAMETER", `不支持参数：${field}`);
    }
  }

  const model = body.model;
  if (typeof model !== "string" || !ALLOWED_MODELS.has(model)) {
    throw new HttpError(
      400,
      "INVALID_MODEL",
      "model 仅支持 flux-2-pro-preview、flux-2-pro、flux-2-max",
    );
  }

  const prompt = body.prompt;
  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    throw new HttpError(400, "INVALID_PROMPT", "prompt 必须是非空字符串");
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new HttpError(
      400,
      "PROMPT_TOO_LONG",
      `prompt 最多允许 ${MAX_PROMPT_LENGTH} 个字符`,
    );
  }

  const width = body.width ?? 1024;
  const height = body.height ?? 1024;
  validateDimension(width, "width");
  validateDimension(height, "height");
  if ((width as number) * (height as number) > MAX_IMAGE_PIXELS) {
    throw new HttpError(400, "IMAGE_TOO_LARGE", "width × height 不能超过 400 万像素");
  }

  const safetyTolerance = body.safety_tolerance ?? 2;
  if (
    !Number.isInteger(safetyTolerance) ||
    (safetyTolerance as number) < 0 ||
    (safetyTolerance as number) > 5
  ) {
    throw new HttpError(400, "INVALID_SAFETY_TOLERANCE", "safety_tolerance 必须是 0 到 5 的整数");
  }

  const outputFormat = body.output_format ?? "jpeg";
  if (typeof outputFormat !== "string" || !ALLOWED_OUTPUT_FORMATS.has(outputFormat)) {
    throw new HttpError(400, "INVALID_OUTPUT_FORMAT", "output_format 仅支持 jpeg、png、webp");
  }

  if (body.seed !== undefined && (!Number.isSafeInteger(body.seed) || (body.seed as number) < 0)) {
    throw new HttpError(400, "INVALID_SEED", "seed 必须是非负安全整数");
  }
  if (body.disable_pup !== undefined && typeof body.disable_pup !== "boolean") {
    throw new HttpError(400, "INVALID_DISABLE_PUP", "disable_pup 必须是布尔值");
  }

  let referenceCount = 0;
  for (const field of REFERENCE_FIELDS) {
    const value = body[field];
    if (value === undefined || value === null) {
      continue;
    }
    referenceCount += 1;
    validateReferenceImage(value, field);
  }
  if (referenceCount > 8) {
    throw new HttpError(400, "TOO_MANY_REFERENCE_IMAGES", "参考图最多允许 8 张");
  }

  return {
    ...body,
    width,
    height,
    safety_tolerance: safetyTolerance,
    output_format: outputFormat,
  };
}

function validateDimension(value: unknown, field: "width" | "height"): asserts value is number {
  if (
    !Number.isInteger(value) ||
    (value as number) < 64 ||
    (value as number) % 16 !== 0
  ) {
    throw new HttpError(400, "INVALID_DIMENSION", `${field} 必须是不小于 64 的 16 倍数`);
  }
}

function validateReferenceImage(value: unknown, field: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new HttpError(400, "INVALID_REFERENCE_IMAGE", `${field} 必须是非空字符串`);
  }

  if (/^data:image\/(?:jpeg|jpg|png|webp);base64,[a-z0-9+/=\s]+$/i.test(value)) {
    return;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new HttpError(
      400,
      "INVALID_REFERENCE_IMAGE",
      `${field} 必须是 HTTPS 图片地址或受支持的 Base64 图片`,
    );
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new HttpError(400, "INVALID_REFERENCE_IMAGE", `${field} 必须使用无凭据的 HTTPS 地址`);
  }
}

async function readJsonBody(request: Request): Promise<JsonObject> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const length = Number(contentLength);
    if (!Number.isFinite(length) || length < 0) {
      throw new HttpError(400, "INVALID_CONTENT_LENGTH", "Content-Length 无效");
    }
    if (length > MAX_BODY_BYTES) {
      throw new HttpError(413, "BODY_TOO_LARGE", "请求体不能超过 12 MiB");
    }
  }

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > MAX_BODY_BYTES) {
    throw new HttpError(413, "BODY_TOO_LARGE", "请求体不能超过 12 MiB");
  }
  if (bytes.byteLength === 0) {
    throw new HttpError(400, "EMPTY_BODY", "请求体不能为空");
  }

  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new HttpError(400, "INVALID_JSON", "请求体不是有效的 JSON");
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpError(400, "INVALID_JSON_OBJECT", "请求体必须是 JSON 对象");
  }
  return value as JsonObject;
}

async function safeBflFetch(
  input: string,
  init: RequestInit,
  maxRedirects: number,
): Promise<Response> {
  let currentUrl = input;

  for (let redirectCount = 0; ; redirectCount += 1) {
    assertBflUrl(currentUrl);
    const response = await fetch(currentUrl, {
      ...init,
      redirect: "manual",
    });

    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return response;
    }
    if (redirectCount >= maxRedirects) {
      response.body?.cancel();
      throw new HttpError(502, "TOO_MANY_REDIRECTS", "BFL 上游重定向次数过多");
    }

    const location = response.headers.get("location");
    response.body?.cancel();
    if (!location) {
      throw new HttpError(502, "INVALID_REDIRECT", "BFL 返回了无效重定向");
    }
    currentUrl = new URL(location, currentUrl).toString();
  }
}

function assertBflUrl(value: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new HttpError(502, "UNSAFE_UPSTREAM_URL", "BFL 返回了无效的上游地址");
  }

  const hostname = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    !hostname.endsWith(".bfl.ai") ||
    hostname === ".bfl.ai" ||
    url.username ||
    url.password ||
    (url.port !== "" && url.port !== "443")
  ) {
    throw new HttpError(502, "UNSAFE_UPSTREAM_URL", "BFL 返回的上游地址未通过安全校验");
  }
}

async function parseJson<T>(response: Response, message: string): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    throw new HttpError(502, "INVALID_UPSTREAM_JSON", message);
  }
}

async function upstreamHttpError(response: Response, message: string): Promise<HttpError> {
  const text = (await response.text()).slice(0, MAX_UPSTREAM_ERROR_LENGTH);
  let details: unknown = text || undefined;
  if (text) {
    try {
      details = JSON.parse(text);
    } catch {
      // 保留截断后的纯文本上游错误。
    }
  }
  return new HttpError(
    response.status >= 400 && response.status < 500 ? response.status : 502,
    "UPSTREAM_ERROR",
    message,
    sanitizeUpstreamDetails(details),
  );
}

function sanitizeUpstreamDetails(details: unknown): unknown {
  if (details === undefined || details === null) {
    return undefined;
  }
  if (typeof details === "string") {
    return details.slice(0, MAX_UPSTREAM_ERROR_LENGTH);
  }
  try {
    return JSON.parse(
      JSON.stringify(details, (key, value) =>
        /key|token|secret|authorization/i.test(key) ? "[已隐藏]" : value,
      ).slice(0, MAX_UPSTREAM_ERROR_LENGTH),
    );
  } catch {
    return "上游返回了无法解析的错误详情";
  }
}

function abortableDelay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }

    const onAbort = () => {
      clearTimeout(timeout);
      reject(signal.reason);
    };
    const timeout = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function buildTaskHeaders(submitted: SubmitResponse): Headers {
  const headers = new Headers();
  if (/^[\x20-\x7e]{1,200}$/.test(submitted.id)) {
    headers.set("x-bfl-task-id", submitted.id);
  }
  setFiniteNumberHeader(headers, "x-bfl-cost", submitted.cost);
  setFiniteNumberHeader(headers, "x-bfl-input-mp", submitted.input_mp);
  setFiniteNumberHeader(headers, "x-bfl-output-mp", submitted.output_mp);
  return headers;
}

function setFiniteNumberHeader(
  headers: Headers,
  name: string,
  value: number | null | undefined,
): void {
  if (typeof value === "number" && Number.isFinite(value)) {
    headers.set(name, String(value));
  }
}

function copyHeaderIfPresent(from: Headers, to: Headers, name: string): void {
  const value = from.get(name);
  if (value !== null) {
    to.set(name, value);
  }
}

function getCors(request: Request, env: Env): { allowed: boolean; headers: Headers } {
  const headers = new Headers({
    "access-control-allow-headers": "Content-Type, X-BFL-Key",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-expose-headers":
      "Content-Type, Content-Length, X-BFL-Task-Id, X-BFL-Cost, X-BFL-Input-MP, X-BFL-Output-MP",
    "access-control-max-age": "86400",
  });
  const origin = request.headers.get("origin");
  if (!origin) {
    return { allowed: true, headers };
  }

  const configured = env.ALLOWED_ORIGINS?.trim();
  if (!configured) {
    headers.set("access-control-allow-origin", "*");
    return { allowed: true, headers };
  }

  const allowedOrigins = configured
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (allowedOrigins.includes("*")) {
    headers.set("access-control-allow-origin", "*");
    return { allowed: true, headers };
  }

  const isDevelopment = (env.ENVIRONMENT ?? "production").toLowerCase() !== "production";
  const isLocalhost = isDevelopment && isLocalhostOrigin(origin);
  if (allowedOrigins.includes(origin) || isLocalhost) {
    headers.set("access-control-allow-origin", origin);
    headers.append("vary", "Origin");
    return { allowed: true, headers };
  }

  return { allowed: false, headers };
}

function isLocalhostOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]")
    );
  } catch {
    return false;
  }
}

function jsonResponse(body: unknown, status: number, extraHeaders?: Headers): Response {
  const headers = new Headers(extraHeaders);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  return new Response(JSON.stringify(body), { status, headers });
}

function errorResponse(error: unknown, corsHeaders: Headers): Response {
  if (error instanceof HttpError) {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      },
      error.status,
      corsHeaders,
    );
  }

  return jsonResponse(
    {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "代理内部发生错误",
      },
    },
    500,
    corsHeaders,
  );
}

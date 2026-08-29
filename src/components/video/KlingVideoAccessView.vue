<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { App } from "@capacitor/app";
import type { PluginListenerHandle } from "@capacitor/core";
import { globalSettings } from "../../store/global";
import {
  getSecureValue,
  isNativeMobileApp,
  setSecureValue,
} from "../../services/mobileSecureStorage";
import {
  KLING_MODELS,
  buildKlingPrompt,
  downloadKlingVideo,
  estimateKlingCost,
  getKlingTask as queryKlingTask,
  removeKlingVideoFile,
  resolveKlingVideoUrl,
  shareKlingVideo,
  submitKlingGeneration,
  supportsKlingMode,
  validateKlingInput,
  type KlingAspectRatio,
  type KlingAudio,
  type KlingDuration,
  type KlingElementReference,
  type KlingGenerationInput,
  type KlingMode,
  type KlingModel,
  type KlingMultiShot,
  type KlingResolution,
  type KlingShot,
} from "../../services/klingVideo";
import {
  useKlingVideoHistory,
  type KlingVideoTask,
} from "../../composables/useKlingVideoHistory";

defineEmits<{ (event: "back"): void }>();

const storage = (key: string, fallback: string) =>
  localStorage.getItem(key) || fallback;
const nativeApp = isNativeMobileApp();
const connectionMode = ref<'web' | 'app'>((nativeApp ? storage('app_kling_connection_mode', 'app') : 'web') as 'web' | 'app');
const savedDuration = Number(storage("app_kling_video_duration", "5"));
const durationValues = Array.from(
  { length: 13 },
  (_, index) => index + 3,
) as KlingDuration[];

const config = reactive({
  model: storage("app_kling_video_model", "kling-3.0") as KlingModel,
  aspectRatio: storage(
    "app_kling_video_aspect_ratio",
    "16:9",
  ) as KlingAspectRatio,
  resolution: storage("app_kling_video_resolution", "720p") as KlingResolution,
  duration: (durationValues.includes(savedDuration as KlingDuration)
    ? savedDuration
    : 5) as KlingDuration,
  audio: storage("app_kling_video_audio", "off") as KlingAudio,
  multiShot: storage("app_kling_video_multi_shot", "off") as KlingMultiShot,
  watermark: storage("app_kling_video_watermark", "false") === "true",
});
const apiKey = ref("");
const savedApiKey = ref("");
const prompt = ref(storage("app_kling_video_prompt", ""));
const mode = ref<KlingMode>("text");
const activeTab = ref<"create" | "works">("create");
const showSettings = ref(false);
const showApiKey = ref(false);
const keyReady = ref(false);
const keySaving = ref(false);
const isSubmitting = ref(false);
const pageMessage = ref("");
const pageError = ref("");
const pendingDelete = ref<KlingVideoTask | null>(null);
const firstFrame = ref<File | null>(null);
const lastFrame = ref<File | null>(null);
const firstFrameUrl = ref("");
const lastFrameUrl = ref("");
const referenceImages = ref<File[]>([]);
const referenceUrls = ref<string[]>([]);
const referenceVideoUrl = ref("");
const elements = ref<KlingElementReference[]>([
  { elementId: "", alias: "", kind: "multi_image" },
]);
const shots = ref<KlingShot[]>([
  { id: `shot_${Date.now()}_1`, duration: 2, prompt: "" },
  {
    id: `shot_${Date.now()}_2`,
    duration: Math.max(1, config.duration - 2),
    prompt: "",
  },
]);
const pollingControllers = new Map<string, AbortController>();
let appStateHandle: PluginListenerHandle | null = null;

const {
  tasks,
  loadKlingTasks,
  saveKlingTask,
  patchKlingTask,
  getKlingTask,
  removeKlingTask,
} = useKlingVideoHistory();

watch(
  config,
  (value) => {
    localStorage.setItem("app_kling_video_model", value.model);
    localStorage.setItem("app_kling_video_aspect_ratio", value.aspectRatio);
    localStorage.setItem("app_kling_video_resolution", value.resolution);
    localStorage.setItem("app_kling_video_duration", String(value.duration));
    localStorage.setItem("app_kling_video_audio", value.audio);
    localStorage.setItem("app_kling_video_multi_shot", value.multiShot);
    localStorage.setItem("app_kling_video_watermark", String(value.watermark));
  },
  { deep: true },
);
watch(prompt, (value) => localStorage.setItem("app_kling_video_prompt", value));
watch(connectionMode, async (value) => {
  localStorage.setItem('app_kling_connection_mode', value);
  try {
    apiKey.value = value === 'web' ? localStorage.getItem('app_kling_web_api_key') || '' : nativeApp ? (await getSecureValue('kling_api_key')) || '' : '';
    savedApiKey.value = apiKey.value;
  } catch (error) { pageError.value = error instanceof Error ? error.message : '无法读取 API Key'; }
});

const modeOptions: Array<{
  value: KlingMode;
  label: string;
  description: string;
}> = [
  { value: "text", label: "文字", description: "文字生成视频" },
  { value: "image", label: "图生", description: "从一张图片开始" },
  { value: "interpolation", label: "首尾帧", description: "控制起点与终点" },
  { value: "references", label: "参考", description: "图片与主体一致性" },
  {
    value: "feature_video",
    label: "视频参考",
    description: "参考动作与镜头特征",
  },
  { value: "edit_video", label: "视频编辑", description: "编辑公网视频内容" },
];

const modelInfo = computed(() =>
  KLING_MODELS.find((item) => item.value === config.model)!,
);
const activeTasks = computed(() =>
  tasks.value.filter((task) =>
    ["submitting", "submitted", "processing", "downloading"].includes(
      task.status,
    ),
  ),
);
const shotDurationTotal = computed(() =>
  shots.value.reduce((sum, shot) => sum + Number(shot.duration || 0), 0),
);
const estimatedCost = computed(() =>
  estimateKlingCost({
    model: config.model,
    mode: mode.value,
    audio: config.audio,
    resolution: config.resolution,
    duration: config.duration,
  }),
);
const estimatedCostText = computed(() =>
  estimatedCost.value === null
    ? "当前组合不可用"
    : `预计 ¥${estimatedCost.value.toFixed(2)}`,
);
const canGenerate = computed(
  () =>
    (connectionMode.value === 'web' || nativeApp) &&
    keyReady.value &&
    Boolean(apiKey.value.trim()) &&
    !isSubmitting.value,
);
const apiKeyStored = computed(
  () =>
    Boolean(apiKey.value.trim()) && apiKey.value.trim() === savedApiKey.value,
);
const aspectLocked = computed(() =>
  ["image", "interpolation", "feature_video", "edit_video"].includes(
    mode.value,
  ),
);

const isModeDisabled = (value: KlingMode) =>
  !supportsKlingMode(config.model, value);

const normalizeModeParameters = () => {
  pageMessage.value = "";
  if (!supportsKlingMode(config.model, mode.value)) {
    mode.value = "text";
    pageMessage.value = `${modelInfo.value.label} 不支持刚才的生成方式，已返回文字生成。`;
  }
  if (mode.value === "feature_video") {
    config.audio = "off";
    if (config.multiShot === "off") config.multiShot = "auto";
  } else if (mode.value === "edit_video") {
    config.multiShot = "off";
    if (config.audio === "native") config.audio = "original";
  } else if (config.audio === "original") {
    config.audio = "off";
  }
};

watch(() => config.model, normalizeModeParameters);
watch(mode, normalizeModeParameters);

const chooseMode = (value: KlingMode) => {
  if (isModeDisabled(value)) {
    pageMessage.value = "这项能力需要 Kling 3.0 Omni。";
    return;
  }
  mode.value = value;
};

const chooseMultiShot = (value: KlingMultiShot) => {
  if (mode.value === "feature_video" && value === "off") {
    pageMessage.value = "特征参考视频必须启用多镜头。";
    return;
  }
  if (mode.value === "edit_video" && value !== "off") {
    pageMessage.value = "视频编辑仅支持单镜头。";
    return;
  }
  if (
    value === "custom" &&
    prompt.value.trim() &&
    shots.value.every((shot) => !shot.prompt.trim())
  ) {
    shots.value[0].prompt = prompt.value.trim();
  }
  config.multiShot = value;
};

const chooseAudio = (value: KlingAudio) => {
  if (mode.value === "feature_video" && value !== "off") {
    pageMessage.value = "视频特征参考暂不支持生成声音。";
    return;
  }
  if (value === "original" && mode.value !== "edit_video") {
    pageMessage.value = "只有视频编辑可以保留原声。";
    return;
  }
  if (mode.value === "edit_video" && value === "native") {
    pageMessage.value = "视频编辑不支持重新生成原生声音。";
    return;
  }
  config.audio = value;
};

const saveApiKey = async () => {
  if (connectionMode.value === 'web') { localStorage.setItem('app_kling_web_api_key',apiKey.value.trim()); savedApiKey.value=apiKey.value.trim(); pageMessage.value='网页密钥已保存在当前浏览器。'; return; }
  if (!nativeApp) { pageError.value='App 直连需要在安装后的 App 中使用'; return; }
  keySaving.value = true;
  pageError.value = "";
  try {
    await setSecureValue("kling_api_key", apiKey.value.trim());
    savedApiKey.value = apiKey.value.trim();
    pageMessage.value = apiKey.value.trim()
      ? "API Key 已安全保存到本机。"
      : "本机保存的 API Key 已移除。";
  } catch (error) {
    pageError.value =
      error instanceof Error ? error.message : "API Key 保存失败";
  } finally {
    keySaving.value = false;
  }
};

const replacePreviewUrl = (target: typeof firstFrameUrl, file: File | null) => {
  if (target.value) URL.revokeObjectURL(target.value);
  target.value = file ? URL.createObjectURL(file) : "";
};

const readImageSize = async (file: File) => {
  if ("createImageBitmap" in window) {
    const bitmap = await createImageBitmap(file);
    const result = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return result;
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<{ width: number; height: number }>(
      (resolve, reject) => {
        const image = new Image();
        image.onload = () =>
          resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => reject(new Error("无法读取图片尺寸"));
        image.src = url;
      },
    );
  } finally {
    URL.revokeObjectURL(url);
  }
};

const validateImageFile = async (file?: File) => {
  if (!file) return null;
  if (!["image/jpeg", "image/png"].includes(file.type))
    throw new Error("仅支持 JPG、JPEG 或 PNG 图片");
  if (file.size > 50 * 1024 * 1024) throw new Error("单张图片不能超过 50MB");
  const size = await readImageSize(file);
  if (size.width < 300 || size.height < 300)
    throw new Error("图片宽高都不能小于 300px");
  const ratio = size.width / size.height;
  if (ratio < 0.4 || ratio > 2.5)
    throw new Error("图片宽高比需在 1:2.5 到 2.5:1 之间");
  return file;
};

const selectFrame = async (kind: "first" | "last", event: Event) => {
  pageError.value = "";
  const input = event.target as HTMLInputElement;
  try {
    const file = await validateImageFile(input.files?.[0]);
    if (kind === "first") {
      firstFrame.value = file;
      replacePreviewUrl(firstFrameUrl, file);
    } else {
      lastFrame.value = file;
      replacePreviewUrl(lastFrameUrl, file);
    }
  } catch (error) {
    pageError.value = error instanceof Error ? error.message : "图片读取失败";
  }
  input.value = "";
};

const selectReferences = async (event: Event) => {
  pageError.value = "";
  const input = event.target as HTMLInputElement;
  try {
    const incomingFiles = Array.from(input.files || []);
    if (referenceImages.value.length + incomingFiles.length > 7)
      throw new Error("参考图最多七张");
    const incoming: File[] = [];
    for (const file of incomingFiles) {
      const checked = await validateImageFile(file);
      if (checked) incoming.push(checked);
    }
    referenceImages.value.push(...incoming);
    referenceUrls.value.push(
      ...incoming.map((file) => URL.createObjectURL(file)),
    );
  } catch (error) {
    pageError.value = error instanceof Error ? error.message : "参考图读取失败";
  }
  input.value = "";
};

const clearFrame = (kind: "first" | "last") => {
  if (kind === "first") {
    firstFrame.value = null;
    replacePreviewUrl(firstFrameUrl, null);
  } else {
    lastFrame.value = null;
    replacePreviewUrl(lastFrameUrl, null);
  }
};

const removeReference = (index: number) => {
  URL.revokeObjectURL(referenceUrls.value[index]);
  referenceUrls.value.splice(index, 1);
  referenceImages.value.splice(index, 1);
};

const addElement = () => {
  if (elements.value.length >= 3) return;
  elements.value.push({ elementId: "", alias: "", kind: "multi_image" });
};

const removeElement = (index: number) => {
  if (elements.value.length === 1)
    elements.value[0] = { elementId: "", alias: "", kind: "multi_image" };
  else elements.value.splice(index, 1);
};

const addShot = () => {
  if (shots.value.length >= 6) return;
  shots.value.push({
    id: `shot_${Date.now()}_${shots.value.length}`,
    duration: 1,
    prompt: "",
  });
};

const removeShot = (index: number) => {
  if (shots.value.length > 1) shots.value.splice(index, 1);
};

const taskStatusLabel = (status: KlingVideoTask["status"]) =>
  ({
    submitting: "正在提交",
    submitted: "等待生成",
    processing: "生成中",
    paused: "已暂停查询",
    downloading: "正在保存",
    completed: "已完成",
    failed: "生成失败",
  })[status];
const modeLabel = (value: KlingMode) =>
  modeOptions.find((item) => item.value === value)?.label || value;
const modelLabel = (value: KlingModel) =>
  KLING_MODELS.find((item) => item.value === value)?.shortLabel || value;
const formatTime = (value: number) =>
  new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
const videoUrl = (task: KlingVideoTask) => task.localFileUri
  ? resolveKlingVideoUrl(task.localFileUri)
  : (task.outputs?.find(item => item.type === 'video')?.url || '');
const billingText = (task: KlingVideoTask) => {
  const item = task.billing?.[0];
  if (!item?.amount) return "";
  return `实际扣费 ${item.amount}${item.currency ? ` ${item.currency}` : " 积分"}`;
};

const waitFor = (milliseconds: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, milliseconds);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });

const finishTask = async (
  task: KlingVideoTask,
  remote: Awaited<ReturnType<typeof queryKlingTask>>,
  controller: AbortController,
) => {
  if (!remote) throw new Error("任务已结束，但没有返回结果");
  const output = remote.outputs?.find((item) => item.type === "video");
  const remoteUrl = task.params.watermark
    ? output?.watermark_url || output?.url
    : output?.url;
  if (!remoteUrl) throw new Error("任务已结束，但没有返回视频地址");
  await patchKlingTask(task.id, {
    status: "downloading",
    outputs: remote.outputs,
    billing: remote.billing,
    error: "",
  });
  if (controller.signal.aborted)
    throw new DOMException("Aborted", "AbortError");
  if (connectionMode.value === 'web') {
    await patchKlingTask(task.id, { status:'completed', outputs:remote.outputs, billing:remote.billing, error:'' });
    pageMessage.value='视频已生成，可在作品中播放和下载。';
    return;
  }
  const local = await downloadKlingVideo(task.id, remoteUrl);
  await patchKlingTask(task.id, {
    status: "completed",
    outputs: remote.outputs,
    billing: remote.billing,
    localFilePath: local.path,
    localFileUri: local.uri,
    error: "",
  });
  pageMessage.value = "视频已生成并保存到本机作品。";
};

const pollTask = async (id: string) => {
  if ((connectionMode.value === 'app' && !nativeApp) || pollingControllers.has(id)) return;
  const controller = new AbortController();
  pollingControllers.set(id, controller);
  let transientFailures = 0;
  try {
    let task = await getKlingTask(id);
    if (!task) return;
    if (!apiKey.value.trim()) {
      await patchKlingTask(id, {
        status: "paused",
        error: "填写原 Kling API Key 后可继续查询",
      });
      return;
    }
    while (!controller.signal.aborted) {
      try {
        const remote = await queryKlingTask(
          { apiKey: apiKey.value, connectionMode: connectionMode.value },
          task.remoteTaskId
            ? { taskId: task.remoteTaskId }
            : { externalTaskId: task.externalTaskId },
        );
        if (!remote) {
          transientFailures++;
          if (transientFailures >= 5)
            throw new Error("暂时找不到云端任务，请稍后手动继续查询");
        } else {
          transientFailures = 0;
          if (!task.remoteTaskId)
            await patchKlingTask(id, { remoteTaskId: remote.id });
          if (remote.status === "failed") {
            await patchKlingTask(id, {
              status: "failed",
              outputs: remote.outputs,
              billing: remote.billing,
              error: remote.message || "Kling 视频生成失败",
            });
            return;
          }
          if (remote.status === "succeeded") {
            await finishTask(task, remote, controller);
            return;
          }
          await patchKlingTask(id, { status: remote.status, error: "" });
          task = (await getKlingTask(id)) || task;
        }
        await waitFor(8000, controller.signal);
      } catch (error: any) {
        if (error?.name === "AbortError") throw error;
        transientFailures++;
        if (transientFailures >= 5) throw error;
        await waitFor(
          Math.min(30000, 2000 * 2 ** (transientFailures - 1)),
          controller.signal,
        );
      }
    }
  } catch (error: any) {
    if (error?.name !== "AbortError") {
      const message = error?.message || "任务查询暂时中断";
      const current = await getKlingTask(id);
      if (current && !["completed", "failed"].includes(current.status))
        await patchKlingTask(id, { status: "paused", error: message });
      pageError.value = message;
    }
  } finally {
    pollingControllers.delete(id);
  }
};

const buildInput = (): KlingGenerationInput => {
  if (connectionMode.value === 'app' && !nativeApp) throw new Error("请安装 App 或切换网页直连");
  if (!apiKey.value.trim()) throw new Error("请先填写 Kling API Key");
  const externalTaskId = `nrj_kling_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const input: KlingGenerationInput = {
    prompt: prompt.value,
    model: config.model,
    mode: mode.value,
    aspectRatio: config.aspectRatio,
    resolution: config.resolution,
    duration: config.duration,
    audio: config.audio,
    multiShot: config.multiShot,
    shots: shots.value.map((item) => ({
      ...item,
      duration: Number(item.duration),
    })),
    watermark: config.watermark,
    externalTaskId,
    firstFrame: ["image", "interpolation"].includes(mode.value)
      ? firstFrame.value || undefined
      : undefined,
    lastFrame:
      mode.value === "interpolation" ? lastFrame.value || undefined : undefined,
    referenceImages: mode.value === "references" ? referenceImages.value : [],
    referenceVideoUrl: ["feature_video", "edit_video"].includes(mode.value)
      ? referenceVideoUrl.value
      : "",
    elements:
      config.model === "kling-3.0-omni" &&
      ["text", "image", "interpolation", "references"].includes(mode.value)
        ? elements.value
        : [],
  };
  validateKlingInput(input);
  return input;
};

const generateVideo = async () => {
  if (isSubmitting.value) return;
  pageError.value = "";
  pageMessage.value = "";
  isSubmitting.value = true;
  let localId = "";
  try {
    const input = buildInput();
    localId = `kling_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const inputNames = [
      firstFrame.value?.name,
      lastFrame.value?.name,
      ...referenceImages.value.map((file) => file.name),
    ].filter(Boolean) as string[];
    const task: KlingVideoTask = {
      id: localId,
      externalTaskId: input.externalTaskId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: "submitting",
      params: {
        prompt: buildKlingPrompt(input),
        model: input.model,
        mode: input.mode,
        aspectRatio: input.aspectRatio,
        resolution: input.resolution,
        duration: input.duration,
        audio: input.audio,
        multiShot: input.multiShot,
        shots: input.shots,
        watermark: input.watermark,
        inputNames,
        referenceVideoUrl: input.referenceVideoUrl,
        elementAliases:
          input.elements
            ?.filter((item) => item.elementId.trim() && item.alias.trim())
            .map((item) => item.alias.trim()) || [],
      },
    };
    await saveKlingTask(task);
    const remote = await submitKlingGeneration({ apiKey: apiKey.value, connectionMode: connectionMode.value }, input);
    const submittedStatus =
      remote.status === "submitted"
        ? "submitted"
        : remote.status === "failed"
          ? "failed"
          : "processing";
    await patchKlingTask(localId, {
      remoteTaskId: remote.id,
      status: submittedStatus,
      error:
        remote.status === "failed"
          ? remote.message || "Kling 拒绝了这个生成任务"
          : "",
    });
    if (remote.status === "failed")
      throw new Error(remote.message || "Kling 拒绝了这个生成任务");
    pageMessage.value = "任务已提交，可以离开页面；回来后会自动继续查询。";
    void pollTask(localId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Kling 任务提交失败";
    pageError.value = message;
    if (!apiKey.value.trim()) showSettings.value = true;
    if (localId) {
      const existing = await getKlingTask(localId);
      if (existing && existing.status !== "failed") {
        await patchKlingTask(localId, {
          status: "paused",
          error: `提交结果未确认：${message}`,
        });
      }
    }
  } finally {
    isSubmitting.value = false;
  }
};

const pauseTask = async (task: KlingVideoTask) => {
  pollingControllers.get(task.id)?.abort();
  await patchKlingTask(task.id, { status: "paused", error: "" });
};

const resumeTask = async (task: KlingVideoTask) => {
  pageError.value = "";
  if (!apiKey.value.trim()) {
    showSettings.value = true;
    pageError.value = "请先填写原 Kling API Key";
    return;
  }
  await patchKlingTask(task.id, {
    status: task.remoteTaskId ? "processing" : "submitting",
    error: "",
  });
  void pollTask(task.id);
};

const shareTask = async (task: KlingVideoTask) => {
  pageError.value = "";
  try {
    if (!task.localFileUri) throw new Error("本机没有可分享的视频文件");
    await shareKlingVideo(task.localFileUri);
  } catch (error) {
    pageError.value = error instanceof Error ? error.message : "视频分享失败";
  }
};

const retryDownload = async (task: KlingVideoTask) => {
  pageError.value = "";
  try {
    const output = task.outputs?.find((item) => item.type === "video");
    const url = task.params.watermark
      ? output?.watermark_url || output?.url
      : output?.url;
    if (!url) throw new Error("云端视频地址已经不可用");
    await patchKlingTask(task.id, { status: "downloading", error: "" });
    const local = await downloadKlingVideo(task.id, url);
    await patchKlingTask(task.id, {
      status: "completed",
      localFilePath: local.path,
      localFileUri: local.uri,
      error: "",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "视频保存失败";
    await patchKlingTask(task.id, { status: "paused", error: message });
    pageError.value = message;
  }
};

const confirmDelete = async () => {
  const task = pendingDelete.value;
  if (!task) return;
  pollingControllers.get(task.id)?.abort();
  await removeKlingVideoFile(task.localFilePath);
  await removeKlingTask(task.id);
  pendingDelete.value = null;
};

const recoverTasks = async () => {
  await loadKlingTasks();
  if ((connectionMode.value === 'app' && !nativeApp) || !apiKey.value.trim()) return;
  for (const task of tasks.value.filter((item) =>
    ["submitting", "submitted", "processing", "downloading"].includes(
      item.status,
    ),
  ))
    void pollTask(task.id);
};

onMounted(async () => {
  await loadKlingTasks();
  if (connectionMode.value === 'web') { apiKey.value=localStorage.getItem('app_kling_web_api_key')||''; savedApiKey.value=apiKey.value; }
  if (nativeApp && connectionMode.value === 'app') {
    try {
      apiKey.value = (await getSecureValue("kling_api_key")) || "";
      savedApiKey.value = apiKey.value;
    } catch (error) {
      pageError.value =
        error instanceof Error ? error.message : "无法读取本机 API Key";
    }
    appStateHandle = await App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) void recoverTasks();
    });
  }
  keyReady.value = true;
  showSettings.value = !apiKey.value;
  await recoverTasks();
});

onUnmounted(() => {
  pollingControllers.forEach((controller) => controller.abort());
  pollingControllers.clear();
  void appStateHandle?.remove();
  if (firstFrameUrl.value) URL.revokeObjectURL(firstFrameUrl.value);
  if (lastFrameUrl.value) URL.revokeObjectURL(lastFrameUrl.value);
  referenceUrls.value.forEach((url) => URL.revokeObjectURL(url));
});
</script>

<template>
  <div class="kling-hall" :class="{ dark: globalSettings.darkMode }">
    <header class="hall-header">
      <button
        class="icon-button"
        type="button"
        aria-label="返回视频引擎"
        @click="$emit('back')"
      >
        <svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6" /></svg>
      </button>
      <div class="header-copy">
        <h1>Kling 3.0</h1>
        <p>快手可灵 · 网页与 App 双通道视频生成</p>
      </div>
      <span class="native-badge" :class="{ ready: connectionMode === 'web' || nativeApp }">{{
        connectionMode === 'web' ? "网页直连" : nativeApp ? "App 直连" : "需安装"
      }}</span>
    </header>

    <nav class="hall-tabs" aria-label="Kling 页面">
      <button
        type="button"
        :class="{ active: activeTab === 'create' }"
        @click="activeTab = 'create'"
      >
        创作
      </button>
      <button
        type="button"
        :class="{ active: activeTab === 'works' }"
        @click="activeTab = 'works'"
      >
        作品 <span>{{ tasks.length }}</span>
      </button>
    </nav>

    <main class="hall-scroll">
      <Transition name="message"
        ><p v-if="pageMessage" class="page-message">
          {{ pageMessage }}
        </p></Transition
      >
      <Transition name="message"
        ><p v-if="pageError" class="page-error">{{ pageError }}</p></Transition
      >

      <section v-if="connectionMode === 'app' && !nativeApp" class="install-note">
        <svg viewBox="0 0 24 24">
          <rect x="6" y="2.5" width="12" height="19" rx="2" />
          <path d="M10 18h4" />
        </svg>
        <div>
          <strong>App 直连需要安装应用</strong>
          <p>
            也可以在连接设置中切换为网页直连。
          </p>
        </div>
      </section>

      <template v-if="activeTab === 'create'">
        <section class="settings-panel" :class="{ open: showSettings }">
          <button
            class="section-toggle"
            type="button"
            @click="showSettings = !showSettings"
          >
            <span
              ><small>本机鉴权</small
              ><strong>{{
                apiKeyStored
                  ? "API Key 已保存在系统安全存储"
                  : apiKey
                    ? "API Key 尚未保存到本机"
                    : "填写自己的 Kling API Key"
              }}</strong></span
            >
            <svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg>
          </button>
          <div v-if="showSettings" class="settings-body">
            <div class="mode-tabs"><button type="button" :class="{ active: connectionMode === 'web' }" @click="connectionMode = 'web'">网页直连</button><button type="button" :class="{ active: connectionMode === 'app' }" @click="connectionMode = 'app'">App 直连</button></div>
            <label class="field"
              ><span>API Key</span>
              <div class="input-action">
                <input
                  v-model="apiKey"
                  :type="showApiKey ? 'text' : 'password'"
                  autocomplete="off"
                  :placeholder="connectionMode === 'web' ? '保存在当前浏览器' : '保存在这台设备'"
                /><button
                  type="button"
                  @click="showApiKey = !showApiKey"
                >
                  {{ showApiKey ? "隐藏" : "显示" }}
                </button>
              </div>
              <small
                >Android 使用系统密钥库加密，iOS 使用 Keychain；不会写入网页
                localStorage。</small
              ></label
            >
            <button
              class="save-key"
              type="button"
              :disabled="keySaving || (connectionMode === 'app' && !nativeApp)"
              @click="saveApiKey"
            >
              {{ keySaving ? "保存中…" : "保存到本机" }}
            </button>
          </div>
        </section>

        <section class="create-section">
          <div class="section-heading">
            <div>
              <small>生成引擎</small>
              <h2>{{ modelInfo.label }}</h2>
            </div>
            <span class="cost-pill">{{ estimatedCostText }}</span>
          </div>
          <div class="model-grid">
            <button
              v-for="item in KLING_MODELS"
              :key="item.value"
              type="button"
              :class="{ active: config.model === item.value }"
              @click="config.model = item.value"
            >
              <strong>{{ item.shortLabel }}</strong
              ><small>{{ item.description }}</small>
            </button>
          </div>
        </section>

        <section class="create-section">
          <div class="section-heading">
            <div>
              <small>生成方式</small>
              <h2>
                {{
                  modeOptions.find((item) => item.value === mode)?.description
                }}
              </h2>
            </div>
          </div>
          <div class="mode-tabs">
            <button
              v-for="item in modeOptions"
              :key="item.value"
              type="button"
              :class="{
                active: mode === item.value,
                disabled: isModeDisabled(item.value),
              }"
              @click="chooseMode(item.value)"
            >
              {{ item.label }}
            </button>
          </div>

          <div
            v-if="mode === 'image' || mode === 'interpolation'"
            class="upload-grid"
            :class="{ double: mode === 'interpolation' }"
          >
            <div class="upload-slot" :class="{ filled: firstFrameUrl }">
              <img
                v-if="firstFrameUrl"
                :src="firstFrameUrl"
                alt="首帧预览"
              /><label v-else
                ><svg viewBox="0 0 24 24">
                  <path d="M12 16V4m0 0L7 9m5-5 5 5M5 14v5h14v-5" /></svg
                ><span
                  >添加{{
                    mode === "interpolation" ? "首帧" : "起始图片"
                  }}</span
                ><small>JPG / PNG，最大 50MB</small
                ><input
                  type="file"
                  accept="image/jpeg,image/png"
                  @change="selectFrame('first', $event)" /></label
              ><button
                v-if="firstFrameUrl"
                type="button"
                aria-label="移除首帧"
                @click="clearFrame('first')"
              >
                ×
              </button>
            </div>
            <div
              v-if="mode === 'interpolation'"
              class="upload-slot"
              :class="{ filled: lastFrameUrl }"
            >
              <img
                v-if="lastFrameUrl"
                :src="lastFrameUrl"
                alt="尾帧预览"
              /><label v-else
                ><svg viewBox="0 0 24 24">
                  <path d="M12 16V4m0 0L7 9m5-5 5 5M5 14v5h14v-5" /></svg
                ><span>添加尾帧</span><small>不能单独使用尾帧</small
                ><input
                  type="file"
                  accept="image/jpeg,image/png"
                  @change="selectFrame('last', $event)" /></label
              ><button
                v-if="lastFrameUrl"
                type="button"
                aria-label="移除尾帧"
                @click="clearFrame('last')"
              >
                ×
              </button>
            </div>
          </div>

          <div v-if="mode === 'references'" class="reference-upload">
            <div class="reference-list">
              <div
                v-for="(url, index) in referenceUrls"
                :key="url"
                class="reference-thumb"
              >
                <img :src="url" :alt="`参考图 ${index + 1}`" /><button
                  type="button"
                  :aria-label="`移除参考图 ${index + 1}`"
                  @click="removeReference(index)"
                >
                  ×
                </button>
              </div>
              <label v-if="referenceImages.length < 7" class="reference-add"
                ><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg
                ><span>参考图 {{ referenceImages.length }}/7</span
                ><input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png"
                  @change="selectReferences"
              /></label>
            </div>
            <p>
              图片用于人物、物体或风格一致性；在描述中可用 @image_1 等名称指定。
            </p>
          </div>

          <div
            v-if="mode === 'feature_video' || mode === 'edit_video'"
            class="video-url-panel"
          >
            <label class="field"
              ><span>{{
                mode === "feature_video" ? "特征参考视频 URL" : "待编辑视频 URL"
              }}</span
              ><input
                v-model.trim="referenceVideoUrl"
                inputmode="url"
                placeholder="https://…"
              /><small
                >可灵要求 MP4/MOV
                公网地址；本机视频无法在无上传服务时直接使用。</small
              ></label
            >
          </div>

          <div
            v-if="
              config.model === 'kling-3.0-omni' &&
              ['text', 'image', 'interpolation', 'references'].includes(mode)
            "
            class="element-panel"
          >
            <div class="subheading">
              <span>主体引用</span
              ><button
                type="button"
                :disabled="elements.length >= 3"
                @click="addElement"
              >
                添加主体
              </button>
            </div>
            <div
              v-for="(element, index) in elements"
              :key="index"
              class="element-row"
            >
              <select v-model="element.kind" aria-label="主体类型">
                <option value="multi_image">多图主体</option>
                <option value="video_character">视频角色</option></select
              ><input
                v-model.trim="element.elementId"
                placeholder="主体 ID"
              /><input
                v-model.trim="element.alias"
                placeholder="引用名"
              /><button
                type="button"
                aria-label="移除主体"
                @click="removeElement(index)"
              >
                ×
              </button>
            </div>
            <p>先在可灵主体库创建主体；提示词中使用 @引用名，例如 @girl。</p>
          </div>
        </section>

        <section class="create-section prompt-section">
          <div class="section-heading">
            <div>
              <small>内容描述</small>
              <h2>
                {{ config.multiShot === "custom" ? "逐镜头描述" : "提示词" }}
              </h2>
            </div>
            <span v-if="config.multiShot !== 'custom'" class="counter"
              >{{ prompt.length }}/3072</span
            >
          </div>
          <textarea
            v-if="config.multiShot !== 'custom'"
            v-model="prompt"
            maxlength="3072"
            placeholder="描述画面、人物动作、镜头运动、对白、环境声音与风格…"
          ></textarea>
          <div v-else class="shot-editor">
            <article
              v-for="(shot, index) in shots"
              :key="shot.id"
              class="shot-row"
            >
              <div>
                <strong>镜头 {{ index + 1 }}</strong
                ><label
                  ><input
                    v-model.number="shot.duration"
                    type="number"
                    min="1"
                    :max="config.duration"
                  /><span>秒</span></label
                ><button
                  type="button"
                  :disabled="shots.length === 1"
                  @click="removeShot(index)"
                >
                  移除
                </button>
              </div>
              <textarea
                v-model="shot.prompt"
                maxlength="512"
                :placeholder="`描述镜头 ${index + 1} 的画面与动作`"
              ></textarea>
            </article>
            <div
              class="shot-summary"
              :class="{ invalid: shotDurationTotal !== config.duration }"
            >
              <button
                type="button"
                :disabled="shots.length >= 6"
                @click="addShot"
              >
                添加镜头</button
              ><span
                >合计 {{ shotDurationTotal }} / {{ config.duration }} 秒</span
              >
            </div>
          </div>
          <p>可直接使用中文；对白请明确写出说话角色、语言、口音与语气。</p>
        </section>

        <section class="create-section">
          <div class="section-heading">
            <div>
              <small>生成参数</small>
              <h2>画面、时长与声音</h2>
            </div>
          </div>
          <div class="parameter-grid">
            <label class="field"
              ><span>画幅</span
              ><select v-model="config.aspectRatio" :disabled="aspectLocked">
                <option value="16:9">横屏 16:9</option>
                <option value="9:16">竖屏 9:16</option>
                <option value="1:1">方形 1:1</option></select
              ><small v-if="aspectLocked">由输入素材画幅决定</small></label
            >
            <label class="field"
              ><span>清晰度</span
              ><select v-model="config.resolution">
                <option value="720p">720p</option>
                <option value="1080p">1080p</option>
                <option value="4k">4K</option>
              </select></label
            >
            <label class="field"
              ><span>时长</span
              ><select v-model.number="config.duration">
                <option
                  v-for="value in durationValues"
                  :key="value"
                  :value="value"
                >
                  {{ value }} 秒
                </option>
              </select></label
            >
            <label class="field"
              ><span>水印</span
              ><select v-model="config.watermark">
                <option :value="false">无水印</option>
                <option :value="true">同时生成水印</option>
              </select></label
            >
          </div>
          <div class="option-group">
            <span>镜头</span>
            <div>
              <button
                type="button"
                :class="{ active: config.multiShot === 'off' }"
                @click="chooseMultiShot('off')"
              >
                单镜头</button
              ><button
                type="button"
                :class="{ active: config.multiShot === 'auto' }"
                @click="chooseMultiShot('auto')"
              >
                智能分镜</button
              ><button
                type="button"
                :class="{ active: config.multiShot === 'custom' }"
                @click="chooseMultiShot('custom')"
              >
                自定义
              </button>
            </div>
          </div>
          <div class="option-group">
            <span>声音</span>
            <div>
              <button
                type="button"
                :class="{ active: config.audio === 'off' }"
                @click="chooseAudio('off')"
              >
                无声</button
              ><button
                type="button"
                :class="{ active: config.audio === 'native' }"
                @click="chooseAudio('native')"
              >
                原生音频</button
              ><button
                v-if="mode === 'edit_video'"
                type="button"
                :class="{ active: config.audio === 'original' }"
                @click="chooseAudio('original')"
              >
                保留原声
              </button>
            </div>
          </div>
          <div class="generation-note">
            <span>3–15 秒</span><span>最多 6 个分镜</span
            ><span>结果自动存本机</span>
          </div>
        </section>

        <button
          class="generate-button"
          type="button"
          :disabled="!canGenerate"
          @click="generateVideo"
        >
          <span v-if="isSubmitting" class="spinner"></span
          >{{
            connectionMode === 'app' && !nativeApp
              ? "请安装 App 或切换网页直连"
              : isSubmitting
                ? "正在提交…"
                : !apiKey.trim()
                  ? "请先填写 API Key"
                  : "生成视频"
          }}
        </button>

        <section v-if="activeTasks.length" class="running-section">
          <div class="section-heading">
            <div>
              <small>正在进行</small>
              <h2>{{ activeTasks.length }} 个任务</h2>
            </div>
          </div>
          <div v-for="task in activeTasks" :key="task.id" class="running-card">
            <div class="running-indicator"><span></span></div>
            <div class="task-copy">
              <strong
                >{{ modelLabel(task.params.model) }} ·
                {{ task.params.duration }} 秒</strong
              >
              <p>{{ task.params.prompt }}</p>
              <small>{{ taskStatusLabel(task.status) }}</small>
            </div>
            <button
              v-if="task.status !== 'downloading'"
              type="button"
              @click="pauseTask(task)"
            >
              暂停查询
            </button>
            <button v-else type="button" disabled>保存中</button>
          </div>
        </section>
      </template>

      <template v-else>
        <div v-if="!tasks.length" class="empty-works">
          <svg viewBox="0 0 24 24">
            <path d="m9 8 7 4-7 4V8Z" />
            <rect x="3" y="4" width="18" height="16" rx="3" />
          </svg>
          <h2>还没有 Kling 作品</h2>
          <p>生成完成后会自动下载到本机并出现在这里。</p>
          <button type="button" @click="activeTab = 'create'">开始创作</button>
        </div>
        <div v-else class="works-list">
          <article v-for="task in tasks" :key="task.id" class="work-card">
            <div
              class="work-media"
              :class="
                task.params.aspectRatio === '9:16' ? 'portrait' : 'landscape'
              "
            >
              <video
                v-if="videoUrl(task)"
                :src="videoUrl(task)"
                controls
                playsinline
                preload="metadata"
              ></video>
              <div v-else class="work-placeholder">
                <span
                  v-if="
                    [
                      'submitting',
                      'submitted',
                      'processing',
                      'downloading',
                    ].includes(task.status)
                  "
                  class="spinner dark-spinner"
                ></span
                ><svg v-else viewBox="0 0 24 24">
                  <path d="m9 8 7 4-7 4V8Z" />
                  <rect x="3" y="4" width="18" height="16" rx="3" /></svg
                ><strong>{{ taskStatusLabel(task.status) }}</strong>
              </div>
              <span class="status-badge" :class="task.status">{{
                taskStatusLabel(task.status)
              }}</span>
            </div>
            <div class="work-info">
              <div>
                <strong>{{ task.params.prompt }}</strong>
                <p>
                  {{ modelLabel(task.params.model) }} ·
                  {{ modeLabel(task.params.mode) }} ·
                  {{ task.params.resolution }} · {{ task.params.duration }} 秒 ·
                  {{ formatTime(task.createdAt) }}
                </p>
                <p v-if="billingText(task)">{{ billingText(task) }}</p>
                <p v-if="task.error" class="task-error">{{ task.error }}</p>
              </div>
              <div class="work-actions">
                <a v-if="!task.localFileUri && videoUrl(task)" :href="videoUrl(task)" :download="`${task.id}.mp4`" target="_blank" rel="noopener">下载</a>
                <button
                  v-if="task.localFileUri"
                  type="button"
                  @click="shareTask(task)"
                >
                  分享 / 保存</button
                ><button
                  v-if="
                    task.status === 'paused' &&
                    task.outputs?.some((item) => item.type === 'video')
                  "
                  type="button"
                  @click="retryDownload(task)"
                >
                  重试保存</button
                ><button
                  v-else-if="task.status === 'paused'"
                  type="button"
                  @click="resumeTask(task)"
                >
                  继续查询</button
                ><button
                  class="danger"
                  type="button"
                  @click="pendingDelete = task"
                >
                  删除
                </button>
              </div>
            </div>
          </article>
        </div>
      </template>
    </main>

    <Transition name="sheet"
      ><div
        v-if="pendingDelete"
        class="sheet-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-kling-title"
        @click.self="pendingDelete = null"
      >
        <section class="confirm-sheet">
          <div class="sheet-mark">
            <svg viewBox="0 0 24 24">
              <path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" />
            </svg>
          </div>
          <h2 id="delete-kling-title">删除这条 Kling 记录？</h2>
          <p>
            本机视频文件和任务信息都会移除。已经提交到云端的任务不会被取消。
          </p>
          <div>
            <button type="button" @click="pendingDelete = null">保留</button
            ><button class="danger" type="button" @click="confirmDelete">
              删除
            </button>
          </div>
        </section>
      </div></Transition
    >
  </div>
</template>

<style scoped>
.kling-hall {
  --kh-bg: #f7f7f5;
  --kh-surface: #fff;
  --kh-soft: #f0f0ed;
  --kh-text: #1d1d1f;
  --kh-sub: #777773;
  --kh-muted: #a0a09a;
  --kh-line: rgba(20, 20, 20, 0.08);
  --kh-accent: #171717;
  position: absolute;
  inset: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--kh-bg);
  color: var(--kh-text);
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
  -webkit-tap-highlight-color: transparent;
}
.kling-hall.dark {
  --kh-bg: #19191b;
  --kh-surface: #242426;
  --kh-soft: #2d2d30;
  --kh-text: #f5f5f2;
  --kh-sub: #aaa9a3;
  --kh-muted: #787875;
  --kh-line: rgba(255, 255, 255, 0.09);
  --kh-accent: #f1f1ed;
}
.hall-header {
  display: flex;
  flex: 0 0 auto;
  min-height: 58px;
  align-items: center;
  padding: calc(10px + env(safe-area-inset-top)) 18px 8px;
  box-sizing: border-box;
}
.header-copy {
  min-width: 0;
  flex: 1;
  text-align: center;
}
.header-copy h1 {
  margin: 0;
  font-size: 20px;
  line-height: 1.15;
  font-weight: 680;
  letter-spacing: -0.5px;
}
.header-copy p {
  overflow: hidden;
  margin: 4px 0 0;
  color: var(--kh-sub);
  font-size: 11px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.icon-button {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  place-items: center;
}
.icon-button:active {
  background: var(--kh-soft);
}
.icon-button svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
}
.native-badge {
  width: 34px;
  flex: 0 0 auto;
  padding: 4px 0;
  border-radius: 8px;
  background: var(--kh-soft);
  color: var(--kh-muted);
  font-size: 8px;
  font-weight: 700;
  text-align: center;
}
.native-badge.ready {
  background: #e8f5eb;
  color: #37754a;
}
.dark .native-badge.ready {
  background: #25372a;
  color: #8bc69a;
}
.hall-tabs {
  display: flex;
  flex: 0 0 auto;
  gap: 5px;
  margin: 4px 18px 10px;
  padding: 3px;
  border-radius: 12px;
  background: var(--kh-soft);
}
.hall-tabs button {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 8px 10px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--kh-sub);
  font-size: 13px;
  font-weight: 600;
}
.hall-tabs button.active {
  background: var(--kh-surface);
  color: var(--kh-text);
  box-shadow: 0 2px 9px rgba(0, 0, 0, 0.05);
}
.hall-tabs span {
  min-width: 16px;
  padding: 1px 4px;
  border-radius: 10px;
  background: var(--kh-soft);
  font-size: 9px;
}
.hall-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 18px calc(28px + env(safe-area-inset-bottom));
  box-sizing: border-box;
  overscroll-behavior: contain;
}
.page-message,
.page-error {
  margin: 4px 0 10px;
  padding: 9px 11px;
  border-radius: 11px;
  font-size: 11px;
  line-height: 1.45;
}
.page-message {
  background: #edf6ef;
  color: #397148;
}
.page-error {
  background: #fff0f0;
  color: #b64242;
}
.dark .page-message {
  background: #223429;
  color: #91c89f;
}
.dark .page-error {
  background: #3b2527;
  color: #efaaaa;
}
.install-note {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
  padding: 12px;
  border: 1px solid #ead9b8;
  border-radius: 14px;
  background: #fff9ed;
  color: #7b643a;
}
.dark .install-note {
  border-color: #51462e;
  background: #302c23;
  color: #d8be87;
}
.install-note svg {
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
}
.install-note div {
  min-width: 0;
}
.install-note strong {
  display: block;
  font-size: 11px;
}
.install-note p {
  margin: 4px 0 0;
  font-size: 9px;
  line-height: 1.5;
}
.settings-panel,
.create-section,
.running-section {
  margin-bottom: 12px;
  border: 1px solid var(--kh-line);
  border-radius: 17px;
  background: var(--kh-surface);
}
.section-toggle {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  padding: 13px 14px;
  border: 0;
  border-radius: 17px;
  background: transparent;
  color: inherit;
  text-align: left;
}
.section-toggle span {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}
.section-toggle small,
.section-heading small {
  color: var(--kh-muted);
  font-size: 9px;
  font-weight: 650;
  letter-spacing: 0.8px;
}
.section-toggle strong {
  overflow: hidden;
  font-size: 12px;
  font-weight: 620;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.section-toggle svg {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  transition: transform 0.2s;
}
.settings-panel.open .section-toggle svg {
  transform: rotate(180deg);
}
.settings-body {
  display: grid;
  gap: 11px;
  padding: 13px 14px 15px;
  border-top: 1px solid var(--kh-line);
}
.save-key {
  justify-self: end;
  padding: 8px 12px;
  border: 0;
  border-radius: 10px;
  background: var(--kh-accent);
  color: var(--kh-bg);
  font-size: 10px;
  font-weight: 650;
}
.save-key:disabled {
  opacity: 0.42;
}
.create-section,
.running-section {
  padding: 14px;
}
.section-heading {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 11px;
}
.section-heading > div {
  min-width: 0;
}
.section-heading h2 {
  overflow: hidden;
  margin: 3px 0 0;
  font-size: 14px;
  line-height: 1.3;
  font-weight: 660;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.cost-pill {
  flex: 0 0 auto;
  padding: 5px 8px;
  border-radius: 10px;
  background: var(--kh-soft);
  color: var(--kh-sub);
  font-size: 9px;
  font-weight: 650;
}
.model-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}
.model-grid button {
  min-width: 0;
  padding: 10px 6px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: var(--kh-soft);
  color: inherit;
  text-align: center;
}
.model-grid button.active {
  border-color: var(--kh-text);
  background: var(--kh-surface);
}
.model-grid strong,
.model-grid small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
}
.model-grid strong {
  font-size: 11px;
  white-space: nowrap;
}
.model-grid small {
  margin-top: 4px;
  color: var(--kh-muted);
  font-size: 8px;
  line-height: 1.3;
}
.mode-tabs {
  display: flex;
  gap: 5px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}
.mode-tabs::-webkit-scrollbar {
  display: none;
}
.mode-tabs button {
  flex: 0 0 auto;
  padding: 7px 11px;
  border: 0;
  border-radius: 100px;
  background: var(--kh-soft);
  color: var(--kh-sub);
  font-size: 10px;
  font-weight: 620;
}
.mode-tabs button.active {
  background: var(--kh-accent);
  color: var(--kh-bg);
}
.mode-tabs button.disabled {
  opacity: 0.35;
}
.upload-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  margin-top: 11px;
}
.upload-grid.double {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.upload-slot {
  position: relative;
  display: grid;
  min-width: 0;
  min-height: 126px;
  overflow: hidden;
  border: 1px dashed var(--kh-line);
  border-radius: 13px;
  background: var(--kh-soft);
  place-items: center;
}
.upload-slot.filled {
  border-style: solid;
}
.upload-slot img {
  width: 100%;
  height: 150px;
  object-fit: cover;
}
.upload-slot label,
.reference-add {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  color: var(--kh-sub);
}
.upload-slot input,
.reference-add input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
.upload-slot label svg,
.reference-add svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
}
.upload-slot label span {
  margin-top: 7px;
  font-size: 10px;
  font-weight: 650;
}
.upload-slot label small {
  margin-top: 3px;
  color: var(--kh-muted);
  font-size: 8px;
}
.upload-slot > button,
.reference-thumb > button {
  position: absolute;
  top: 6px;
  right: 6px;
  display: grid;
  width: 23px;
  height: 23px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: rgba(20, 20, 20, 0.72);
  color: #fff;
  font-size: 15px;
  place-items: center;
}
.reference-upload,
.video-url-panel,
.element-panel {
  margin-top: 11px;
}
.reference-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 7px;
}
.reference-thumb,
.reference-add {
  position: relative;
  min-width: 0;
  height: 102px;
  overflow: hidden;
  border-radius: 12px;
  background: var(--kh-soft);
}
.reference-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.reference-add {
  border: 1px dashed var(--kh-line);
}
.reference-add span {
  margin-top: 5px;
  font-size: 9px;
}
.reference-upload > p,
.element-panel > p,
.prompt-section > p {
  margin: 8px 1px 0;
  color: var(--kh-muted);
  font-size: 9px;
  line-height: 1.5;
}
.field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}
.field > span {
  color: var(--kh-sub);
  font-size: 10px;
  font-weight: 600;
}
.field > small {
  color: var(--kh-muted);
  font-size: 9px;
  line-height: 1.4;
}
.input-action {
  display: flex;
  min-width: 0;
  gap: 6px;
}
.input-action input {
  min-width: 0;
  flex: 1;
}
.input-action button {
  flex: 0 0 auto;
  padding: 0 11px;
  border: 0;
  border-radius: 10px;
  background: var(--kh-soft);
  color: inherit;
  font-size: 10px;
}
.subheading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 7px;
  color: var(--kh-sub);
  font-size: 10px;
  font-weight: 650;
}
.subheading button,
.shot-summary button {
  padding: 6px 9px;
  border: 0;
  border-radius: 9px;
  background: var(--kh-soft);
  color: inherit;
  font-size: 9px;
}
.subheading button:disabled,
.shot-summary button:disabled {
  opacity: 0.4;
}
.element-row {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 0.8fr) minmax(0, 1fr) 28px;
  gap: 5px;
  margin-top: 6px;
}
.element-row input,
.element-row select {
  padding-left: 7px;
  padding-right: 7px;
  font-size: 9px;
}
.element-row button {
  border: 0;
  border-radius: 9px;
  background: var(--kh-soft);
  color: var(--kh-sub);
  font-size: 15px;
}
.prompt-section textarea {
  width: 100%;
  min-height: 128px;
  resize: vertical;
  padding: 12px;
  border: 0;
  border-radius: 13px;
  box-sizing: border-box;
  background: var(--kh-soft);
  color: inherit;
  font: inherit;
  font-size: 12px;
  line-height: 1.65;
  outline: none;
}
.counter {
  color: var(--kh-muted);
  font-size: 9px;
}
.shot-editor {
  display: grid;
  gap: 8px;
}
.shot-row {
  padding: 9px;
  border-radius: 12px;
  background: var(--kh-soft);
}
.shot-row > div {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 7px;
}
.shot-row strong {
  min-width: 0;
  flex: 1;
  font-size: 10px;
}
.shot-row label {
  display: flex;
  align-items: center;
  gap: 3px;
  color: var(--kh-muted);
  font-size: 9px;
}
.shot-row label input {
  width: 44px;
  min-height: 27px;
  padding: 4px 5px;
  text-align: center;
}
.shot-row button {
  padding: 5px 7px;
  border: 0;
  border-radius: 8px;
  background: var(--kh-surface);
  color: var(--kh-sub);
  font-size: 8px;
}
.shot-row button:disabled {
  opacity: 0.35;
}
.shot-row textarea {
  min-height: 74px;
  background: var(--kh-surface);
  font-size: 10px;
}
.shot-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--kh-sub);
  font-size: 9px;
}
.shot-summary.invalid span {
  color: #b84a4a;
}
.parameter-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 8px;
}
.option-group {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  margin-top: 11px;
}
.option-group > span {
  width: 32px;
  flex: 0 0 auto;
  color: var(--kh-sub);
  font-size: 9px;
  font-weight: 650;
}
.option-group > div {
  display: flex;
  min-width: 0;
  flex: 1;
  gap: 4px;
}
.option-group button {
  min-width: 0;
  flex: 1;
  padding: 7px 3px;
  border: 0;
  border-radius: 9px;
  background: var(--kh-soft);
  color: var(--kh-sub);
  font-size: 9px;
}
.option-group button.active {
  background: var(--kh-accent);
  color: var(--kh-bg);
}
input,
select {
  width: 100%;
  min-height: 36px;
  padding: 8px 10px;
  border: 0;
  border-radius: 10px;
  box-sizing: border-box;
  appearance: none;
  background: var(--kh-soft);
  color: inherit;
  font: inherit;
  font-size: 11px;
  outline: none;
}
select {
  padding-right: 23px;
  background-image:
    linear-gradient(45deg, transparent 50%, var(--kh-sub) 50%),
    linear-gradient(135deg, var(--kh-sub) 50%, transparent 50%);
  background-position:
    calc(100% - 13px) 15px,
    calc(100% - 9px) 15px;
  background-repeat: no-repeat;
  background-size: 4px 4px;
}
input:focus,
select:focus,
textarea:focus {
  box-shadow: inset 0 0 0 1px var(--kh-text);
}
input:disabled {
  opacity: 0.5;
}
.generation-note {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 11px;
}
.generation-note span {
  padding: 4px 7px;
  border-radius: 8px;
  background: var(--kh-soft);
  color: var(--kh-muted);
  font-size: 8px;
}
.generate-button {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 2px 0 14px;
  padding: 13px 14px;
  border: 0;
  border-radius: 14px;
  background: var(--kh-accent);
  color: var(--kh-bg);
  font-size: 12px;
  font-weight: 680;
}
.generate-button:disabled {
  opacity: 0.45;
}
.spinner {
  width: 13px;
  height: 13px;
  border: 1.8px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.running-card {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 9px;
  padding: 10px 0;
  border-top: 1px solid var(--kh-line);
}
.running-indicator {
  display: grid;
  width: 25px;
  height: 25px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--kh-soft);
  place-items: center;
}
.running-indicator span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #63a878;
  box-shadow: 0 0 0 4px rgba(99, 168, 120, 0.15);
  animation: pulse 1.6s ease-in-out infinite;
}
.task-copy {
  min-width: 0;
  flex: 1;
}
.task-copy strong {
  font-size: 10px;
}
.task-copy p {
  overflow: hidden;
  margin: 3px 0;
  color: var(--kh-sub);
  font-size: 9px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.task-copy small {
  color: var(--kh-muted);
  font-size: 8px;
}
.running-card > button,
.work-actions button {
  flex: 0 0 auto;
  min-height: 28px;
  padding: 0 10px;
  border: 0;
  border-radius: 10px;
  background: var(--kh-soft);
  color: inherit;
  font-size: 9px;
}
.works-list {
  display: grid;
  gap: 11px;
}
.work-card {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--kh-line);
  border-radius: 17px;
  background: var(--kh-surface);
}
.work-media {
  position: relative;
  width: 100%;
  overflow: hidden;
  background: #111;
}
.work-media.landscape {
  aspect-ratio: 16/9;
}
.work-media.portrait {
  max-height: 440px;
  aspect-ratio: 9/16;
}
.work-media video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #111;
}
.work-placeholder {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 7px;
  color: #aaa;
}
.work-placeholder svg {
  width: 25px;
  height: 25px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
}
.work-placeholder strong {
  font-size: 10px;
}
.dark-spinner {
  color: #bbb;
}
.status-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  padding: 4px 7px;
  border-radius: 8px;
  background: rgba(20, 20, 20, 0.66);
  color: #fff;
  font-size: 8px;
}
.status-badge.completed {
  background: rgba(45, 112, 67, 0.78);
}
.status-badge.failed {
  background: rgba(159, 54, 54, 0.78);
}
.work-info {
  padding: 11px 12px;
}
.work-info strong {
  display: block;
  overflow: hidden;
  font-size: 11px;
  line-height: 1.4;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.work-info p {
  margin: 4px 0 0;
  color: var(--kh-muted);
  font-size: 8px;
  line-height: 1.4;
}
.work-info .task-error {
  color: #b84a4a;
  font-size: 9px;
}
.work-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 9px;
}
.work-actions .danger {
  margin-left: auto;
  background: #fff0f0;
  color: #b74343;
}
.dark .work-actions .danger {
  background: #3b2527;
  color: #efaaaa;
}
.empty-works {
  display: flex;
  min-height: 58vh;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  text-align: center;
}
.empty-works svg {
  width: 42px;
  height: 42px;
  fill: none;
  stroke: var(--kh-muted);
  stroke-width: 1.2;
}
.empty-works h2 {
  margin: 14px 0 5px;
  font-size: 15px;
}
.empty-works p {
  max-width: 260px;
  margin: 0;
  color: var(--kh-sub);
  font-size: 10px;
  line-height: 1.6;
}
.empty-works button {
  margin-top: 14px;
  padding: 9px 15px;
  border: 0;
  border-radius: 11px;
  background: var(--kh-accent);
  color: var(--kh-bg);
  font-size: 10px;
  font-weight: 650;
}
.sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 12px;
  box-sizing: border-box;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(5px);
}
.confirm-sheet {
  width: min(100%, 430px);
  padding: 21px 18px calc(18px + env(safe-area-inset-bottom));
  border-radius: 24px;
  background: var(--kh-surface);
  box-sizing: border-box;
  text-align: center;
}
.sheet-mark {
  display: grid;
  width: 38px;
  height: 38px;
  margin: 0 auto 11px;
  border-radius: 50%;
  background: #fff0f0;
  color: #b74343;
  place-items: center;
}
.sheet-mark svg {
  width: 19px;
  height: 19px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
}
.confirm-sheet h2 {
  margin: 0;
  font-size: 15px;
}
.confirm-sheet p {
  margin: 8px auto 17px;
  color: var(--kh-sub);
  font-size: 10px;
  line-height: 1.55;
}
.confirm-sheet > div:last-child {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.confirm-sheet button {
  padding: 11px;
  border: 0;
  border-radius: 12px;
  background: var(--kh-soft);
  color: inherit;
  font-size: 11px;
  font-weight: 650;
}
.confirm-sheet button.danger {
  background: #c84b4b;
  color: #fff;
}
@media (max-width: 340px) {
  .hall-scroll {
    padding-left: 12px;
    padding-right: 12px;
  }
  .hall-tabs {
    margin-left: 12px;
    margin-right: 12px;
  }
  .header-copy h1 {
    font-size: 18px;
  }
  .mode-tabs button {
    padding-left: 9px;
    padding-right: 9px;
  }
  .element-row {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 26px;
  }
  .element-row > select {
    grid-column: 1;
    grid-row: 1;
  }
  .element-row > input:first-of-type {
    grid-column: 2;
    grid-row: 1;
  }
  .element-row > input:nth-of-type(2) {
    grid-column: 1 / 4;
    grid-row: 2;
  }
  .element-row > button {
    grid-column: 3;
    grid-row: 1;
  }
  .option-group button {
    font-size: 8px;
  }
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes pulse {
  50% {
    opacity: 0.45;
    transform: scale(0.8);
  }
}
.message-enter-active,
.message-leave-active {
  transition:
    opacity 0.2s,
    transform 0.2s;
}
.message-enter-from,
.message-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.22s;
}
.sheet-enter-active .confirm-sheet,
.sheet-leave-active .confirm-sheet {
  transition: transform 0.25s;
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
.sheet-enter-from .confirm-sheet,
.sheet-leave-to .confirm-sheet {
  transform: translateY(25px);
}
</style>

export async function registerServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;
  try {
    const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}service-worker.js`, {
      scope: import.meta.env.BASE_URL,
    });
    registration.update().catch(() => undefined);
  } catch (error) {
    console.warn("离线缓存注册失败：", error);
  }
}


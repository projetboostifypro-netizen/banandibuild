import JSZip from "jszip";

type CapacitorAPI = {
  isNativePlatform?: () => boolean;
};

function getCapacitor(): CapacitorAPI | null {
  const w = globalThis as unknown as { Capacitor?: CapacitorAPI };
  return w.Capacitor ?? null;
}

function isNative(): boolean {
  return getCapacitor()?.isNativePlatform?.() ?? false;
}

function base64FromString(s: string): string {
  if (typeof btoa === "function") {
    return btoa(unescape(encodeURIComponent(s)));
  }
  return s;
}

function base64FromBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function saveNative(filename: string, dataBase64: string) {
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const res = await Filesystem.writeFile({
    path: filename,
    data: dataBase64,
    directory: Directory.Documents,
    recursive: true,
  });
  return res.uri;
}

function downloadBrowser(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function saveTextToDevice(filename: string, content: string): Promise<string> {
  if (isNative()) {
    const uri = await saveNative(filename, base64FromString(content));
    return `Saved to device: ${uri}`;
  }
  downloadBrowser(filename, new Blob([content], { type: "text/plain" }));
  return `Downloaded ${filename}`;
}

export async function saveZipToDevice(
  filename: string,
  files: { path: string; content: string }[],
): Promise<string> {
  const zip = new JSZip();
  for (const f of files) zip.file(f.path, f.content);
  const blob = await zip.generateAsync({ type: "blob" });
  if (isNative()) {
    const b64 = await base64FromBlob(blob);
    const uri = await saveNative(filename, b64);
    return `Project saved to device: ${uri}`;
  }
  downloadBrowser(filename, blob);
  return `Downloaded ${filename}`;
}

export function isNativeDevice() {
  return isNative();
}
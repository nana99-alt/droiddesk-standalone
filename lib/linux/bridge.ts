import { Platform } from "react-native";
import { requireNativeModule } from "expo-modules-core";

type Phase =
  | "idle"
  | "download"
  | "verify"
  | "extract"
  | "proot"
  | "packages"
  | "starting"
  | "running"
  | "installed"
  | "error";

export type LinuxProgress = {
  phase: Phase;
  progress: number;
  message: string;
  error: string;
};

export type LinuxState = {
  supported: boolean;
  installed: boolean;
  running: boolean;
  busy: boolean;
  phase: Phase;
  progress: number;
  message: string;
  error: string;
  availableBytes: number;
  viewerUrl: string;
  rootfsVersion: string;
};

export type DeviceRequirements = {
  supported: boolean;
  architecture: string;
  availableBytes: number;
  requiredBytes: number;
  enoughStorage: boolean;
  memoryMb: number;
  minimumAndroidApi: number;
  androidApi: number;
};

type NativeListener = { remove: () => void };

type DroidDeskNative = {
  checkRequirements: () => Promise<DeviceRequirements>;
  getState: () => Promise<LinuxState>;
  installUbuntu: () => Promise<LinuxState>;
  startDesktop: () => Promise<LinuxState>;
  stopDesktop: () => Promise<LinuxState>;
  deleteLinux: () => Promise<LinuxState>;
  addListener: (eventName: "onProgress" | "onState", listener: (payload: LinuxProgress | LinuxState) => void) => NativeListener;
};

let nativeModule: DroidDeskNative | null = null;
if (Platform.OS === "android") {
  try {
    nativeModule = requireNativeModule<DroidDeskNative>("DroidDeskLinux");
  } catch {
    nativeModule = null;
  }
}

export const linuxNative = nativeModule;

export function subscribeLinuxProgress(listener: (event: LinuxProgress) => void): NativeListener | null {
  if (!linuxNative) return null;
  return linuxNative.addListener("onProgress", listener as (payload: LinuxProgress | LinuxState) => void);
}

export function subscribeLinuxState(listener: (event: LinuxState) => void): NativeListener | null {
  if (!linuxNative) return null;
  return linuxNative.addListener("onState", listener as (payload: LinuxProgress | LinuxState) => void);
}

export function formatStorage(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const gb = bytes / (1024 * 1024 * 1024);
  return gb < 1 ? `${Math.ceil(bytes / (1024 * 1024))} MB` : `${gb.toFixed(1)} GB`;
}

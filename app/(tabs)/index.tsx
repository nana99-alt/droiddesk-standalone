import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { ScreenContainer } from "@/components/screen-container";
import {
  formatStorage,
  linuxNative,
  subscribeLinuxProgress,
  subscribeLinuxState,
  type DeviceRequirements,
  type LinuxProgress,
  type LinuxState,
} from "@/lib/linux/bridge";

const C = {
  bg: "#0D1110",
  panel: "#151C19",
  panelSoft: "#1B2420",
  border: "#29352F",
  text: "#F0F5F1",
  muted: "#9AABA0",
  faint: "#6B7A70",
  lime: "#C6F36A",
  limeDark: "#253618",
  amber: "#F4BE65",
  red: "#FF756B",
};

const emptyState: LinuxState = {
  supported: false,
  installed: false,
  running: false,
  busy: false,
  phase: "idle",
  progress: 0,
  message: "Belum diperiksa",
  error: "",
  availableBytes: 0,
  viewerUrl: "",
  rootfsVersion: "",
};

export default function HomeScreen() {
  const router = useRouter();
  const [state, setState] = useState<LinuxState>(emptyState);
  const [requirements, setRequirements] = useState<DeviceRequirements | null>(null);
  const [error, setError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    if (!state.busy && !actionBusy) return;
    const tag = "droiddesk-linux-setup";
    void activateKeepAwakeAsync(tag).catch(() => undefined);
    return () => { void deactivateKeepAwake(tag).catch(() => undefined); };
  }, [actionBusy, state.busy]);

  const refresh = useCallback(async () => {
    if (!linuxNative) return;
    try {
      const [nextState, nextRequirements] = await Promise.all([
        linuxNative.getState(),
        linuxNative.checkRequirements(),
      ]);
      setState(nextState);
      setRequirements(nextRequirements);
      if (nextState.error) setError(nextState.error);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Tidak dapat membaca status Linux.");
    }
  }, []);

  useEffect(() => {
    if (!linuxNative) return;
    const initialRefresh = setTimeout(() => void refresh(), 0);
    const progressSubscription = subscribeLinuxProgress((event: LinuxProgress) => {
      setState((previous) => ({
        ...previous,
        phase: event.phase,
        progress: event.progress,
        message: event.message,
        error: event.error,
      }));
      if (event.error) setError(event.error);
    });
    const stateSubscription = subscribeLinuxState((event: LinuxState) => setState(event));
    const timer = setInterval(() => void refresh(), 1500);
    return () => {
      progressSubscription?.remove();
      stateSubscription?.remove();
      clearTimeout(initialRefresh);
      clearInterval(timer);
    };
  }, [refresh]);

  const runAction = useCallback(async (action: "install" | "start" | "stop" | "delete") => {
    if (!linuxNative) {
      setError("Fitur Linux native hanya tersedia pada APK Android hasil build.");
      return;
    }
    setActionBusy(true);
    setError("");
    try {
      if (action === "install") await linuxNative.installUbuntu();
      if (action === "start") {
        const next = await linuxNative.startDesktop();
        setState(next);
        if (next.viewerUrl) router.push("/desktop");
      }
      if (action === "stop") await linuxNative.stopDesktop();
      if (action === "delete") await linuxNative.deleteLinux();
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operasi Linux gagal.");
      await refresh();
    } finally {
      setActionBusy(false);
    }
  }, [refresh, router]);

  const phaseLabel = useMemo(() => {
    if (state.running) return "DESKTOP AKTIF";
    if (state.busy || actionBusy) return "SEDANG MENYIAPKAN";
    if (state.installed) return "UBUNTU SIAP";
    return "BELUM DIPASANG";
  }, [actionBusy, state.busy, state.installed, state.running]);

  const stateColor = state.running ? C.lime : state.busy || actionBusy ? C.amber : C.muted;
  const storageOkay = requirements?.enoughStorage ?? false;
  const canSetup = Boolean(linuxNative && requirements?.supported && storageOkay && !state.busy && !actionBusy);
  const setupLabel = !linuxNative
    ? "Buka lewat APK Android"
    : !requirements?.supported
      ? "Perangkat belum didukung"
      : !storageOkay
        ? "Ruang kosong kurang"
        : state.installed
          ? "Ubuntu sudah dipasang"
          : "Siapkan Ubuntu + XFCE";

  const confirmDelete = () => {
    Alert.alert("Hapus data Linux?", "Ubuntu dan semua aplikasi yang dipasang di dalamnya akan dihapus dari penyimpanan DroidDesk.", [
      { text: "Batal", style: "cancel" },
      { text: "Hapus", style: "destructive", onPress: () => void runAction("delete") },
    ]);
  };

  return (
    <ScreenContainer safeAreaClassName="bg-transparent" containerClassName="bg-[#0D1110]">
      <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <View style={s.brandMark}><View style={s.brandScreen}><View style={s.brandCursor} /></View></View>
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>LINUX WORKSPACE / ANDROID</Text>
            <Text style={s.brand}>DroidDesk</Text>
          </View>
          <View style={s.versionPill}><Text style={s.versionText}>0.1</Text></View>
        </View>

        <View style={s.hero}>
          <View style={s.heroTop}>
            <View style={[s.statusDot, { backgroundColor: stateColor }]} />
            <Text style={[s.statusText, { color: stateColor }]}>{phaseLabel}</Text>
            <Text style={s.heroCode}>ARM64</Text>
          </View>
          <Text style={s.heroTitle}>Ubuntu di{"\n"}saku Anda.</Text>
          <Text style={s.heroCopy}>Desktop XFCE berjalan di ruang privat aplikasi Android. Tanpa Termux, tanpa akses root.</Text>
          <View style={s.systemStrip}>
            <View style={s.systemItem}><Text style={s.systemLabel}>SISTEM</Text><Text style={s.systemValue}>Ubuntu 24.04 LTS</Text></View>
            <View style={s.systemDivider} />
            <View style={s.systemItem}><Text style={s.systemLabel}>DESKTOP</Text><Text style={s.systemValue}>XFCE + VNC</Text></View>
          </View>
        </View>

        <View style={s.sectionHead}>
          <Text style={s.sectionTitle}>Kondisi perangkat</Text>
          <Text style={s.sectionCode}>01 / CHECK</Text>
        </View>
        <View style={s.requirementsCard}>
          <RequirementRow label="Arsitektur" value={requirements?.architecture ?? (linuxNative ? "Memeriksa…" : "Perlu APK Android")} ok={requirements?.supported ?? false} />
          <View style={s.rowRule} />
          <RequirementRow label="Ruang kosong" value={requirements ? `${formatStorage(requirements.availableBytes)} tersedia` : "Memeriksa…"} ok={storageOkay} warning={!storageOkay && Boolean(requirements)} />
          <View style={s.rowRule} />
          <RequirementRow label="Disarankan" value="5–8 GB + internet" ok={false} neutral />
          <View style={s.noteBox}>
            <Text style={s.noteGlyph}>i</Text>
            <Text style={s.noteText}>Ubuntu Base diunduh dari server resmi dan diperiksa dengan SHA-256. XFCE/VNC dipasang setelahnya; setup awal memakai banyak data dan perlu waktu.</Text>
          </View>
        </View>

        <View style={s.sectionHead}>
          <Text style={s.sectionTitle}>Sesi Linux</Text>
          <Text style={s.sectionCode}>02 / SESSION</Text>
        </View>
        <View style={s.sessionCard}>
          <View style={s.sessionHeader}>
            <View style={s.sessionGlyph}><Text style={s.sessionGlyphText}>{state.running ? "●" : state.installed ? "✓" : ">_"}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.sessionName}>Ubuntu XFCE</Text>
              <Text style={s.sessionState}>{state.message || "Menunggu pemeriksaan perangkat"}</Text>
            </View>
            {(state.busy || actionBusy) && <ActivityIndicator color={C.lime} />}
          </View>
          {(state.busy || actionBusy) && (
            <View style={s.progressBlock}>
              <View style={s.progressTrack}><View style={[s.progressFill, { width: `${Math.max(8, state.progress * 100)}%` }]} /></View>
              <Text style={s.progressCaption}>{state.phase === "packages" ? "Pemasangan paket berjalan; tetap buka aplikasi." : `${Math.round(state.progress * 100)}% · ${state.phase}`}</Text>
            </View>
          )}
          {state.running ? (
            <View style={s.actionsRow}>
              <ActionButton title="Buka desktop" tone="primary" onPress={() => router.push("/desktop")} />
              <ActionButton title="Hentikan" tone="secondary" onPress={() => void runAction("stop")} />
            </View>
          ) : state.installed ? (
            <View style={s.actionsRow}>
              <ActionButton title="Mulai desktop" tone="primary" onPress={() => void runAction("start")} disabled={actionBusy || state.busy} />
              <ActionButton title="Hapus Linux" tone="secondary" onPress={confirmDelete} disabled={actionBusy || state.busy} />
            </View>
          ) : (
            <ActionButton title={setupLabel} tone="primary" onPress={() => void runAction("install")} disabled={!canSetup} />
          )}
          {error ? <View style={s.errorBox}><Text style={s.errorTitle}>Perlu tindakan</Text><Text style={s.errorText}>{error}</Text></View> : null}
        </View>

        <View style={s.footer}><Text style={s.footerLine}>DroidDesk memakai PRoot rootless.</Text><Text style={s.footerCopy}>Ini bukan VM atau kernel Linux tersendiri. Fitur yang memerlukan akses root/kernel tidak dijanjikan; performa bergantung pada perangkat.</Text></View>
      </ScrollView>
    </ScreenContainer>
  );
}

function RequirementRow({ label, value, ok, warning, neutral }: { label: string; value: string; ok: boolean; warning?: boolean; neutral?: boolean }) {
  const color = neutral ? C.muted : warning ? C.amber : ok ? C.lime : C.faint;
  return <View style={s.requirementRow}><Text style={s.requirementLabel}>{label}</Text><View style={s.requirementValueWrap}><View style={[s.smallDot, { backgroundColor: color }]} /><Text style={[s.requirementValue, { color }]}>{value}</Text></View></View>;
}

function ActionButton({ title, onPress, tone, disabled }: { title: string; onPress: () => void; tone: "primary" | "secondary"; disabled?: boolean }) {
  const primary = tone === "primary";
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [s.button, primary ? s.primaryButton : s.secondaryButton, disabled && s.buttonDisabled, pressed && !disabled && s.buttonPressed]}>
      <Text style={[s.buttonText, primary ? s.primaryText : s.secondaryText]}>{title}</Text>
      {primary && <Text style={s.buttonArrow}>↗</Text>}
    </Pressable>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 38, gap: 18, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 2 },
  brandMark: { width: 42, height: 42, borderRadius: 13, backgroundColor: C.lime, alignItems: "center", justifyContent: "center" },
  brandScreen: { width: 23, height: 17, borderWidth: 2, borderColor: C.bg, borderRadius: 3, alignItems: "flex-start", justifyContent: "flex-start", padding: 3 },
  brandCursor: { width: 6, height: 2, backgroundColor: C.bg, marginTop: 2 },
  eyebrow: { color: C.muted, fontSize: 9, letterSpacing: 1.55, fontWeight: "800" },
  brand: { color: C.text, fontSize: 20, fontWeight: "800", letterSpacing: -0.5, marginTop: 2 },
  versionPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: C.border },
  versionText: { color: C.faint, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  hero: { backgroundColor: C.panel, borderColor: C.border, borderWidth: 1, borderRadius: 24, padding: 22, overflow: "hidden" },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 10, fontWeight: "800", letterSpacing: 1.15 },
  heroCode: { marginLeft: "auto", color: C.faint, fontFamily: "monospace", fontSize: 10, letterSpacing: 1 },
  heroTitle: { color: C.text, fontSize: 37, lineHeight: 41, letterSpacing: -1.7, fontWeight: "800", marginTop: 24 },
  heroCopy: { color: C.muted, fontSize: 13, lineHeight: 20, marginTop: 12, maxWidth: 320 },
  systemStrip: { flexDirection: "row", alignItems: "center", borderTopColor: C.border, borderTopWidth: 1, marginTop: 24, paddingTop: 15 },
  systemItem: { flex: 1, gap: 5 },
  systemLabel: { color: C.faint, fontSize: 9, fontWeight: "800", letterSpacing: 1.3 },
  systemValue: { color: C.text, fontSize: 12, fontWeight: "700" },
  systemDivider: { height: 28, width: 1, backgroundColor: C.border, marginHorizontal: 16 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 3 },
  sectionTitle: { color: C.text, fontSize: 16, fontWeight: "800", letterSpacing: -0.25 },
  sectionCode: { color: C.faint, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  requirementsCard: { backgroundColor: C.panel, borderColor: C.border, borderWidth: 1, borderRadius: 19, padding: 16 },
  requirementRow: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  requirementLabel: { color: C.muted, fontSize: 12, fontWeight: "600" },
  requirementValueWrap: { flexDirection: "row", alignItems: "center", gap: 7 },
  smallDot: { width: 6, height: 6, borderRadius: 3 },
  requirementValue: { fontSize: 11, fontWeight: "700" },
  rowRule: { height: 1, backgroundColor: C.border },
  noteBox: { flexDirection: "row", gap: 10, backgroundColor: C.panelSoft, borderRadius: 12, padding: 12, marginTop: 12 },
  noteGlyph: { color: C.lime, fontWeight: "900", fontSize: 12 },
  noteText: { flex: 1, color: C.muted, fontSize: 11, lineHeight: 17 },
  sessionCard: { backgroundColor: C.panel, borderColor: C.border, borderWidth: 1, borderRadius: 19, padding: 16 },
  sessionHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  sessionGlyph: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.limeDark, alignItems: "center", justifyContent: "center" },
  sessionGlyphText: { color: C.lime, fontSize: 12, fontWeight: "900", fontFamily: "monospace" },
  sessionName: { color: C.text, fontSize: 14, fontWeight: "800" },
  sessionState: { color: C.muted, fontSize: 11, marginTop: 4, lineHeight: 16 },
  progressBlock: { marginTop: 15 },
  progressTrack: { height: 5, borderRadius: 4, backgroundColor: C.panelSoft, overflow: "hidden" },
  progressFill: { height: 5, borderRadius: 4, backgroundColor: C.lime },
  progressCaption: { color: C.faint, fontSize: 10, marginTop: 7 },
  actionsRow: { flexDirection: "row", gap: 9, marginTop: 16 },
  button: { minHeight: 48, borderRadius: 14, paddingHorizontal: 15, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, alignSelf: "stretch" },
  primaryButton: { backgroundColor: C.lime, flex: 1 },
  secondaryButton: { backgroundColor: C.panelSoft, borderColor: C.border, borderWidth: 1 },
  buttonDisabled: { opacity: 0.48 },
  buttonPressed: { transform: [{ scale: 0.985 }], opacity: 0.88 },
  buttonText: { fontSize: 12, fontWeight: "800" },
  primaryText: { color: C.bg },
  secondaryText: { color: C.text },
  buttonArrow: { color: C.bg, fontSize: 14, fontWeight: "900" },
  errorBox: { marginTop: 12, borderWidth: 1, borderColor: "#5B312D", backgroundColor: "#271716", borderRadius: 12, padding: 12 },
  errorTitle: { color: C.red, fontSize: 11, fontWeight: "800", marginBottom: 5 },
  errorText: { color: "#E8B6B1", fontSize: 11, lineHeight: 17 },
  footer: { borderTopColor: C.border, borderTopWidth: 1, paddingTop: 14, gap: 6 },
  footerLine: { color: C.muted, fontSize: 11, fontWeight: "700" },
  footerCopy: { color: C.faint, fontSize: 10, lineHeight: 15 },
});

import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { WebView } from "react-native-webview";
import { linuxNative } from "@/lib/linux/bridge";

const localPort = (value: string) => /^http:\/\/127\.0\.0\.1:(\d{1,5})\//.exec(value)?.[1] ?? "";
const allowed = (value: string) => {
  const match = /^http:\/\/127\.0\.0\.1:(\d{1,5})\/vnc\.html(?:\?[^\s]*)?$/.exec(value);
  const port = Number(match?.[1]);
  return Boolean(match && port >= 1024 && port <= 65535);
};

export default function DesktopScreen() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(Boolean(linuxNative));

  useEffect(() => {
    if (!linuxNative) return;
    linuxNative.getState().then((state) => {
      if (state.running && allowed(state.viewerUrl)) setUrl(state.viewerUrl);
      else setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false, orientation: "all" }} />
      <StatusBar hidden />
      {url ? (
        <WebView
          source={{ uri: url }}
          style={styles.webview}
          originWhitelist={["http://127.0.0.1:*"]}
          javaScriptEnabled
          domStorageEnabled
          onLoadEnd={() => setLoading(false)}
          onError={() => setLoading(false)}
          onShouldStartLoadWithRequest={(request) => allowed(request.url) && localPort(request.url) === localPort(url)}
          renderLoading={() => <ActivityIndicator size="large" color="#C6F36A" />}
          startInLoadingState
        />
      ) : (
        <View style={styles.empty}>
          <Text style={styles.kicker}>DROIDDESK / VIEWER</Text>
          <Text style={styles.title}>{loading ? "Menyambungkan desktop…" : "Sesi desktop tidak aktif"}</Text>
          <Text style={styles.copy}>Kembali ke layar utama untuk memulai atau memeriksa status desktop.</Text>
          <Pressable style={styles.button} onPress={() => router.back()}><Text style={styles.buttonText}>Kembali</Text></Pressable>
        </View>
      )}
      {url && loading ? <View pointerEvents="none" style={styles.loading}><ActivityIndicator color="#C6F36A" /><Text style={styles.loadingText}>Membuka desktop XFCE…</Text></View> : null}
      <Pressable accessibilityLabel="Kembali ke DroidDesk" style={styles.back} onPress={() => router.back()}><Text style={styles.backText}>‹</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0D1110" },
  webview: { flex: 1, backgroundColor: "#0D1110" },
  loading: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", backgroundColor: "#0D1110" },
  loadingText: { color: "#C8D4CB", fontSize: 12, marginTop: 12 },
  back: { position: "absolute", left: 12, top: 20, width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(13,17,16,0.82)", alignItems: "center", justifyContent: "center" },
  backText: { color: "#F0F5F1", fontSize: 30, lineHeight: 34 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  kicker: { color: "#C6F36A", fontSize: 10, fontWeight: "800", letterSpacing: 1.4 },
  title: { color: "#F0F5F1", fontSize: 23, fontWeight: "800", marginTop: 14, textAlign: "center" },
  copy: { color: "#9AABA0", fontSize: 13, lineHeight: 20, textAlign: "center", marginTop: 8 },
  button: { marginTop: 22, backgroundColor: "#C6F36A", borderRadius: 14, paddingHorizontal: 18, paddingVertical: 13 },
  buttonText: { color: "#0D1110", fontSize: 12, fontWeight: "800" },
});

package com.droiddesk.linux

import android.app.ActivityManager
import android.content.Context
import android.os.Build
import android.os.StatFs
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.ServerSocket
import java.net.Socket
import java.net.URL
import java.net.URLEncoder
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.concurrent.TimeUnit
import java.util.zip.GZIPInputStream
import java.util.zip.ZipInputStream
import org.apache.commons.compress.archivers.tar.TarArchiveEntry
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream

class DroidDeskLinuxModule : Module() {
  companion object {
    private const val ROOTFS_URL = "https://cdimage.ubuntu.com/ubuntu-base/releases/noble/release/ubuntu-base-24.04.5-base-arm64.tar.gz"
    private const val ROOTFS_SHA256 = "a91d5a93010193712d346d761372b7c9db6dfcf093893161c64ca107f05914f2"
    private const val PROOT_SHA256 = "d621d71fb68bf07accbada37ffc4208cf4a963eed70916ee68f848cbd9555cc3"
    private const val REQUIRED_SPACE = 5L * 1024L * 1024L * 1024L
    private const val MAX_ROOTFS_DOWNLOAD_BYTES = 512L * 1024L * 1024L
    private const val ROOTFS_VERSION = "ubuntu-24.04.5-arm64"
  }

  private var busy = false
  private var phase = "idle"
  private var progress = 0.0
  private var message = "Belum disiapkan"
  private var lastError: String? = null
  private var vncProcess: Process? = null
  private var websockifyProcess: Process? = null
  private var viewerUrl: String? = null
  private var currentVncPassword: String? = null
  private var vncPort = 0
  private var webPort = 0
  private val logBuffer = StringBuilder()
  private val lock = Any()

  override fun definition() = ModuleDefinition {
    Name("DroidDeskLinux")
    Events("onProgress", "onState")

    AsyncFunction("checkRequirements") {
      requirements()
    }

    AsyncFunction("getState") {
      state()
    }

    AsyncFunction("installUbuntu") {
      runOperation("installing") {
        installUbuntu()
      }
      state()
    }

    AsyncFunction("startDesktop") {
      startDesktop()
    }

    AsyncFunction("stopDesktop") {
      stopDesktop()
      state()
    }

    AsyncFunction("deleteLinux") {
      stopDesktop()
      val dataRoot = dataRoot()
      if (dataRoot.exists() && !dataRoot.deleteRecursively()) {
        throw IllegalStateException("Tidak dapat menghapus data Linux. Tutup aplikasi lalu coba lagi.")
      }
      emit("idle", 0.0, "Data Linux dihapus")
      state()
    }
  }

  private fun appContext(): Context = requireNotNull(this.appContext.reactContext) {
    "Konteks Android belum tersedia."
  }

  private fun dataRoot() = File(appContext().filesDir, "droiddesk-linux")
  private fun rootfs() = File(dataRoot(), "rootfs")
  private fun prootDir() = File(appContext().filesDir, "droiddesk-native")
  private fun prootBin() = File(prootDir(), "proot")
  private fun loader() = File(prootDir(), "loader")
  private fun loader32() = File(prootDir(), "loader-m32")
  private fun tempDir() = File(prootDir(), "tmp")
  private fun readyFile() = File(rootfs(), "var/lib/droiddesk/installed")

  private fun requirements(): Map<String, Any?> {
    val context = appContext()
    val abis = Build.SUPPORTED_ABIS.toList()
    val isArm64 = abis.any { it.equals("arm64-v8a", ignoreCase = true) }
    val available = StatFs(context.filesDir.absolutePath).availableBytes
    val memory = (context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager).let { manager ->
      ActivityManager.MemoryInfo().also { manager.getMemoryInfo(it) }.totalMem / (1024L * 1024L)
    }
    return mapOf(
      "supported" to isArm64,
      "architecture" to (abis.firstOrNull() ?: "unknown"),
      "availableBytes" to available,
      "requiredBytes" to REQUIRED_SPACE,
      "enoughStorage" to (available >= REQUIRED_SPACE),
      "memoryMb" to memory,
      "minimumAndroidApi" to 26,
      "androidApi" to Build.VERSION.SDK_INT
    )
  }

  private fun state(): Map<String, Any?> {
    val running = isAlive(vncProcess) && isAlive(websockifyProcess)
    if (!running && viewerUrl != null) {
      viewerUrl = null
      currentVncPassword = null
      if (!busy) {
        phase = if (isInstalled()) "installed" else "idle"
        message = if (isInstalled()) "Ubuntu siap" else "Belum disiapkan"
      }
    }
    val free = runCatching { StatFs(appContext().filesDir.absolutePath).availableBytes }.getOrDefault(0L)
    return mapOf(
      "supported" to requirements()["supported"],
      "installed" to isInstalled(),
      "running" to running,
      "busy" to busy,
      "phase" to phase,
      "progress" to progress,
      "message" to message,
      "error" to (lastError ?: ""),
      "availableBytes" to free,
      "viewerUrl" to (if (running) viewerUrl ?: "" else ""),
      "rootfsVersion" to ROOTFS_VERSION
    )
  }

  private fun isInstalled(): Boolean = readyFile().isFile && File(rootfs(), "usr/bin/bash").exists()

  private fun isAlive(process: Process?): Boolean {
    if (process == null) return false
    return try {
      process.exitValue()
      false
    } catch (_: IllegalThreadStateException) {
      true
    }
  }

  private fun runOperation(initialPhase: String, body: () -> Unit) {
    synchronized(lock) {
      check(!busy) { "Operasi lain sedang berlangsung." }
      busy = true
      lastError = null
      phase = initialPhase
    }
    try {
      body()
    } catch (error: Throwable) {
      lastError = (error.message ?: "Operasi gagal.").take(500)
      phase = "error"
      message = lastError ?: "Operasi gagal."
      emit(phase, progress, message)
      throw error
    } finally {
      synchronized(lock) { busy = false }
      if (phase != "error") {
        phase = if (isInstalled()) "installed" else "idle"
        progress = if (isInstalled()) 1.0 else 0.0
        message = if (isInstalled()) "Ubuntu siap" else message
        emit(phase, progress, message)
      }
    }
  }

  private fun emit(nextPhase: String, nextProgress: Double, text: String) {
    phase = nextPhase
    progress = nextProgress.coerceIn(0.0, 1.0)
    message = text
    sendEvent("onProgress", mapOf(
      "phase" to phase,
      "progress" to progress,
      "message" to message,
      "error" to (lastError ?: "")
    ))
    sendEvent("onState", state())
  }

  private fun installUbuntu() {
    val requirements = requirements()
    check(requirements["supported"] == true) {
      "Perangkat ini belum didukung. Versi awal DroidDesk membutuhkan Android ARM64 (arm64-v8a)."
    }
    check((requirements["androidApi"] as Int) >= 26) {
      "DroidDesk membutuhkan Android 8.0 atau lebih baru."
    }
    check((requirements["enoughStorage"] as Boolean)) {
      "Sediakan setidaknya 5 GB ruang kosong sebelum memasang Ubuntu dan desktop XFCE."
    }

    val root = dataRoot()
    if (isInstalled()) {
      emit("installed", 1.0, "Ubuntu sudah disiapkan")
      return
    }
    if (root.exists()) root.deleteRecursively()
    if (!root.mkdirs()) throw IllegalStateException("Tidak dapat membuat direktori data Linux.")
    ensureProot()

    val archive = File(root, "ubuntu-base.tar.gz")
    downloadRootfs(archive)
    emit("verify", 0.14, "Memeriksa integritas Ubuntu Base…")
    val observed = sha256(archive)
    check(observed == ROOTFS_SHA256) {
      archive.delete()
      "Checksum Ubuntu tidak cocok. Arsip dibuang demi keamanan; coba setup lagi."
    }

    val fs = rootfs()
    if (!fs.mkdirs()) throw IllegalStateException("Tidak dapat menyiapkan direktori root filesystem.")
    emit("extract", 0.16, "Mengekstrak Ubuntu Base ARM64…")
    extractTarGz(archive, fs)
    archive.delete()

    emit("packages", 0.3, "Memasang XFCE, TigerVNC, dan viewer web. Biarkan aplikasi tetap terbuka…")
    val installCommand = "export DEBIAN_FRONTEND=noninteractive; apt-get update -y && apt-get install -y --no-install-recommends xfce4 xfce4-terminal dbus-x11 tigervnc-standalone-server tigervnc-common novnc websockify fonts-dejavu-core xterm ca-certificates && apt-get clean && rm -rf /var/lib/apt/lists/* && mkdir -p /var/lib/droiddesk && printf '%s\\n' '$ROOTFS_VERSION' > /var/lib/droiddesk/installed"
    runGuestCommand(installCommand, showOutput = true)
    check(readyFile().isFile) { "Ubuntu selesai diunduh, tetapi pemasangan paket desktop tidak tuntas." }
    emit("installed", 1.0, "Ubuntu XFCE siap. Anda dapat mulai desktop.")
  }

  private fun ensureProot() {
    if (prootBin().isFile && loader().isFile && loader32().isFile) return
    emit("proot", 0.05, "Menyiapkan runtime PRoot ARM64…")
    val directory = prootDir()
    if (directory.exists()) directory.deleteRecursively()
    if (!directory.mkdirs()) throw IllegalStateException("Tidak dapat menyiapkan runtime Linux.")
    val packageFile = File(directory, "proot-aarch64.zip")
    appContext().assets.open("proot-aarch64.zip").use { input ->
      FileOutputStream(packageFile).use { output -> input.copyTo(output) }
    }
    check(sha256(packageFile) == PROOT_SHA256) {
      packageFile.delete()
      "Paket PRoot tidak lolos verifikasi SHA-256 dan tidak akan dijalankan."
    }
    ZipInputStream(BufferedInputStream(FileInputStream(packageFile))).use { zip ->
      var entry = zip.nextEntry
      val expected = setOf("proot", "loader", "loader-m32")
      val written = mutableSetOf<String>()
      while (entry != null) {
        val name = entry.name
        check(name in expected && !entry.isDirectory) { "Isi arsip PRoot tidak sesuai dengan rilis yang dipin." }
        val target = File(directory, name).canonicalFile
        check(target.parentFile == directory.canonicalFile) { "Path arsip PRoot tidak aman." }
        BufferedOutputStream(FileOutputStream(target)).use { zip.copyTo(it) }
        check(target.setReadable(true, true) && target.setWritable(true, true) && target.setExecutable(true, true)) {
          "Android tidak mengizinkan menyiapkan executable PRoot di penyimpanan aplikasi."
        }
        written += name
        zip.closeEntry()
        entry = zip.nextEntry
      }
      check(written == expected) { "Paket PRoot tidak lengkap." }
    }
    packageFile.delete()
    if (!tempDir().mkdirs() && !tempDir().isDirectory) {
      throw IllegalStateException("Tidak dapat menyiapkan direktori sementara PRoot.")
    }
  }

  private fun downloadRootfs(destination: File) {
    emit("download", 0.0, "Mengunduh Ubuntu Base resmi (ARM64)…")
    val connection = (URL(ROOTFS_URL).openConnection() as HttpURLConnection).apply {
      connectTimeout = 20_000
      readTimeout = 120_000
      instanceFollowRedirects = false
      requestMethod = "GET"
      setRequestProperty("User-Agent", "DroidDesk/1.0 Android")
    }
    try {
      check(connection.url.protocol == "https" && connection.url.host == "cdimage.ubuntu.com") {
        "Alamat unduhan Ubuntu bukan sumber HTTPS resmi yang diizinkan."
      }
      val code = connection.responseCode
      if (code in 300..399) {
        val location = connection.getHeaderField("Location") ?: throw IllegalStateException("Unduhan Ubuntu mengalihkan ke alamat yang tidak dikenal.")
        val redirected = URL(URL(ROOTFS_URL), location)
        check(redirected.protocol == "https" && redirected.host == "cdimage.ubuntu.com") {
          "Pengalihan unduhan Ubuntu ditolak karena host tidak sesuai."
        }
        downloadFrom(redirected, destination)
      } else {
        check(code == 200) { "Server Ubuntu mengembalikan HTTP $code." }
        copyResponse(connection, destination)
      }
    } finally {
      connection.disconnect()
    }
  }

  private fun downloadFrom(url: URL, destination: File) {
    val redirected = (url.openConnection() as HttpURLConnection).apply {
      connectTimeout = 20_000
      readTimeout = 120_000
      instanceFollowRedirects = false
      setRequestProperty("User-Agent", "DroidDesk/1.0 Android")
    }
    try {
      check(redirected.responseCode == 200) { "Unduhan Ubuntu gagal: HTTP ${redirected.responseCode}." }
      copyResponse(redirected, destination)
    } finally {
      redirected.disconnect()
    }
  }

  private fun copyResponse(connection: HttpURLConnection, destination: File) {
    val total = connection.contentLengthLong
    check(total <= MAX_ROOTFS_DOWNLOAD_BYTES) { "Ukuran unduhan Ubuntu melebihi batas aman." }
    var copied = 0L
    connection.inputStream.use { input ->
      FileOutputStream(destination).use { output ->
        val buffer = ByteArray(64 * 1024)
        while (true) {
          val count = input.read(buffer)
          if (count < 0) break
          check(copied + count <= MAX_ROOTFS_DOWNLOAD_BYTES) { "Unduhan Ubuntu melebihi batas aman dan dihentikan." }
          output.write(buffer, 0, count)
          copied += count
          if (copied % (1024L * 1024L) < buffer.size) {
            val fraction = if (total > 0) copied.toDouble() / total.toDouble() else 0.0
            emit("download", fraction * 0.12, "Mengunduh Ubuntu Base… ${formatBytes(copied)}")
          }
        }
        output.fd.sync()
      }
    }
    check(destination.length() > 1_000_000L) { "Berkas Ubuntu terlalu kecil dan tampak tidak lengkap." }
  }

  private fun extractTarGz(archive: File, destination: File) {
    val rootPath = destination.canonicalFile.toPath()
    val rootPrefix = rootPath.toString() + File.separator
    var entries = 0
    TarArchiveInputStream(GZIPInputStream(BufferedInputStream(FileInputStream(archive)))).use { tar ->
      var entry: TarArchiveEntry? = tar.nextTarEntry
      while (entry != null) {
        val raw = entry.name.replace('\\', '/')
        check(!raw.startsWith("/") && raw.split('/').none { it == ".." }) {
          "Arsip Ubuntu memiliki path yang keluar dari root filesystem."
        }
        val normalizedName = raw.removePrefix("./").trimEnd('/')
        if (normalizedName.isNotEmpty()) {
          val outPath = rootPath.resolve(normalizedName).normalize()
          check(outPath.toString() == rootPath.toString() || outPath.toString().startsWith(rootPrefix)) {
            "Path arsip Ubuntu tidak aman."
          }
          val output = outPath.toFile()
          if (entry.isDirectory) {
            if (!output.exists() && !output.mkdirs()) throw IllegalStateException("Gagal membuat direktori Ubuntu.")
          } else if (entry.isSymbolicLink) {
            val rawTarget = entry.linkName
            val linkTarget = if (rawTarget.startsWith("/")) {
              rootPath.resolve(rawTarget.removePrefix("/")).normalize()
            } else {
              output.parentFile.toPath().resolve(rawTarget).normalize()
            }
            check(linkTarget.toString() == rootPath.toString() || linkTarget.toString().startsWith(rootPrefix)) {
              "Tautan simbolik dalam arsip Ubuntu keluar dari root filesystem."
            }
            output.parentFile?.mkdirs()
            if (Files.exists(outPath)) Files.delete(outPath)
            val relativeTarget = output.parentFile.toPath().relativize(linkTarget)
            Files.createSymbolicLink(outPath, relativeTarget)
          } else if (entry.isLink) {
            val linkName = entry.linkName.removePrefix("./")
            check(!linkName.startsWith("/") && linkName.split('/').none { it == ".." }) {
              "Hard link dalam arsip Ubuntu tidak aman."
            }
            val source = rootPath.resolve(linkName).normalize().toFile()
            check(source.canonicalPath == rootPath.toString() || source.canonicalPath.startsWith(rootPrefix)) {
              "Hard link dalam arsip Ubuntu keluar dari root filesystem."
            }
            output.parentFile?.mkdirs()
            check(source.isFile && source.copyTo(output, overwrite = true).exists()) {
              "Hard link Ubuntu merujuk ke berkas yang tidak tersedia."
            }
          } else if (entry.isFile) {
            output.parentFile?.mkdirs()
            BufferedOutputStream(FileOutputStream(output)).use { out -> tar.copyTo(out) }
            output.setReadable(true, false)
            output.setWritable((entry.mode and 0b010010010) != 0, false)
            output.setExecutable((entry.mode and 0b001001001) != 0, false)
          }
        }
        entries += 1
        if (entries % 500 == 0) {
          emit("extract", 0.16 + (entries % 5_000) / 5_000.0 * 0.1, "Mengekstrak Ubuntu Base… ($entries item)")
        }
        entry = tar.nextTarEntry
      }
    }
    check(File(destination, "usr/bin/bash").isFile) { "Root filesystem Ubuntu tidak lengkap setelah diekstrak." }
  }

  private fun sha256(file: File): String {
    val digest = MessageDigest.getInstance("SHA-256")
    FileInputStream(file).use { input ->
      val buffer = ByteArray(64 * 1024)
      while (true) {
        val count = input.read(buffer)
        if (count < 0) break
        digest.update(buffer, 0, count)
      }
    }
    return digest.digest().joinToString("") { "%02x".format(it) }
  }

  private fun guestArgs(command: String): List<String> {
    val root = rootfs()
    check(root.exists()) { "Ubuntu belum terpasang." }
    return listOf(
      prootBin().absolutePath,
      "--kill-on-exit",
      "--link2symlink",
      "-0",
      "-r", root.absolutePath,
      "-w", "/root",
      "-b", "/dev",
      "-b", "/proc",
      "--",
      "/usr/bin/env", "-i",
      "HOME=/root",
      "USER=root",
      "LOGNAME=root",
      "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
      "TERM=xterm-256color",
      "DEBIAN_FRONTEND=noninteractive",
      "/bin/bash", "-lc", command
    )
  }

  private fun configureProcess(builder: ProcessBuilder): ProcessBuilder {
    builder.environment()["PROOT_LOADER"] = loader().absolutePath
    builder.environment()["PROOT_LOADER_32"] = loader32().absolutePath
    builder.environment()["PROOT_TMP_DIR"] = tempDir().absolutePath
    builder.environment()["TMPDIR"] = tempDir().absolutePath
    return builder
  }

  private fun runGuestCommand(command: String, showOutput: Boolean) {
    val process = configureProcess(ProcessBuilder(guestArgs(command)).redirectErrorStream(true)).start()
    process.inputStream.bufferedReader().useLines { lines ->
      lines.forEach { line ->
        if (showOutput && line.isNotBlank()) {
          val snippet = line.take(160)
          message = snippet
          sendEvent("onProgress", mapOf("phase" to phase, "progress" to progress, "message" to snippet, "error" to ""))
        }
      }
    }
    val code = process.waitFor()
    check(code == 0) { "Pemasangan Linux gagal (kode $code). Periksa koneksi internet dan coba setup lagi." }
  }

  private fun startDesktop(): Map<String, Any?> {
    check(isInstalled()) { "Siapkan Ubuntu terlebih dahulu." }
    synchronized(lock) { check(!busy) { "Operasi lain sedang berlangsung." }; busy = true }
    try {
      if (isAlive(vncProcess) && isAlive(websockifyProcess)) return state()
      stopProcesses()
      ensureProot()
      val random = SecureRandom()
      val alphabet = "abcdef0123456789"
      val password = (1..16).map { alphabet[random.nextInt(alphabet.length)] }.joinToString("")
      val display = 10 + random.nextInt(40)
      vncPort = 5900 + display
      webPort = 16000 + random.nextInt(30_000)
      currentVncPassword = password

      val setupScript = "mkdir -p /root/.vnc && printf '%s\\n' '${password}' | vncpasswd -f > /root/.vnc/passwd && chmod 600 /root/.vnc/passwd && printf '%s\\n' '#!/bin/sh' 'unset SESSION_MANAGER' 'unset DBUS_SESSION_BUS_ADDRESS' 'exec dbus-launch --exit-with-session startxfce4' > /root/.vnc/xstartup && chmod 700 /root/.vnc/xstartup"
      runGuestCommand(setupScript, showOutput = false)

      emit("starting", 0.0, "Memulai XFCE di sesi privat…")
      vncProcess = configureProcess(ProcessBuilder(guestArgs("vncserver :$display -fg -localhost yes -geometry 1280x800 -depth 24 -SecurityTypes VncAuth -PasswordFile /root/.vnc/passwd")).redirectErrorStream(true)).start()
      captureLogs(vncProcess!!, "VNC")
      check(waitForPort(vncPort, 30_000)) {
        stopProcesses()
        "Server XFCE/VNC tidak merespons. Coba hentikan lalu mulai lagi. ${lastLogs()}"
      }

      websockifyProcess = configureProcess(ProcessBuilder(guestArgs("websockify --web=/usr/share/novnc 127.0.0.1:$webPort 127.0.0.1:$vncPort")).redirectErrorStream(true)).start()
      captureLogs(websockifyProcess!!, "Viewer")
      check(waitForPort(webPort, 15_000)) {
        stopProcesses()
        "Viewer VNC tidak dapat dibuka. ${lastLogs()}"
      }
      val encoded = URLEncoder.encode(password, "UTF-8")
      viewerUrl = "http://127.0.0.1:$webPort/vnc.html?autoconnect=1&resize=scale&quality=7&compression=2&password=$encoded"
      lastError = null
      phase = "running"
      progress = 1.0
      message = "Desktop Ubuntu berjalan"
      emit(phase, progress, message)
      state()
    } catch (error: Throwable) {
      stopProcesses()
      phase = "error"
      lastError = (error.message ?: "Desktop gagal dimulai.").take(500)
      message = lastError ?: "Desktop gagal dimulai."
      emit(phase, progress, message)
      throw error
    } finally {
      synchronized(lock) { busy = false }
    }
  }

  private fun captureLogs(process: Process, tag: String) {
    Thread {
      runCatching {
        process.inputStream.bufferedReader().useLines { lines ->
          lines.forEach { line ->
            synchronized(logBuffer) {
              if (logBuffer.length > 3_000) logBuffer.delete(0, logBuffer.length - 2_000)
              logBuffer.append("[$tag] ").append(line.take(220)).append('\n')
            }
          }
        }
      }
    }.apply { name = "droiddesk-$tag-log"; isDaemon = true; start() }
  }

  private fun lastLogs(): String = synchronized(logBuffer) { logBuffer.toString().takeLast(900) }

  private fun waitForPort(port: Int, timeoutMs: Long): Boolean {
    val deadline = System.currentTimeMillis() + timeoutMs
    while (System.currentTimeMillis() < deadline) {
      if (!isAlive(vncProcess) && port == vncPort) return false
      if (!isAlive(websockifyProcess) && port == webPort && websockifyProcess != null) return false
      try {
        Socket("127.0.0.1", port).use { return true }
      } catch (_: Exception) {
        Thread.sleep(300)
      }
    }
    return false
  }

  private fun stopDesktop() {
    stopProcesses()
    viewerUrl = null
    currentVncPassword = null
    phase = if (isInstalled()) "installed" else "idle"
    progress = if (isInstalled()) 1.0 else 0.0
    message = if (isInstalled()) "Desktop dihentikan; Ubuntu tetap tersimpan" else "Belum disiapkan"
    emit(phase, progress, message)
  }

  private fun stopProcesses() {
    listOf(websockifyProcess, vncProcess).forEach { process ->
      if (isAlive(process)) {
        process?.destroy()
        try {
          if (process?.waitFor(2, TimeUnit.SECONDS) == false) process.destroyForcibly()
        } catch (_: InterruptedException) {
          Thread.currentThread().interrupt()
          process?.destroyForcibly()
        }
      }
    }
    websockifyProcess = null
    vncProcess = null
  }

  private fun formatBytes(bytes: Long): String {
    val mb = bytes / (1024.0 * 1024.0)
    return if (mb < 1024.0) "%.1f MB".format(mb) else "%.1f GB".format(mb / 1024.0)
  }
}

# TODO DroidDesk Standalone

## Aplikasi dan alur setup Android
- [ ] Ganti layar starter dengan layar DroidDesk berbahasa Indonesia untuk penggunaan satu tangan; tampilkan kebutuhan ruang, status Ubuntu, dan tombol setup/mulai/berhenti yang merefleksikan operasi nyata.
- [ ] Implementasikan setup pertama yang mengunduh root filesystem Ubuntu ARM64 dari sumber resmi, memvalidasi SHA-256, menolak arsip tidak valid/path traversal, mengekstraknya secara bertahap, dan menampilkan progres/error/retry yang akurat.
- [ ] Siapkan XFCE dan VNC di dalam userland dengan konfigurasi yang sesuai untuk sesi Android; tunjukkan kebutuhan ruang/internet dan batasan performa.

## Modul native dan desktop viewer
- [ ] Implementasikan modul Android/Kotlin untuk pemeriksaan arsitektur/ruang, pengunduhan, ekstraksi aman, proses PRoot, setup distro, status sesi, dan penghentian proses.
- [ ] Bundel/dapatkan binary PRoot Android yang arsitekturnya dan lisensinya diverifikasi; integrasikan sumber/lisensi/checksum dan jangan mengaku setup sukses bila binary tidak berjalan.
- [ ] Implementasikan mulai/berhenti XFCE + VNC secara native dan tampilkan desktop di viewer dalam APK tanpa Termux/Termux:X11.
- [ ] Sediakan penghapusan instalasi Linux dan laporan error yang tidak menghapus data tanpa tindakan pengguna.

## Identitas dan kualitas
- [ ] Buat ikon DroidDesk yang unik dan perbarui semua berkas branding Expo/Android sambil mempertahankan package identifier.
- [ ] Jalankan pemeriksaan TypeScript/lint dan pemeriksaan native yang tersedia; perbaiki hasil gagal sebelum checkpoint.
- [ ] Verifikasi fitur native melalui build APK/perangkat Android; Preview Web bukan bukti bahwa runtime Linux berjalan.

## GitHub dan APK
- [ ] Ekspor source proyek ke repo GitHub privat `droiddesk-standalone` setelah konektor GitHub berhasil terautentikasi; pertahankan repo kanonis Mobile Dev di Manus.
- [ ] Pastikan Dashboard Android build menghasilkan artefak APK; catat versi dan berikan tautan hasil build hanya setelah APK tersedia.

# DroidDesk

DroidDesk adalah aplikasi Android yang menyiapkan Ubuntu ARM64 di ruang privat aplikasi, lalu menjalankan desktop XFCE dalam viewer lokal. Versi sumber ini ditujukan untuk Android ARM64 (API 26 atau lebih baru), tidak memerlukan Termux atau akses root Android, dan memakai PRoot. PRoot berbagi kernel Android; ini bukan VM dan tidak mendukung fitur yang memerlukan kernel atau hak root sesungguhnya.

## Status build

Kode aplikasi, layar setup, jembatan Kotlin, pengunduh rootfs, dan alur desktop sudah disiapkan. Belum ada APK release yang dibuat atau diuji pada perangkat Android. Fitur native tidak dapat dibuktikan melalui Expo Web/Expo Go; buat build Android dari Dashboard dan uji pada perangkat ARM64 sebelum menyatakan aplikasi siap digunakan.

## Persyaratan dan setup

Perangkat harus menggunakan Android ARM64 dan Android 8.0/API 26 atau lebih baru. Sisakan sekurang-kurangnya 5 GB ruang kosong; 5–8 GB serta koneksi internet stabil lebih disarankan. Ubuntu Base diunduh saat setup pertama dari server Ubuntu, lalu diperiksa dengan SHA-256 yang dipin sebelum diekstrak. Paket XFCE, TigerVNC, noVNC, dan websockify dipasang dari repositori Ubuntu di dalam rootfs. Proses awal dapat memerlukan waktu dan kuota data yang besar.

Semua data Linux disimpan di direktori privat aplikasi. Menghapus data aplikasi Android akan menghapus rootfs. Tombol **Hapus Linux** juga menghapus Ubuntu dan aplikasi yang dipasang di dalamnya. Jangan gunakan aplikasi untuk beban kerja yang memerlukan kernel Linux tersendiri, akses perangkat/root host, atau kompatibilitas penuh VM.

## Sumber runtime dan lisensi

- Ubuntu Base 24.04.5 ARM64: [halaman rilis resmi](https://cdimage.ubuntu.com/ubuntu-base/releases/noble/release/). SHA-256 yang diharapkan ada di `DroidDeskLinuxModule.kt` dan `docs/architecture-research.md`.
- PRoot ARM64 untuk Android: rilis `v26.10.08-a179d3e` dari [repositori build Android](https://github.com/ahmed-alnassif/proot), dengan sumber upstream PRoot dari [Termux PRoot](https://github.com/termux/proot). Versi, asal, checksum, dan pemeriksaan arsip ada di `docs/vendor/PROOT-NOTICE.md`.
- PRoot dideklarasikan AGPL-3.0; teks lengkap disertakan di `docs/vendor/AGPL-3.0.txt`. Periksa serta penuhi syarat distribusi lisensi dan sediakan kode sumber bersesuaian saat membagikan APK.

Paket PRoot di dalam source tree belum pernah dijalankan di Sandbox. Aplikasi melakukan pemeriksaan SHA-256 kembali sebelum ekstraksi dan eksekusi pada Android.

## Pengembangan dan pemeriksaan

Proyek memakai Expo Router, React Native, TypeScript, modul Expo Android lokal, dan pnpm. Setelah dependensi sesuai lockfile tersedia:

```sh
pnpm check
pnpm lint
```

Modul native ada di `modules/droiddesk-linux/`; plugin Android untuk keamanan jaringan loopback ada di `plugins/withLoopbackCleartext.js`. Viewer hanya menerima halaman VNC lokal pada `127.0.0.1`; kebijakan cleartext Android membatasi koneksi ke alamat loopback.

APK/AAB release harus dibuat lewat alur build Android di Dashboard. Jangan menjalankan release build Android/iOS dari Sandbox. Build sukses saja belum membuktikan PRoot, paket XFCE, VNC, dan viewer bekerja pada perangkat; lakukan uji instalasi nyata sebelum mendistribusikan APK.

## Struktur

- `app/`: layar utama dan viewer desktop.
- `lib/linux/`: kontrak TypeScript modul native.
- `modules/droiddesk-linux/`: modul Android/Kotlin dan paket PRoot terpin.
- `plugins/`: konfigurasi keamanan jaringan Android.
- `docs/`: riset sumber, checksum, dan notice lisensi.

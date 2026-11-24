# Komponen runtime pihak ketiga

DroidDesk menyertakan arsip PRoot Android ARM64 di `modules/droiddesk-linux/android/src/main/assets/proot-aarch64.zip`. Paket ini berasal dari rilis `v26.10.08-a179d3e` repositori build [ahmed-alnassif/proot](https://github.com/ahmed-alnassif/proot) dan dibuat dari sumber PRoot yang dicatat dalam `PROOT-NOTICE.md`.

Repositori build mendeklarasikan GNU AGPL-3.0. Salinan teks lengkap tersedia di `AGPL-3.0.txt`; periksa kewajiban lisensi dan sumber bersesuaian sebelum membagikan APK. `PROOT-NOTICE.md` mencatat URL sumber, checksum, serta hasil pemeriksaan arsip. Arsip di source tree tidak pernah dieksekusi dalam Sandbox. Aplikasi memeriksa hash sekali lagi pada perangkat sebelum mengekstrak atau meluncurkan runtime tersebut.

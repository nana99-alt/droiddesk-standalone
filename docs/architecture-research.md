# Rujukan arsitektur

Temuan yang dipakai untuk rencana DroidDesk Standalone, dicatat pada 24 November 2026.

- Canonical menyediakan Ubuntu Base 24.04.5 dan tarball `ubuntu-base-24.04.5-base-arm64.tar.gz` dari situs resmi Ubuntu. Direktori rilis juga menyediakan `SHA256SUMS` dan berkas tanda tangan. Ukuran arsip ARM64 tercantum sekitar 29 MB; filesystem desktop XFCE harus dipasang terpisah. Sumber: [Ubuntu Base releases](https://cdimage.ubuntu.com/ubuntu-base/releases/noble/release/).
- Proyek Termux `proot-distro` menjelaskan bahwa PRoot adalah implementasi userspace untuk chroot/bind-mount yang menggunakan `ptrace` untuk menulis ulang jalur filesystem, sehingga tidak memerlukan root. Ia tetap memakai kernel host Android dan memiliki batasan dibanding sistem Linux/VM penuh. Sumber: [PRoot-Distro](https://github.com/termux/proot-distro) dan [PRoot Termux](https://github.com/termux/proot).
- UserLAnd merupakan contoh aplikasi Android sumber terbuka yang menjalankan distro Linux sebagai aplikasi Android tanpa root; repo menyebutkan bahwa aset distribusi dikelola di repo terpisah. Sumber: [UserLAnd source](https://github.com/CypherpunkArmory/UserLAnd).
- Contoh proyek build PRoot Android berbasis NDK menampilkan binary untuk ARM64/ARMv7/x86_64/x86 serta paket checksum. Repositori tersebut berlisensi AGPL-3.0; binary/kode tidak boleh disalin begitu saja tanpa mengevaluasi kewajiban lisensinya. Sumber: [Android PRoot builder](https://github.com/ahmed-alnassif/proot).
- Tulisan pengembang UserLAnd tahun 2026 membedakan mode PRoot yang rootless dari VM berbasis Android Virtualization Framework (AVF), yang memerlukan Android 14+, perangkat ARM64 dan dukungan OEM. Rencana awal DroidDesk memilih PRoot agar target perangkat lebih luas; ini berarti batasan PRoot harus dijelaskan dan tidak menyebutnya VM/kernel Linux tersendiri. Sumber: [UserLAnd: Actual Virtual Machines Come to Android](https://blog.userland.tech/2026/09/actual-virtual-machines-come-to-android.html).

## Catatan keputusan

Sumber menunjukkan bahwa ada jalur teknis untuk Linux userland mandiri di Android, tetapi belum membuktikan binary PRoot tertentu dapat dieksekusi dari proses aplikasi Expo atau bahwa sesi XFCE/VNC berjalan pada perangkat target. Verifikasi APK dan uji perangkat tetap wajib. Jangan mengandalkan repo pihak ketiga untuk mengunduh binary saat runtime tanpa pin versi, hash, dan lisensi yang jelas.

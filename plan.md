# Rencana DroidDesk Standalone

## Tujuan dan batasan

Bangun aplikasi Android yang berfungsi tanpa memasang Termux atau Termux:X11. Aplikasi mengunduh sistem Ubuntu ARM64 saat setup pertama, memasangnya di direktori privat aplikasi, dan menjalankan desktop XFCE yang tampil di dalam aplikasi. APK tidak membawa root filesystem beberapa gigabita. Dukungan awal berfokus pada Android ARM64; desktop Linux tetap berjalan sebagai userland tanpa hak root Android, sehingga fitur yang memerlukan kernel/root sungguhan tidak dijanjikan. APK hanya dinyatakan siap setelah build Android resmi menghasilkan artefak dan pemeriksaan perangkat tersedia.

Kode proyek harus disiapkan untuk repositori GitHub privat `droiddesk-standalone` secara default. Mobile Dev memakai repositori kanonis terkelola Manus untuk siklus checkpoint/build; GitHub adalah salinan kode terpisah dan tidak menggantikan sumber kanonis. Konektor GitHub aktif dan terautentikasi; repositori GitHub dibuat setelah source siap.

## Pendekatan implementasi

Gunakan starter Expo/React Native resmi. Antarmuka TypeScript menangani persyaratan penyimpanan, progres, status sesi, tombol setup/mulai/berhenti, serta layar desktop. Lapisan Kotlin/Android khusus mengelola unduhan rootfs dengan batas ukuran, verifikasi SHA-256, ekstraksi aman, proses PRoot, setup Ubuntu, siklus XFCE/VNC, dan status native yang dikirim ke UI. Kegagalan unduhan ditangani dengan mengulang setup; arsip parsial tidak dianggap instalasi valid. Tidak ada tombol yang mengaku berhasil sebelum operasi native benar-benar sukses.

Ubuntu Base 24.04 ARM64 diunduh dari kanal resmi Ubuntu. Setelah verifikasi integritas, aplikasi mengekstraknya lalu memasang komponen XFCE dan server VNC melalui `apt` di dalam rootfs. Tampilan desktop ditampilkan dalam aplikasi melalui klien VNC yang disertakan/bundled, bukan aplikasi Termux:X11 eksternal. PRoot adalah lapisan eksekusi rootless dan tidak setara dengan VM atau akses root Android.

Sebelum memasukkan binary native pihak ketiga, verifikasi lisensi, checksum, arsitektur, dan kompatibilitas API Android. Jangan mengambil binary dari tautan tak tepercaya atau menyembunyikan lisensi. Jika komponen native yang diperlukan tidak dapat diperoleh/build dengan lisensi yang jelas, tandai blocker secara terbuka dan jangan menyimulasikan keberhasilan.

## Alur penggunaan yang direncanakan

1. Pengguna membuka layar utama dan melihat keadaan perangkat, kebutuhan ruang yang disarankan, dan apakah Ubuntu telah terpasang.
2. Pengguna memilih Setup. Aplikasi memeriksa ruang bebas, mengunduh rootfs resmi, memvalidasi checksum, mengekstrak dengan aman, lalu memasang XFCE/VNC. UI menunjukkan kemajuan tahap demi tahap dan menyediakan pesan serta aksi untuk mengulang setup saat gagal.
3. Setelah setup berhasil, pengguna memilih Mulai Desktop. Modul native menjalankan sesi Linux dan server VNC, lalu aplikasi membuka layar viewer lokal.
4. Pengguna memilih Hentikan untuk menutup proses sesi. Status instalasi tetap tersimpan hingga pengguna memilih Hapus Data Linux.

## Rancangan visual

Tiga arah awal: (a) terminal editorial monokrom, probabilitas 0,04; (b) dashboard laboratorium hijau-graphite, probabilitas 0,07; (c) kartu utilitas pastel, probabilitas 0,03. Dipilih **dashboard laboratorium hijau-graphite**. Prinsip: status teknis terlihat jelas; satu aksi utama pada satu waktu; kemajuan instalasi tidak disamarkan; peringatan sumber daya disampaikan terus terang. Palet gelap graphite dengan hijau limau sebagai penanda status siap, amber untuk proses/peringatan, dan merah hanya untuk kegagalan. Susunan layar memakai panel status besar, kartu persyaratan, kartu sesi, serta pesan kemajuan/error yang selalu terlihat. Motif khas: indikator status seperti panel perangkat dan label fase setup. Interaksi tegas dan tenang, dengan animasi singkat hanya pada perpindahan status/progres. Tipografi: sans sistem Android untuk isi, angka/status monospasi untuk label teknis. Esensi merek: “Ubuntu desktop di ponsel, tanpa setup Termux”; sifat: lugas, mandiri, transparan. Suara: ringkas dan faktual; contoh: “Siapkan ruang kosong sebelum memasang Ubuntu.” “Desktop belum berjalan—periksa status sesi.” Ikon berupa simbol terminal sederhana di atas bidang hijau limau, tanpa sudut launcher dibakar ke gambar.

## Struktur proyek utama

- `app/(tabs)/index.tsx`: layar utama dan status setup/session.
- `app/desktop.tsx`: viewer desktop lokal dengan navigasi layar penuh.
- `lib/linux/`: kontrak TypeScript dan jembatan operasi/status native.
- `modules/droiddesk-linux/`: modul Expo Android/Kotlin untuk unduhan, ekstraksi, PRoot, proses Ubuntu, XFCE, dan VNC.
- `plugins/`: config plugin Android yang mendaftarkan modul/perizinan yang dibutuhkan.
- `assets/images/`: ikon aplikasi dan branding DroidDesk.
- `docs/`: sumber/arsitektur, build, lisensi komponen, dan troubleshooting.
- `plan.md`, `TODO.md`: rencana produk dan hasil yang belum/selesai.

## Build dan delivery

Pertahankan starter Mobile Dev dan portnya. Implementasi UI dapat diperiksa lewat Expo Preview; fitur Linux native harus diverifikasi sebagai native, bukan dianggap lolos hanya dari Web Preview. APK/AAB release dibangun melalui alur Android build Dashboard, bukan dengan menjalankan release build lokal di Sandbox. Pastikan ikon Android dan identifier tetap konsisten. Sebelum pengiriman, source dicheckpoint ke remote kanonis proyek. Buat salinan source bersih ke GitHub privat tanpa mengubah remote kanonis. Jangan mengklaim APK siap sebelum build mengembalikan APK nyata dan uji perangkat menyatakan alur Linux berfungsi.

## Fakta sumber awal

Ubuntu merilis Ubuntu Base ARM64 sebagai tarball resmi dan menyediakan `SHA256SUMS`; edisi 24.04.5 ARM64 yang tercantum berukuran sekitar 29 MB terkompresi. PRoot-Distro menjelaskan bahwa PRoot mengemulasikan perilaku chroot lewat ptrace tanpa root, tetapi membawa batasan kernel/Android; pendekatan ini berbeda dari VM. Referensi primer ada di `docs/architecture-research.md`.

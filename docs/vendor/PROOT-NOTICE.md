# PRoot Android binary notice

DroidDesk bundles the ARM64 Android PRoot package from the release `v26.10.08-a179d3e` of `ahmed-alnassif/proot`, built from the Termux PRoot source commit `a179d3e8a4e045aaa1fb8cc3284f23509d96d353`.

- Release: https://github.com/ahmed-alnassif/proot/releases/tag/v26.10.08-a179d3e
- Build repository/source: https://github.com/ahmed-alnassif/proot
- Upstream PRoot: https://github.com/termux/proot
- License declared by the Android build repository: GNU Affero General Public License v3.0 (AGPL-3.0). See the upstream repository's `LICENSE` file for full terms. Source should remain available to recipients of any distributed app binary.
- Downloaded archive: `proot-aarch64.zip`
- Expected SHA-256: `d621d71fb68bf07accbada37ffc4208cf4a963eed70916ee68f848cbd9555cc3`
- Observed SHA-256: `d621d71fb68bf07accbada37ffc4208cf4a963eed70916ee68f848cbd9555cc3`
- Archive content: `proot`, `loader`, `loader-m32`; ELF inspection identified the main binary as a 64-bit AArch64 PIE executable using `/system/bin/linker64`.

The archive was downloaded from the stated GitHub release and inspected for archive paths, checksum, and ELF metadata. It was not executed in the development environment. The app must verify the pinned checksum again before extracting/launching it on Android.

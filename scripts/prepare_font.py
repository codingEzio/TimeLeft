#!/usr/bin/env python3
"""Verify the published release archive and prepare the build-only font."""
import hashlib
import os
import stat
from pathlib import Path
import sys
import tempfile
import zipfile

ZIP_SHA = "d0784670f40f898b4909189695c945e02392105725988b7c0e7df28baca4c892"
FONT_SHA = "d5eeaff49ffc69fc14b4ee8a5f79a6e80febff358e5367c2f41b51970f5dcf19"
ENTRY = "DeparturePixelZh-0.1.1-web/DeparturePixelZhCompact-Regular.woff2"
DEST = Path(__file__).resolve().parent.parent / "assets/fonts/DeparturePixelZhCompact-d5eeaff4.woff2"

def main():
    if len(sys.argv) != 2:
        raise ValueError("Usage: python3 scripts/prepare_font.py RELEASE.zip")
    archive = Path(sys.argv[1])
    with archive.open("rb") as f:
        data = f.read(100_000_001)
    if len(data) > 100_000_000:
        raise ValueError("ZIP exceeds 100 MB")
    if hashlib.sha256(data).hexdigest() != ZIP_SHA:
        raise ValueError("ZIP SHA-256 mismatch")
    import io
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        matches = [i for i in z.infolist() if i.filename == ENTRY]
        if len(matches) != 1 or matches[0].file_size > 20_000_000:
            raise ValueError("Invalid or oversized font entry")
        font = z.read(matches[0])
    if hashlib.sha256(font).hexdigest() != FONT_SHA:
        raise ValueError("Font SHA-256 mismatch")
    if not all(hasattr(os, name) for name in ("O_NOFOLLOW", "O_NONBLOCK", "link")):
        raise ValueError("Safe file creation is unsupported / 不支援安全檔案建立 / 不支持安全文件创建")
    # A private temporary directory protects a new file created with 0666 & umask.
    with tempfile.TemporaryDirectory(prefix=".font-", dir=DEST.parent) as directory:
        name = Path(directory) / "font.woff2"
        with name.open("xb") as f:
            f.write(font)
        try:
            # A hard link creates the destination atomically without replacing it.
            os.link(name, DEST)
        except FileExistsError:
            # Do not follow links, block on special files, or modify an existing target.
            flags = os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK
            try:
                existing_fd = os.open(DEST, flags)
            except OSError as e:
                raise ValueError("Existing font target is not a matching regular file / 既有字型目標不是相符的正規檔案 / 现有字体目标不是匹配的普通文件") from e
            with os.fdopen(existing_fd, "rb") as f:
                info = os.fstat(f.fileno())
                if not stat.S_ISREG(info.st_mode) or info.st_size != len(font):
                    raise ValueError("Existing font target is not a matching regular file / 既有字型目標不是相符的正規檔案 / 现有字体目标不是匹配的普通文件")
                existing = f.read(len(font) + 1)
                if hashlib.sha256(existing).hexdigest() != FONT_SHA:
                    raise ValueError("Existing font target differs; preserved / 既有字型不同，已保留 / 现有字体不同，已保留")
        except OSError as e:
            raise ValueError("Atomic hard-link creation failed; target preserved / 原子硬連結建立失敗，目標已保留 / 原子硬链接创建失败，目标已保留") from e
    print("Font verified and prepared. / 字型已驗證並準備完成。 / 字体已验证并准备完成。")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, zipfile.BadZipFile, EOFError, RuntimeError, NotImplementedError) as e:
        print(f"Font preparation failed / 字型準備失敗 / 字体准备失败: {e}", file=sys.stderr)
        sys.exit(1)

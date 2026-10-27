#!/usr/bin/env python3
"""
Lihat daftar sesi Hermes yang tersimpan.

Sesi TIDAK disimpan sebagai banyak berkas — semuanya di satu database SQLite
(state.db), tabel `sessions` (daftar sesi) dan `messages` (isi percakapan).

Pakai:
    python3 scripts/daftar-sesi.py                  # 20 sesi terbaru
    python3 scripts/daftar-sesi.py --all            # semua sesi
    python3 scripts/daftar-sesi.py --cari school    # cari kata kunci
    python3 scripts/daftar-sesi.py --detail <ID>    # rincian satu sesi

Ganti lokasi DB lewat env:  HERMES_STATE_DB=/path/ke/state.db
"""

import argparse
import os
import sqlite3
import sys
from datetime import datetime

DB = os.environ.get("HERMES_STATE_DB") or os.path.expanduser(
    "/opt/data/profiles/ceo/state.db"
)


def buka_db():
    if not os.path.exists(DB):
        sys.exit(f"Database tidak ditemukan: {DB}\nSet env HERMES_STATE_DB.")
    # mode=ro: buka hanya-baca supaya tidak mungkin merusak data sesi.
    conn = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def fmt_ts(ts):
    """started_at/ended_at = epoch detik; buat jadi teks terbaca."""
    if ts is None:
        return "-"
    try:
        return datetime.fromtimestamp(float(ts)).strftime("%Y-%m-%d %H:%M")
    except (ValueError, TypeError, OSError):
        return str(ts)[:16]


def ringkas(s, lebar=46):
    """Ambil judul sesi; kalau kosong pakai potongan system prompt/awal chat."""
    t = (s.get("title") or "").strip()
    if t:
        return t[:lebar]
    return "(tanpa judul)"


def daftar_sesi(conn, batas):
    sql = """SELECT id, title, source, display_name, started_at, ended_at,
                    message_count, model, archived
             FROM sessions ORDER BY started_at DESC"""
    if batas:
        sql += f" LIMIT {int(batas)}"
    baris = conn.execute(sql).fetchall()

    if not baris:
        print("Tidak ada sesi tersimpan.")
        return

    print(f"\n{'#':>3}  {'SESSION ID':<24} {'PESAN':>5}  {'MULAI':<16} {'SUMBER':<9} JUDUL")
    print("-" * 104)
    for i, r in enumerate(baris, 1):
        print(
            f"{i:>3}  {r['id']:<24} {r['message_count'] or 0:>5}  "
            f"{fmt_ts(r['started_at']):<16} {(r['source'] or '-'):<9} {ringkas(dict(r))}"
        )
    print(f"\n{len(baris)} sesi ditampilkan. Pakai --all untuk semuanya.")
    print(f"Database: {DB}")


def cari(conn, kata):
    pola = f"%{kata}%"
    hasil = {}

    for r in conn.execute(
        "SELECT id, title, started_at, message_count FROM sessions WHERE title LIKE ?",
        (pola,),
    ):
        hasil[r["id"]] = {
            "judul": r["title"],
            "mulai": r["started_at"],
            "pesan": r["message_count"],
            "cocok": 0,
        }

    for r in conn.execute(
        """SELECT session_id, COUNT(*) n FROM messages
           WHERE content LIKE ? GROUP BY session_id ORDER BY n DESC""",
        (pola,),
    ):
        h = hasil.setdefault(r["session_id"], {"judul": None, "cocok": 0})
        h["cocok"] = r["n"]

    if not hasil:
        print(f'Tidak ada sesi yang mengandung "{kata}".')
        return

    # Lengkapi judul & waktu mulai untuk sesi yang hanya ketemu lewat pesan.
    for sid in list(hasil):
        if hasil[sid].get("mulai") is None:
            row = conn.execute(
                "SELECT title, started_at, message_count FROM sessions WHERE id=?",
                (sid,),
            ).fetchone()
            if row:
                hasil[sid]["judul"] = hasil[sid].get("judul") or row["title"]
                hasil[sid]["mulai"] = row["started_at"]
                hasil[sid].setdefault("pesan", row["message_count"])

    print(f'\nHasil pencarian "{kata}" — {len(hasil)} sesi:')
    print(f"{'SESSION ID':<24} {'COCOK':>6}  {'MULAI':<16} JUDUL")
    print("-" * 100)
    for sid, h in sorted(hasil.items(), key=lambda kv: -(kv[1].get("cocok") or 0)):
        print(f"{sid:<24} {h.get('cocok', 0):>6}  {fmt_ts(h.get('mulai')):<16} {(h.get('judul') or '')[:44]}")


def detail(conn, sid):
    r = conn.execute("SELECT * FROM sessions WHERE id=?", (sid,)).fetchone()
    if not r:
        sys.exit(f"Sesi '{sid}' tidak ditemukan. Cek ID dengan daftar sesi.")
    d = dict(r)

    print(f"\nSesi: {sid}")
    for k in ("title", "source", "display_name", "model",
              "started_at", "ended_at", "end_reason", "message_count",
              "tool_call_count", "cwd", "git_branch", "archived"):
        if k in d:
            v = fmt_ts(d[k]) if k in ("started_at", "ended_at") else d[k]
            print(f"  {k:<16}: {v}")

    total = conn.execute(
        "SELECT COUNT(*) FROM messages WHERE session_id=?", (sid,)
    ).fetchone()[0]
    print(f"  {'baris pesan':<16}: {total}")

    awal = conn.execute(
        "SELECT role, content FROM messages WHERE session_id=? ORDER BY id LIMIT 1", (sid,)
    ).fetchone()
    if awal:
        isi = (awal["content"] or "").strip().replace("\n", " ")
        print(f"\n  Pesan pertama ({awal['role']}): {isi[:180]}")


def main():
    p = argparse.ArgumentParser(description="Lihat daftar sesi Hermes yang tersimpan.")
    p.add_argument("-n", "--jumlah", type=int, default=20, help="jumlah sesi (default 20)")
    p.add_argument("--all", action="store_true", help="tampilkan semua sesi")
    p.add_argument("--cari", metavar="KATA", help="cari kata kunci di judul/isi pesan")
    p.add_argument("--detail", metavar="ID", help="rincian satu sesi")
    a = p.parse_args()

    conn = buka_db()
    if a.detail:
        detail(conn, a.detail)
    elif a.cari:
        cari(conn, a.cari)
    else:
        daftar_sesi(conn, None if a.all else a.jumlah)


if __name__ == "__main__":
    main()

# このリポジトリでの作業ルール

作業の進め方（Issue → ブランチ → PR、ブランチ名、コミットの形式、禁止事項）は、全プロジェクト共通のルール（`~/.claude/CLAUDE.md`）に従う。ここには、このリポジトリ固有のことだけを書く。

---

## ラベル

Issue と PR には **種類を1つ**、**領域を1つ以上**付ける。

| 種類 | `feat` `fix` `docs` `chore` `refactor` |
| --- | --- |
| **領域** | `requirements` `mock` `infra` |

| 領域 | 用途 |
| --- | --- |
| `requirements` | 要件定義・仕様 |
| `mock` | UI確認用のモック |
| `infra` | 開発環境・CI・リポジトリの設定（README、CLAUDE.md など） |

実装用の領域ラベル（`frontend` `backend` `db` など）は、技術構成が決まってから作る。

---

## ディレクトリ

| パス | 中身 |
| --- | --- |
| `docs/` | 要件定義書などのドキュメント |
| `mock/` | UI確認用のモック（HTML＋JavaScript、ダミーデータ） |

---

## 参照

- [README](README.md) — プロジェクトの概要と現在の状況
- [要件定義書](docs/requirements.md) — 仕様の正本。決まったことは必ずここに反映する

# SPEC

**方針: SPEC は実装してから書く。** 本ディレクトリはコードを正としたリバースエンジニアリング成果物を管理する。

実装が進んだ段階で、コードから起こして以下を作成・更新する(mermaid):

- 仕様書(実装済み API・画面の仕様)
- ER 図 / DFD / シーケンス図 / クラス図 / 状態遷移図 / ユースケース図
- API 仕様(`SPEC/api/`) — README の API 一覧からリンクする

正本の設計意図は `../fridge-watch-demo_design_documents.md`(読み取り専用)。
mermaid のレンダリング/検証には `@mermaid-js/mermaid-cli`(`mmdc`)を用いる。

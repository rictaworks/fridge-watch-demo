# frozen_string_literal: true

# アプリ全体で共有する単一インスタンス(リセットゲート・デバイス束縛)を保持する。
# グローバル変数($...)を避け、モジュールのメモ化として管理する。
module AppRegistry
  class << self
    # リセット中フラグを保持する ResetGate(全リクエストで共有)。
    def reset_gate
      @reset_gate ||= DailyReset::ResetGate.new
    end

    # ESP32 デバイス束縛(virtual/http/off)。virtual の状態はプロセス内で共有する。
    def device
      @device ||= Device.bind(ENV)
    end

    # テスト用リセット(状態を初期化する)。
    def reset!
      @reset_gate = nil
      @device = nil
    end
  end
end

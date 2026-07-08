Rails.application.routes.draw do
  # ヘルスチェック(ロードバランサ/監視用)。
  get "up" => "rails/health#show", as: :rails_health_check

  # 冷蔵庫管理デモ版 API(移植元 src/server/app.ts と同契約)。
  namespace :api do
    get "state", to: "state#show"
    get "masters", to: "masters#index"
    get "device", to: "device#show"

    post "items", to: "items#create"
    post "items/manual", to: "items#manual"
    post "items/:id/adjust", to: "items#adjust"
    delete "items/:id", to: "items#destroy"

    post "reset", to: "reset#create"
  end
end

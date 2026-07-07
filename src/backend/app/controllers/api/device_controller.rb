# frozen_string_literal: true

module Api
  # GET /api/device — ESP32 デバイスのモードと(virtual 時)状態スナップショット。
  class DeviceController < BaseController
    def show
      device = AppRegistry.device
      render json: {
        mode: device.mode,
        state: device.virtual ? device.virtual.snapshot : nil,
      }
    end
  end
end

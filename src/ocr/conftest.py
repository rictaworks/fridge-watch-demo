"""pytest 設定。ocr ルートを import パスに追加し、app / tests を解決する。"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

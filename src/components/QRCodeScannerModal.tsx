import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';

interface QRCodeScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScanned: (code: string) => void;
  title?: string;
  subtitle?: string;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SCAN_AREA_SIZE = Math.min(SCREEN_WIDTH * 0.72, 280);

export const QRCodeScannerModal: React.FC<QRCodeScannerModalProps> = ({
  visible,
  onClose,
  onScanned,
  title = 'Scan Workout QR',
  subtitle = 'Align QR code inside the frame',
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);

  // Reset scanner state when modal opens
  useEffect(() => {
    if (visible) {
      setScanned(false);
      setTorchEnabled(false);
    }
  }, [visible]);

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    if (scanned || !result.data) return;

    setScanned(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const rawData = result.data.trim();
    let extractedCode = rawData;

    // Check for JSON QR payload (e.g. coach claim payload or workout session payload)
    if (rawData.startsWith('{')) {
      try {
        const parsed = JSON.parse(rawData);
        if (parsed.code) extractedCode = String(parsed.code).toUpperCase();
        else if (parsed.roomPin) extractedCode = String(parsed.roomPin).toUpperCase();
        else if (parsed.pin) extractedCode = String(parsed.pin).toUpperCase();
      } catch {}
    }

    // Check for standard RIPPED codes: SPLIT-XXXX or RIP-XXXX
    const splitMatch = extractedCode.match(/SPLIT-[A-Z0-9_-]+/i);
    const ripMatch = extractedCode.match(/(RIP|PUMP)-[A-Z0-9_-]+/i);

    if (splitMatch) {
      extractedCode = splitMatch[0].toUpperCase();
    } else if (ripMatch) {
      extractedCode = ripMatch[0].toUpperCase();
    } else if (rawData.includes('code=')) {
      const paramCode = rawData.split('code=')[1]?.split('&')[0];
      if (paramCode) extractedCode = decodeURIComponent(paramCode).toUpperCase();
    }

    onScanned(extractedCode);
    onClose();
  };

  const toggleTorch = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTorchEnabled((prev) => !prev);
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black">
        {/* Permission Check */}
        {!permission ? (
          <View className="flex-1 items-center justify-center bg-dark-bg p-6">
            <ActivityIndicator size="large" color="#06B6D4" />
            <Text className="text-zinc-400 text-xs font-bold mt-4">Initializing camera...</Text>
          </View>
        ) : !permission.granted ? (
          <View className="flex-1 items-center justify-center bg-dark-bg px-6">
            <View className="w-16 h-16 rounded-3xl bg-cyan-500/20 border border-cyan-500/40 items-center justify-center mb-5">
              <Ionicons name="camera-outline" size={32} color="#06B6D4" />
            </View>

            <Text className="text-xl font-black text-white text-center mb-2">
              Camera Access Needed
            </Text>
            <Text className="text-sm text-zinc-400 text-center leading-relaxed mb-6">
              RIPPED needs access to your camera to scan workout QR codes shared by your gym partner.
            </Text>

            <TouchableOpacity
              onPress={async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                await requestPermission();
              }}
              className="w-full bg-accent-cyan py-3.5 rounded-2xl items-center mb-3 shadow-lg shadow-cyan-500/25"
            >
              <Text className="text-black font-black text-sm">Enable Camera</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              className="w-full py-3 rounded-2xl items-center border border-zinc-800 bg-zinc-900"
            >
              <Text className="text-zinc-400 font-bold text-xs">Enter Code Manually</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="flex-1">
            {/* Live Camera View */}
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={torchEnabled}
              barcodeScannerSettings={{
                barcodeTypes: ['qr'],
              }}
              onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
            />

            {/* Viewfinder Overlay Mask */}
            <View style={StyleSheet.absoluteFill} className="justify-between">
              {/* Top Mask with Header */}
              <View className="bg-black/65 pt-12 pb-4 px-5">
                <View className="flex-row items-center justify-between">
                  <TouchableOpacity
                    onPress={onClose}
                    className="w-10 h-10 rounded-full bg-zinc-900/80 border border-zinc-700/80 items-center justify-center shadow-md"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={20} color="#FFFFFF" />
                  </TouchableOpacity>

                  <View className="items-center">
                    <Text className="text-white font-black text-base">{title}</Text>
                    <Text className="text-[11px] text-cyan-400 font-semibold">{subtitle}</Text>
                  </View>

                  <TouchableOpacity
                    onPress={toggleTorch}
                    className={`w-10 h-10 rounded-full border items-center justify-center shadow-md ${
                      torchEnabled
                        ? 'bg-amber-400 border-amber-300'
                        : 'bg-zinc-900/80 border-zinc-700/80'
                    }`}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name={torchEnabled ? 'flash' : 'flash-outline'}
                      size={18}
                      color={torchEnabled ? '#000000' : '#FFFFFF'}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Middle Row with Center Clear Reticle */}
              <View className="flex-row items-center justify-center flex-1">
                {/* Left Mask */}
                <View className="flex-1 h-full bg-black/65" />

                {/* Reticle Target Area */}
                <View
                  style={{ width: SCAN_AREA_SIZE, height: SCAN_AREA_SIZE }}
                  className="relative justify-between p-1"
                >
                  {/* Top-Left Corner */}
                  <View className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-cyan-400 rounded-tl-2xl" />
                  {/* Top-Right Corner */}
                  <View className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-cyan-400 rounded-tr-2xl" />
                  {/* Bottom-Left Corner */}
                  <View className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-cyan-400 rounded-bl-2xl" />
                  {/* Bottom-Right Corner */}
                  <View className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-cyan-400 rounded-br-2xl" />

                  {/* Scanning Animation / Reticle Center Guide */}
                  <View className="flex-1 items-center justify-center">
                    <View className="w-12 h-12 rounded-full border border-cyan-500/30 items-center justify-center">
                      <View className="w-2 h-2 rounded-full bg-cyan-400" />
                    </View>
                  </View>
                </View>

                {/* Right Mask */}
                <View className="flex-1 h-full bg-black/65" />
              </View>

              {/* Bottom Mask with Action Controls */}
              <View className="bg-black/65 px-6 pt-6 pb-12 items-center">
                <View className="bg-zinc-900/90 border border-zinc-800 px-4 py-2 rounded-full mb-4 flex-row items-center space-x-2">
                  <Ionicons name="scan" size={14} color="#06B6D4" />
                  <Text className="text-zinc-300 text-xs font-semibold">
                    Align code inside the frame to scan
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={onClose}
                  className="bg-zinc-800/90 border border-zinc-700 px-6 py-2.5 rounded-xl flex-row items-center space-x-2"
                >
                  <Ionicons name="keypad-outline" size={15} color="#A1A1AA" />
                  <Text className="text-xs font-bold text-white">Enter Code Manually</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};

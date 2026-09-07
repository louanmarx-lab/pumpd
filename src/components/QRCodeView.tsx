import React, { useMemo } from 'react';
import { View } from 'react-native';
import QRCode from 'qrcode';

interface QRCodeViewProps {
  value: string;
  size?: number;
  bgColor?: string;
  fgColor?: string;
}

export const QRCodeView: React.FC<QRCodeViewProps> = ({
  value,
  size = 180,
  bgColor = '#FFFFFF',
  fgColor = '#09090B',
}) => {
  const qrMatrix = useMemo(() => {
    try {
      const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
      const numModules = qr.modules.size;
      const data = qr.modules.data;
      const matrix: boolean[][] = [];

      for (let row = 0; row < numModules; row++) {
        const rowData: boolean[] = [];
        for (let col = 0; col < numModules; col++) {
          rowData.push(Boolean(data[row * numModules + col]));
        }
        matrix.push(rowData);
      }
      return { matrix, numModules };
    } catch (err) {
      console.warn('Failed to generate QR code matrix:', err);
      return null;
    }
  }, [value]);

  if (!qrMatrix) {
    return <View style={{ width: size, height: size, backgroundColor: bgColor }} />;
  }

  const { matrix, numModules } = qrMatrix;
  const cellSize = size / numModules;

  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor: bgColor,
        padding: 8,
        borderRadius: 16,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={{ width: size - 16, height: size - 16 }}>
        {matrix.map((row, rIdx) => (
          <View key={`r-${rIdx}`} style={{ flexDirection: 'row', height: (size - 16) / numModules }}>
            {row.map((isDark, cIdx) => (
              <View
                key={`c-${cIdx}`}
                style={{
                  width: (size - 16) / numModules,
                  height: '100%',
                  backgroundColor: isDark ? fgColor : bgColor,
                }}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
};

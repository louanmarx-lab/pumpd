import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { PlateCalculationResult } from '../types/gymjam';

interface BarbellPlateVisualizerProps {
  calculation: PlateCalculationResult;
  maxVisualHeight?: number;
}

export const BarbellPlateVisualizer: React.FC<BarbellPlateVisualizerProps> = ({
  calculation,
  maxVisualHeight = 130,
}) => {
  const { barWeight, weightPerSide, platesPerSide, remainderKg, totalCalculatedWeight } =
    calculation;

  // Flatten plates for side-sleeve rendering (innermost to outermost)
  const loadedPlates: typeof platesPerSide[0]['plate'][] = [];
  platesPerSide.forEach((item) => {
    for (let i = 0; i < item.count; i++) {
      loadedPlates.push(item.plate);
    }
  });

  return (
    <View className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 my-2">
      {/* Weight Summary Header */}
      <View className="flex-row items-center justify-between mb-3 border-b border-zinc-850 pb-2.5">
        <View>
          <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
            Loaded Weight
          </Text>
          <View className="flex-row items-baseline space-x-1.5 mt-0.5">
            <Text className="text-2xl font-black text-white">{totalCalculatedWeight}</Text>
            <Text className="text-xs font-bold text-accent-cyan">kg total</Text>
          </View>
        </View>

        <View className="items-end">
          <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
            Per Side ({barWeight}kg Bar)
          </Text>
          <Text className="text-base font-extrabold text-cyan-300 mt-0.5">
            +{weightPerSide} kg
          </Text>
        </View>
      </View>

      {/* Remainder Warning Banner if uneven target entered */}
      {remainderKg > 0 && (
        <View className="bg-amber-500/10 border border-amber-500/40 rounded-xl px-3 py-1.5 mb-3 flex-row items-center space-x-2">
          <Text className="text-amber-400 font-bold text-xs">⚠️</Text>
          <Text className="text-amber-300 text-xs font-semibold flex-1">
            {remainderKg} kg remaining (cannot match exactly with 1.25kg increments).
          </Text>
        </View>
      )}

      {/* Horizontal Barbell Sleeve Visual Graphic */}
      <View
        style={{ height: maxVisualHeight }}
        className="w-full justify-center items-center relative overflow-hidden bg-zinc-900/80 rounded-xl border border-zinc-800/80 my-1"
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            alignItems: 'center',
            paddingHorizontal: 16,
            minWidth: '100%',
            justifyContent: 'center',
          }}
        >
          {/* Barbell Center Shaft (Metallic Chrome) */}
          <View
            style={{ height: 18, width: 40 }}
            className="bg-zinc-600 rounded-l-sm border-y border-l border-zinc-400 justify-center items-center shadow-inner"
          >
            <View style={{ height: 2, width: '100%' }} className="bg-zinc-300/40" />
          </View>

          {/* Barbell Inside Stopper Collar Ring */}
          <View
            style={{ height: maxVisualHeight * 0.76, width: 14 }}
            className="bg-zinc-400 border border-zinc-300 rounded-sm mx-0.5 justify-center items-center shadow-md"
          >
            <View style={{ height: '70%', width: 2 }} className="bg-zinc-600/60 rounded" />
          </View>

          {/* Loaded Plates Stack (Inside -> Out) */}
          {loadedPlates.length === 0 ? (
            <View className="px-6 py-2">
              <Text className="text-zinc-500 text-xs font-semibold italic">
                Empty Bar ({barWeight} kg)
              </Text>
            </View>
          ) : (
            loadedPlates.map((plate, index) => {
              const plateHeight = maxVisualHeight * plate.heightRatio;
              return (
                <View
                  key={`plate-${index}`}
                  style={{
                    height: plateHeight,
                    width: plate.widthRatio,
                    backgroundColor: plate.color,
                    borderColor: plate.borderColor,
                  }}
                  className="rounded-md border mx-0.5 justify-between items-center py-1.5 shadow-lg relative"
                >
                  {/* Subtle inner plate bevel groove */}
                  <View
                    style={{ height: 3, width: '70%' }}
                    className="bg-white/25 rounded-full"
                  />
                  <Text
                    style={{
                      color: plate.textColor,
                      fontSize: plate.weight >= 10 ? 11 : 9,
                      transform: [{ rotate: '-90deg' }],
                    }}
                    className="font-black tracking-tighter"
                  >
                    {plate.weight}
                  </Text>
                  <View
                    style={{ height: 3, width: '70%' }}
                    className="bg-black/25 rounded-full"
                  />
                </View>
              );
            })
          )}

          {/* Barbell Sleeve Extending Outwards */}
          <View
            style={{ height: 20, width: Math.max(35, 90 - loadedPlates.length * 10) }}
            className="bg-zinc-500 border-y border-r border-zinc-300 rounded-r-md justify-center items-center relative"
          >
            <View style={{ height: 2, width: '90%' }} className="bg-zinc-200/50" />
          </View>
        </ScrollView>
      </View>

      {/* Plate Count Badges Breakdown */}
      <View className="mt-3">
        <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-2">
          Plates Needed (Each Side)
        </Text>
        {platesPerSide.length === 0 ? (
          <Text className="text-xs text-zinc-500 font-medium italic">
            Just lift the barbell ({barWeight} kg). No plates needed.
          </Text>
        ) : (
          <View className="flex-row flex-wrap gap-2">
            {platesPerSide.map((item) => (
              <View
                key={item.plate.weight}
                style={{ borderColor: item.plate.borderColor }}
                className="bg-zinc-900 border px-2.5 py-1.5 rounded-xl flex-row items-center space-x-1.5"
              >
                <View
                  style={{ backgroundColor: item.plate.color }}
                  className="w-3 h-3 rounded-full border border-black/30"
                />
                <Text className="text-white font-black text-xs">
                  {item.count} × {item.plate.label}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
};

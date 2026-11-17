import React from 'react';
import {View,Text,TouchableOpacity,Linking} from 'react-native';
const root=process.env.EXPO_PUBLIC_LEGAL_SITE_URL || 'https://ripped-fitness-support.louanmarx.chatgpt.site';
export function AccountConsent({accepted,onChange}:{accepted:boolean;onChange:(value:boolean)=>void}){
 return <View className="my-3 gap-2">
  <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{checked:accepted}} onPress={()=>onChange(!accepted)} className="min-h-[48px] flex-row items-center gap-3">
   <View className={`w-7 h-7 border rounded items-center justify-center ${accepted?'bg-cyan-500 border-cyan-400':'border-zinc-400'}`}><Text className="text-black font-bold">{accepted?'✓':''}</Text></View>
   <Text className="text-sm text-zinc-200 flex-1">I’m 18 or older, agree to the terms, and understand that my signed-in fitness data is stored and synced using Firebase.</Text>
  </TouchableOpacity>
  <View className="flex-row flex-wrap gap-4">
   {[['Privacy policy','privacy.html'],['Terms of use','terms.html']].map(([label,path])=><TouchableOpacity key={path} accessibilityRole="link" className="min-h-[48px] justify-center" onPress={()=>{void Linking.openURL(`${root}/${path}`);}}><Text className="text-sm font-bold text-cyan-300">{label}</Text></TouchableOpacity>)}
  </View>
 </View>;
}

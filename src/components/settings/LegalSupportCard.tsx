import React,{useState} from 'react';
import {View,Text,TouchableOpacity,Linking,Modal,TextInput,ScrollView,Alert,Platform} from 'react-native';
import {useUserWorkspace} from '../../context/UserWorkspaceContext';
import {deleteCurrentAccount} from '../../services/authService';
import {restorePurchases,refreshPaidAccess} from '../../services/inAppPurchaseService';
const SITE=process.env.EXPO_PUBLIC_LEGAL_SITE_URL || 'https://ripped-fitness-support.louanmarx.chatgpt.site';
export function LegalSupportCard(){
 const {firebaseUser}=useUserWorkspace();const [deleting,setDeleting]=useState(false);const [password,setPassword]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const open=(url:string)=>{void Linking.openURL(url).catch(()=>Alert.alert('Could not open page','Try again when you have an internet connection.'));};
 return <View className="bg-zinc-900 border border-zinc-700 rounded-2xl p-4 mb-5">
  <Text accessibilityRole="header" className="text-lg font-bold text-white mb-2">Privacy & support</Text>
  {[['Privacy policy','privacy.html'],['Terms of use','terms.html'],['Help & support','support.html'],['Account deletion information','delete-account.html']].map(([title,path])=><TouchableOpacity key={path} accessibilityRole="link" onPress={()=>open(`${SITE}/${path}`)} className="min-h-[48px] justify-center"><Text className="text-base text-cyan-300">{title}</Text></TouchableOpacity>)}
  <TouchableOpacity accessibilityRole="button" onPress={async()=>{const result=await restorePurchases();Alert.alert(result.success?'Purchases checked':'Could not restore',result.error||(result.access?'Your active store subscription has been verified. Reopen the app to refresh plan access.':'No active subscription was found.'));}} className="min-h-[48px] justify-center"><Text className="text-base text-cyan-300">Restore purchases</Text></TouchableOpacity>
  <TouchableOpacity accessibilityRole="link" onPress={()=>open(Platform.OS==='ios'?'https://apps.apple.com/account/subscriptions':'https://play.google.com/store/account/subscriptions')} className="min-h-[48px] justify-center"><Text className="text-base text-cyan-300">Manage store subscriptions</Text></TouchableOpacity>
  {!!firebaseUser&&!firebaseUser.isAnonymous&&<TouchableOpacity accessibilityRole="button" onPress={()=>{setPassword('');setError('');setDeleting(true);}} className="min-h-[48px] justify-center"><Text className="text-base font-bold text-rose-300">Delete my account</Text></TouchableOpacity>}
  <Modal visible={deleting} transparent animationType="slide" onRequestClose={()=>{if(!busy)setDeleting(false);}}><View className="flex-1 bg-black/90 justify-center p-5"><ScrollView contentContainerStyle={{flexGrow:1,justifyContent:'center'}} keyboardShouldPersistTaps="handled"><View className="bg-zinc-900 border border-zinc-700 p-5 rounded-2xl gap-4">
    <Text accessibilityRole="header" className="text-xl font-bold text-white">Permanently delete your account?</Text>
    <Text className="text-base text-zinc-200">This removes your account, cloud workouts, nutrition, measurements, coach links and this account’s local data. Copies you deliberately shared with other people may remain with them. This cannot be undone.</Text>
    <Text className="text-base text-amber-200">Deleting your account does not cancel an Apple or Google subscription. Cancel it in store subscription settings first to avoid further charges.</Text>
    <Text className="text-sm text-zinc-300">Confirm the password for {firebaseUser?.email}.</Text>
    <TextInput accessibilityLabel="Account password for deletion" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} editable={!busy} className="bg-zinc-950 text-white border border-zinc-600 rounded-xl p-3 min-h-[48px]" />
    {!!error&&<Text accessibilityRole="alert" className="text-base text-rose-300">{error}</Text>}
    <TouchableOpacity accessibilityRole="button" disabled={busy||!password} onPress={async()=>{setBusy(true);setError('');try{await deleteCurrentAccount(password);setDeleting(false);setPassword('');}catch(e){setError((e as Error).message||'Deletion has not completed. Please retry.');}finally{setBusy(false);}}} className="min-h-[48px] bg-rose-700 rounded-xl justify-center items-center p-3"><Text className="text-base font-bold text-white">{busy?'Deleting…':'Permanently delete account'}</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={()=>setDeleting(false)} className="min-h-[48px] items-center justify-center"><Text className="text-base text-white">Keep my account</Text></TouchableOpacity>
  </View></ScrollView></View></Modal>
 </View>;
}

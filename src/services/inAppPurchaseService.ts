import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { PurchasesStoreProduct } from 'react-native-purchases';
import { auth } from '../config/firebase';
import { TrainerSubscriptionTier, TIER_CONFIGS, TrainerSubscription } from '../types/trainer';
import { callSecureBackend } from './secureBackend';
export type BillingPlan = TrainerSubscriptionTier | 'athlete';
export interface VerifiedAccess { tier: BillingPlan; expiresAt: number; seatLimit: number }
export interface PurchaseResult { success: boolean; tier?: TrainerSubscriptionTier; subscription?: TrainerSubscription; access?: VerifiedAccess | null; error?: string; isCancelled?: boolean }
let configuredUser: string | null = null;
let transition: Promise<unknown> = Promise.resolve();
async function billing() {
  if (Platform.OS === 'web' || Constants.appOwnership === 'expo') throw new Error('Real purchases require a store or development build. Expo Go can still test workouts and the UI.');
  const uid=auth.currentUser?.uid;
  if(!uid||auth.currentUser?.isAnonymous)throw new Error('Sign in before purchasing or restoring a subscription.');
  const key=Platform.OS==='ios'?process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY:process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
  if(!key || key.startsWith('test_')) throw new Error('Store billing is not configured for this build. No purchase was made.');
  // Load only after the Expo Go guard. Never activate RevenueCat preview/simulated purchases.
  const SDK=(await import('react-native-purchases')).default;
  if(!configuredUser){SDK.configure({apiKey:key,appUserID:uid});configuredUser=uid;}
  else if(configuredUser!==uid){await SDK.logIn(uid);configuredUser=uid;}
  if(auth.currentUser?.uid!==uid)throw new Error('Your account changed. Try again.');
  return {SDK,uid};
}
function exclusive<T>(fn:()=>Promise<T>):Promise<T>{const next=transition.then(fn);transition=next.catch(()=>{});return next;}
function productId(plan:BillingPlan){return plan==='athlete'?(Platform.OS==='ios'?'com.ripped.athlete.monthly':'ripped_athlete_monthly'):(Platform.OS==='ios'?TIER_CONFIGS[plan].productIdIos:TIER_CONFIGS[plan].productIdAndroid);}
export async function getStoreProducts():Promise<Partial<Record<BillingPlan,PurchasesStoreProduct>>>{
  return exclusive(async()=>{
    const {SDK,uid}=await billing();
    const plans:BillingPlan[]=['athlete','starter','standard','pro','studio'];
    const products=await SDK.getProducts(plans.map(productId),SDK.PRODUCT_CATEGORY.SUBSCRIPTION);
    if(auth.currentUser?.uid!==uid)throw new Error('Your account changed.');
    return Object.fromEntries(plans.flatMap(plan=>{const p=products.find(p=>p.identifier.split(':')[0]===productId(plan));return p?[[plan,p]]:[];}));
  });
}
export async function refreshPaidAccess():Promise<VerifiedAccess|null>{
  const uid=auth.currentUser?.uid;
  const response=await callSecureBackend<{access:VerifiedAccess|null}>('refreshStoreEntitlements');
  if(!uid||uid!==auth.currentUser?.uid)throw new Error('Your account changed.');
  return response.access;
}
export function requestSubscriptionPurchase(plan:BillingPlan):Promise<PurchaseResult>{
  return exclusive(async()=>{try{
    const {SDK,uid}=await billing();
    const products=await SDK.getProducts([productId(plan)],SDK.PRODUCT_CATEGORY.SUBSCRIPTION);
    const product=products.find(p=>p.identifier.split(':')[0]===productId(plan));
    if(!product)throw new Error('This subscription is not available in the store. No purchase was made.');
    const info=await SDK.getCustomerInfo();
    const supported:BillingPlan[]=['athlete','starter','standard','pro','studio'];
    const previous=info.activeSubscriptions.filter(id=>supported.some(plan=>productId(plan)===id.split(':')[0]));
    if(previous.length>1)throw new Error('More than one store subscription is active. Manage subscriptions in your store before changing plans.');
    if(!previous.some(id=>id.split(':')[0]===productId(plan))){
      await SDK.purchaseStoreProduct(product,Platform.OS==='android'&&previous[0]?{oldProductIdentifier:previous[0]}:null);
    }
    if(auth.currentUser?.uid!==uid)throw new Error('Your account changed. Restore purchases after signing back in.');
    const access=await refreshPaidAccess();
    if(!access||access.tier!==plan)throw new Error('The store transaction is awaiting verification or a scheduled plan change. Use Restore purchases to check it again.');
    return {success:true,access,...(plan!=='athlete'?{tier:plan}: {})};
  }catch(error){return {success:false,isCancelled:Boolean((error as {userCancelled?:boolean}).userCancelled),error:(error as Error).message};}});
}
export function restorePurchases():Promise<PurchaseResult>{
  return exclusive(async()=>{try{const {SDK,uid}=await billing();await SDK.restorePurchases();if(auth.currentUser?.uid!==uid)throw new Error('Your account changed.');const access=await refreshPaidAccess();return {success:true,access};}catch(error){return {success:false,error:(error as Error).message};}});
}

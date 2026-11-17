import { useUserWorkspace } from '../../context/UserWorkspaceContext';
import { publishClientClaimCloud } from '../../services/clientClaimService';
import { saveClientsCloud } from '../../services/firestoreService';
import { callSecureBackend } from '../../services/secureBackend';
import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Share,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ClientProfile, ClientClaimToken } from '../../types/trainer';
import { QRCodeView } from '../QRCodeView';

interface ClaimClientModalProps {
  visible: boolean;
  onClose: () => void;
  client: ClientProfile | null;
  coachName: string;
  onGenerateToken: (clientId: string, force?: boolean) => ClientClaimToken | null;
}

export const ClaimClientModal: React.FC<ClaimClientModalProps> = ({
  visible,
  onClose,
  client,
  coachName,
  onGenerateToken,
}) => {
  const [token, setToken] = useState<ClientClaimToken | null>(null);
  const {currentUser,clients}=useUserWorkspace();
  const [published,setPublished]=useState('');
  const [publishing,setPublishing]=useState(false);
  const [publishError,setPublishError]=useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (visible && client) {
      const generated = onGenerateToken(client.id);
      setToken(generated || client.claimToken || null);
      setCopied(false);setPublished('');setPublishError('');
    }
  }, [visible, client?.id]);

  if (!client) return null;

  const handleCopyCode = async () => {
    if (!token || published!==token.code) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(token.code);
      } catch {}
    } else {
      try {
        await Share.share({
          message: token.code,
          title: 'Claim PIN',
        });
      } catch {}
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShareInvite = async () => {
    if (!token || published!==token.code) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const message = [
      `🏋️ Hey ${client.name}!`,
      `Your coach ${coachName} has prepared your training routines and nutrition goals on RIPPED.`,
      ``,
      `📲 Claim your account and train 100% free:`,
      `1. Download the RIPPED app`,
      `2. Choose "Client (Free VIP Pass)" on sign up`,
      `3. Enter Invite PIN: ${token.code}`,
      ``,
      `Training history can transfer securely after you accept the invitation.`,
    ].join('\n');

    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: `RIPPED Invite for ${client.name}`,
          text: message,
        });
      } else {
        await Share.share({
          message,
          title: `RIPPED Invite for ${client.name}`,
        });
      }
    } catch {
      await handleCopyCode();
      Alert.alert('Invite Copied', 'Invite message copied to clipboard!');
    }
  };

  const handleRegenerate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const generated = onGenerateToken(client.id, true);
    setPublished('');setPublishError('');setToken(generated);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/85 justify-end">
        <View className="bg-dark-card border-t border-dark-border rounded-t-3xl p-5 max-h-[92%] shadow-2xl">
          {/* Header */}
          <View className="flex-row items-center justify-between pb-3 border-b border-zinc-800">
            <View className="flex-row items-center space-x-2.5 flex-1 min-w-0 mr-2">
              <View className="w-9 h-9 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 items-center justify-center shrink-0">
                <Ionicons name="qr-code" size={18} color="#06B6D4" />
              </View>
              <View className="flex-1 min-w-0">
                <Text className="text-base font-black text-white" numberOfLines={1}>
                  Claim Client Account
                </Text>
                <Text className="text-[11px] text-zinc-400 font-semibold" numberOfLines={1}>
                  Invite {client.name} to Download & Sync RIPPED
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              className="w-8 h-8 rounded-full bg-zinc-850 items-center justify-center border border-zinc-700 shrink-0"
            >
              <Ionicons name="close" size={18} color="#A1A1AA" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} className="py-3">
            {/* Client Pill */}
            <View className="flex-row items-center bg-zinc-900 border border-zinc-800 rounded-2xl p-3 mb-4">
              <View className="w-10 h-10 rounded-xl bg-zinc-850 border border-zinc-750 items-center justify-center mr-3">
                <Text className="text-xl">{client.avatarEmoji}</Text>
              </View>
              <View className="flex-1 min-w-0">
                <Text className="text-sm font-black text-white" numberOfLines={1}>
                  {client.name}
                </Text>
                <Text className="text-xs text-amber-400 font-bold" numberOfLines={1}>
                  Type A: In-Person Shadow Profile
                </Text>
              </View>
              <View className="bg-amber-500/20 border border-amber-500/40 px-2.5 py-1 rounded-full">
                <Text className="text-[10px] font-black text-amber-300 uppercase">Unclaimed</Text>
              </View>
            </View>

            {/* QR Code Container */}
            <View className="items-center justify-center bg-zinc-950 border border-zinc-800 rounded-3xl p-5 mb-4 shadow-inner">
              {token && published===token.code ? (
                <View className="items-center">
                  <QRCodeView value={token.qrPayload || token.code} size={180} />
                  <Text className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mt-3">
                    Scan with RIPPED App or Camera
                  </Text>
                </View>
              ) : null}

              {/* Big PIN Box */}
              <View className="w-full bg-zinc-900 border border-zinc-750 rounded-2xl p-3.5 mt-4 flex-row items-center justify-between">
                <View>
                  <Text className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                    Private trainer invitation
                  </Text>
                  <Text className="text-sm font-black text-accent-cyan flex-shrink mt-0.5">
                    {published===token?.code?token?.code:'Not activated'}
                  </Text>
                </View>

                <TouchableOpacity
                  disabled={!token||published!==token.code} onPress={handleCopyCode}
                  className="bg-cyan-500/20 border border-cyan-500/50 px-3.5 py-2 rounded-xl flex-row items-center space-x-1.5"
                >
                  <Ionicons
                    name={copied ? 'checkmark' : 'copy-outline'}
                    size={15}
                    color="#06B6D4"
                  />
                  <Text className="text-xs font-black text-cyan-300">
                    {copied ? 'Copied!' : 'Copy'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity accessibilityRole="button" disabled={publishing||!token} className="min-h-[48px] bg-cyan-500 rounded-xl items-center justify-center p-3 mb-3" onPress={async()=>{
              if(!token)return;setPublishing(true);setPublishError('');const code=token.code;
              try{await saveClientsCloud(currentUser.id,clients);await callSecureBackend('registerShadowClient',{clientId:client.id});await publishClientClaimCloud(token,client,currentUser.id,coachName);setPublished(code);}catch(error){setPublishError((error as Error).message);}finally{setPublishing(false);}
            }}><Text className="font-bold text-black">{publishing?'Activating…':published===token?.code?'Invitation active':'Activate secure invitation'}</Text></TouchableOpacity>
            {!!publishError&&<Text accessibilityRole="alert" className="text-sm text-rose-300 mb-3">{publishError}</Text>}
            {/* Migration & Feature Guarantees */}
            <View className="bg-zinc-900/80 border border-zinc-850 rounded-2xl p-4 mb-4 space-y-2.5">
              <Text className="text-xs font-black text-zinc-300 uppercase tracking-wider mb-1">
                Zero-Friction Client Migration
              </Text>
              <View className="flex-row items-start space-x-2">
                <Ionicons name="cloud-done" size={15} color="#10B981" style={{ marginTop: 1 }} />
                <Text className="text-xs text-zinc-300 flex-1 leading-relaxed">
                  <Text className="font-bold text-white">Full History Transfers:</Text> Training records transfer securely after your athlete accepts. Existing athlete records are preserved.
                </Text>
              </View>
              <View className="flex-row items-start space-x-2">
                <Ionicons name="sync" size={15} color="#06B6D4" style={{ marginTop: 1 }} />
                <Text className="text-xs text-zinc-300 flex-1 leading-relaxed">
                  <Text className="font-bold text-white">Real-Time Sync:</Text> As they log their workouts and meals, their data will sync right back to your Coach Roster.
                </Text>
              </View>
              <View className="flex-row items-start space-x-2">
                <Ionicons name="gift" size={15} color="#F59E0B" style={{ marginTop: 1 }} />
                <Text className="text-xs text-zinc-300 flex-1 leading-relaxed">
                  <Text className="font-bold text-white">Athlete Trains Free:</Text> Your athlete gets full premium logging sponsored under your Trainer Seat plan.
                </Text>
              </View>
            </View>

            {/* Actions */}
            <View className="space-y-2.5 mb-4">
              <TouchableOpacity
                disabled={!token||published!==token.code} onPress={handleShareInvite}
                className="w-full bg-accent-cyan py-3.5 rounded-xl flex-row items-center justify-center space-x-2 shadow-lg shadow-cyan-500/20"
              >
                <Ionicons name="share-social" size={17} color="#09090B" />
                <Text className="text-black font-black text-sm">
                  Share Invite via WhatsApp / SMS
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleRegenerate}
                className="w-full py-2.5 items-center justify-center flex-row space-x-1"
              >
                <Ionicons name="refresh" size={13} color="#71717A" />
                <Text className="text-zinc-500 font-bold text-xs">Regenerate Invite PIN</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

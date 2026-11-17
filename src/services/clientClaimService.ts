import 'react-native-get-random-values';
import { ClientProfile, ClientClaimToken } from '../types/trainer';
import { UserProfile, WorkoutLog, NutritionLog, BodyMetric, Split } from '../types';
import { MacroTargets } from '../types';
import { PrescribedMealArchetype } from '../types/trainer';
import { callSecureBackend } from './secureBackend';

export interface ClientClaimCloudRecord {
  code: string;               // e.g. "RIP-347K"
  rawPin: string;             // e.g. "347K"
  coachId: string;
  coachName: string;
  coachBusiness?: string;
  coachInstagram?: string;
  clientId: string;
  clientName: string;
  clientEmail?: string;
  macroTargets?: MacroTargets;
  prescribedArchetypes?: PrescribedMealArchetype[];
  assignedSplitName?: string;
  assignedRoutineIds?: string[];
  assignedRoutineNames?: string[];
  initialWorkouts?: WorkoutLog[];
  initialNutrition?: NutritionLog[];
  initialBodyMetrics?: BodyMetric[];
  initialSplits?: Split[];
  createdAt: number;
  expiresAt: number;
  claimed: boolean;
  claimedByUserId?: string | null;
  claimedAt?: number | null;
  athleteName?: string;
  athleteEmail?: string;
}

export function normalizeClaimCode(raw: string): { standardCode: string; pinOnly: string } {
  let clean = (raw || '').trim().toUpperCase();

  // Check if input is a JSON string from a scanned QR payload
  if (clean.startsWith('{') && (clean.includes('RIPPED_CLIENT_CLAIM') || clean.includes('PUMPD_CLIENT_CLAIM'))) {
    try {
      const parsed = JSON.parse(raw.trim());
      if (parsed.code) clean = parsed.code.toUpperCase();
    } catch {
      // Continue with raw input
    }
  }

  // Remove any spaces or symbols, keeping only alphanumeric characters
  const alphanumeric = clean.replace(/[^A-Z0-9]/g, '');
  let pinOnly = alphanumeric;
  if (pinOnly.startsWith('RIPPED')) pinOnly = pinOnly.slice(6);
  else if (pinOnly.startsWith('RIP')) pinOnly = pinOnly.slice(3);
  else if (pinOnly.startsWith('PUMP')) pinOnly = pinOnly.slice(4);

  const standardCode = `RIP-${pinOnly}`;

  return { standardCode, pinOnly };
}


export function generateClaimToken(client: ClientProfile, coachName: string): ClientClaimToken {
  const bytes = new Uint8Array(12); crypto.getRandomValues(bytes);
  const code = `RIP-${Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  return { code, expiresAt: Date.now() + 86400000, qrPayload: JSON.stringify({ type: 'RIPPED_CLIENT_CLAIM', code }) };
}
export async function publishClientClaimCloud(token: ClientClaimToken, client: ClientProfile, coachUserId: string, coachName: string,
  coachProfile?: Partial<{ businessName: string; instagramHandle: string }>, allWorkouts: WorkoutLog[] = [], allNutrition: NutritionLog[] = [], allBodyMetrics: BodyMetric[] = [], allSplits: Split[] = []): Promise<void> {
  await callSecureBackend('publishCoachInvitation', { code: token.code, clientId: client.id });
}
export async function lookupClientClaimCloud(rawInput: string): Promise<ClientClaimCloudRecord | null> {
  return callSecureBackend<ClientClaimCloudRecord>('previewCoachInvitation', { code: normalizeClaimCode(rawInput).standardCode });
}
export async function executeClientClaimCloud(claimRecord: ClientClaimCloudRecord, athleteUser: UserProfile): Promise<void> {
  await callSecureBackend('redeemCoachInvitation', { code: claimRecord.code });
}

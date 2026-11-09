import type { AdventureCampaignDefinition, CampaignId } from '../types'
import { FORGE_OF_THE_IRON_TITAN_CAMPAIGN } from './forgeOfTheIronTitan'
import { SUNKEN_RELIQUARY_CAMPAIGN } from './sunkenReliquary'
import { VOIDSPIRE_BASTION_CAMPAIGN } from './voidspireBastion'
import { WHISPERING_CANOPY_CAMPAIGN } from './whisperingCanopy'

export const ADVENTURE_CAMPAIGNS: Record<CampaignId, AdventureCampaignDefinition> = {
  'sunken-reliquary': SUNKEN_RELIQUARY_CAMPAIGN,
  'forge-of-the-iron-titan': FORGE_OF_THE_IRON_TITAN_CAMPAIGN,
  'whispering-canopy': WHISPERING_CANOPY_CAMPAIGN,
  'voidspire-bastion': VOIDSPIRE_BASTION_CAMPAIGN,
}

export const ADVENTURE_CAMPAIGN_LIST: AdventureCampaignDefinition[] = [
  SUNKEN_RELIQUARY_CAMPAIGN,
  FORGE_OF_THE_IRON_TITAN_CAMPAIGN,
  WHISPERING_CANOPY_CAMPAIGN,
  VOIDSPIRE_BASTION_CAMPAIGN,
]

export function getAdventureCampaign(campaignId: CampaignId): AdventureCampaignDefinition {
  return ADVENTURE_CAMPAIGNS[campaignId] ?? SUNKEN_RELIQUARY_CAMPAIGN
}

export function isAdventureMediaUrl(url: string | undefined | null): boolean {
  if (!url) return false
  return url.trim().toLowerCase().startsWith('quest://')
}

export function parseCampaignIdFromQuestUrl(url: string | undefined | null): CampaignId {
  if (!url) return 'sunken-reliquary'
  const raw = url.trim().toLowerCase().replace(/^quest:\/\//, '').split(/[?#]/)[0]
  if (
    raw === 'sunken-reliquary' ||
    raw === 'forge-of-the-iron-titan' ||
    raw === 'whispering-canopy' ||
    raw === 'voidspire-bastion'
  ) {
    return raw
  }
  return 'sunken-reliquary'
}

export function buildQuestMediaUrl(campaignId: CampaignId): string {
  return `quest://${campaignId}`
}

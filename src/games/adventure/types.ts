export type CampaignId =
  | 'sunken-reliquary'
  | 'forge-of-the-iron-titan'
  | 'whispering-canopy'
  | 'voidspire-bastion'

export type AdventureCampaignId = CampaignId

export type ArchetypeId = 'vanguard' | 'shadow' | 'arcanist' | 'cleric'

export type AdventureArchetypeId = ArchetypeId

export type AttributeKind = 'might' | 'finesse' | 'arcana'

export type SceneTag =
  | 'lock'
  | 'trap'
  | 'chasm'
  | 'combat'
  | 'hazard'
  | 'riddle'
  | 'sanctuary'
  | 'boss'

export type AdventureItemId =
  // Vanguard items
  | 'tower-shield'
  | 'bloodstone-axe'
  | 'warhorn'
  // Shadow items
  | 'smoke-bomb'
  | 'skeleton-key'
  | 'grappling-hook'
  // Arcanist items
  | 'chronos-shard'
  | 'scroll-of-fireball'
  | 'blink-crystal'
  // Cleric items
  | 'phoenix-vial'
  | 'sunburst-chalice'
  | 'aegis-scroll'

export type AdventureAbilityId =
  | 'bulwark-intercept'
  | 'tricksters-edge'
  | 'arcane-sight'
  | 'sacred-blessing'

export type CrucialCheckKind = 'putting' | 'darts' | 'wrist-d20'

export interface ArchetypeSpec {
  id: ArchetypeId
  name: string
  title: string
  icon: string
  color: string
  maxHp: number
  stats: Record<AttributeKind, number>
  abilityId: AdventureAbilityId
  abilityName: string
  abilityDescription: string
  startingItems: AdventureItemId[]
}

export interface AdventureItemSpec {
  id: AdventureItemId
  name: string
  archetype: ArchetypeId
  icon: string
  description: string
}

export interface CrucialSkillCheckSpec {
  kind: CrucialCheckKind
  title: string
  instruction: string
  fallbackDc: number
  targetDescription: string
  successRewardText: string
  failPenaltyText: string
  failHpPenalty: number
  grantsWorldFlag?: string
  exposesBossWeakness?: boolean
}

export interface NarrativeEchoMap {
  fromSuccess?: string
  fromFail?: string
  flags?: Record<string, string>
}

export type FocalArtKind =
  // Sunken Reliquary
  | 'sunken-portcullis'
  | 'weeping-cistern'
  | 'ossuary-catwalk'
  | 'undertow-whirlpool'
  | 'bone-warden-bridge'
  | 'reliquary-vault'
  | 'bone-hydra-maze'
  | 'sunken-bell'
  | 'diving-bell-shrine'
  | 'sluice-gauntlet'
  | 'dread-knights'
  | 'phylactery-chamber'
  | 'soul-vortex'
  | 'lich-throne'
  | 'lich-malakor-unbound'
  // Forge of the Iron Titan
  | 'basalt-lift'
  | 'obsidian-span'
  | 'artificer-armory'
  | 'slag-conveyor'
  | 'steam-labyrinth'
  | 'clockwork-golems'
  | 'cryo-conduit'
  | 'molten-spillway'
  | 'hearth-shrine'
  | 'gear-pendulums'
  | 'foundry-core-gate'
  | 'slag-crucible'
  | 'magma-geyser'
  | 'ignis-awakening'
  | 'iron-titan-finale'
  // Whispering Canopy
  | 'glow-moss-sinkhole'
  | 'poison-spore-vale'
  | 'luminous-sprite-grove'
  | 'silk-funnel-trap'
  | 'glass-fanged-weavers'
  | 'strangler-root-bridge'
  | 'mycelial-memory-pool'
  | 'spore-zombie-hollow'
  | 'starlight-dew-shrine'
  | 'pollen-storm'
  | 'silk-cocoon-prison'
  | 'cleansing-heart-sap'
  | 'blighted-thorns'
  | 'briar-crown-throne'
  | 'dryad-queen-finale'
  // Voidspire Bastion
  | 'shattered-star-dock'
  | 'escher-causeway'
  | 'astrolabe-observatory'
  | 'entropy-asteroid-drift'
  | 'sphinx-automaton'
  | 'fractured-mirrors'
  | 'chronos-archive'
  | 'mind-flayer-conclave'
  | 'event-horizon-shrine'
  | 'inverted-spire'
  | 'glyph-singularity'
  | 'astral-tether'
  | 'reality-collapse'
  | 'apex-xalvorith'
  | 'mind-tyrant-finale'

export interface AdventureActionCard {
  id: string
  title: string
  description: string
  attribute: AttributeKind
  dc: number
  tags: SceneTag[]
  failPenaltyText: string
  failHpDamage: number
  successBonusText: string
  healOnSuccess?: number
  grantsWorldFlag?: string
  reducesBossDc?: number
}

export interface AdventureSceneNode {
  id: string
  stageNumber: number // 1..12
  act: 1 | 2 | 3
  title: string
  subtitle: string
  hazardBadge: string
  prose: string
  narrativeEcho: NarrativeEchoMap
  focalArt: FocalArtKind
  isSanctuary?: boolean
  isFinale?: boolean
  scramblesDisplayedDc?: boolean
  crucialSkillCheck?: CrucialSkillCheckSpec
  choices: AdventureActionCard[]
  nextNodeSuccess: string
  nextNodeFail: string
  nextNodeCritical?: string
  criticalGrantsFlag?: string
}

export interface AdventureCampaignDefinition {
  id: CampaignId
  title: string
  subtitle: string
  themeSummary: string
  accentColor: string
  secondaryColor: string
  startNodeId: string
  bossName: string
  nodes: Record<string, AdventureSceneNode>
}

export interface AdventurePlayerState {
  userId: string
  displayName: string
  avatarColor: string
  archetype: ArchetypeId
  hp: number
  maxHp: number
  isGhost: boolean
  tetheredToUserId: string | null
  spectralRoll: number | null
  spectralBonusGranted: number
  spectralShieldGranted: boolean
  items: AdventureItemId[]
  abilityUsedInAct: number | null
  hoveredCardId: string | null
  lockedCardId: string | null
  autoPassReason: string | null
  damageShieldedBy: string | null
  blessingBonus: number
  undeadConsecratedBonus: number
  d20Roll: number | null
  totalRoll: number | null
  rollOutcome: 'pending' | 'success' | 'critical' | 'fail' | 'bypassed'
}

export type AdventureQuestPhase =
  | 'lobby'
  | 'choosing'
  | 'crucial-check'
  | 'rolling'
  | 'resolution'
  | 'victory'
  | 'defeat'

export interface ActiveCrucialCheckState {
  active: boolean
  kind: CrucialCheckKind
  title: string
  instruction: string
  targetDescription: string
  fallbackDc: number
  startedAt: number
  durationSec: number
  designatedUserId: string | null
  designatedName: string | null
  resolved: boolean
  outcome: 'pending' | 'success' | 'critical' | 'fail'
  rollValue: number | null
  summaryText: string
}

export interface AdventureDiceShowcase {
  rollerName: string
  archetype: ArchetypeId
  d20: number
  modifier: number
  total: number
  dc: number
  outcome: 'success' | 'critical' | 'fail' | 'spectral'
  timestamp: number
}

export interface AdventureQuestState {
  revision: number
  updatedAt: number
  campaignId: CampaignId
  phase: AdventureQuestPhase
  currentNodeId: string
  previousNodeId: string | null
  lastTransitionOutcome: 'start' | 'success' | 'fail' | 'critical'
  worldFlags: string[]
  threatLevel: number // 0..10
  bossWeaknessExposed: boolean
  bossDcReduction: number
  bossHpReduced: boolean
  arcaneSightActive: boolean
  aegisScrollActive: boolean
  warhornBonusActive: boolean
  towerShieldActive: boolean
  players: Record<string, AdventurePlayerState>
  partySuccessPoints: number
  requiredSuccessPoints: number
  crucialCheck: ActiveCrucialCheckState | null
  lastResolutionLog: string[]
  lastDiceShowcase: AdventureDiceShowcase | null
  combatShakeAt: number
  triumphBurstAt: number
}

export const ARCHETYPE_SPECS: Record<ArchetypeId, ArchetypeSpec> = {
  vanguard: {
    id: 'vanguard',
    name: 'Vanguard',
    title: 'Oathbound Bastion',
    icon: '🛡️',
    color: '#F59E0B',
    maxHp: 12,
    stats: { might: 3, finesse: 1, arcana: 0 },
    abilityId: 'bulwark-intercept',
    abilityName: 'Bulwark Intercept',
    abilityDescription:
      'Absorb a teammate’s failed-roll damage onto your heavy plate armor (reducing it by 1).',
    startingItems: ['tower-shield', 'bloodstone-axe', 'warhorn'],
  },
  shadow: {
    id: 'shadow',
    name: 'Shadow',
    title: 'Veilblade Saboteur',
    icon: '🗡️',
    color: '#10B981',
    maxHp: 9,
    stats: { might: 0, finesse: 3, arcana: 1 },
    abilityId: 'tricksters-edge',
    abilityName: "Trickster's Edge",
    abilityDescription:
      'Automatically bypass a Lock/Trap check or force an immediate D20 re-roll with +2 Finesse.',
    startingItems: ['smoke-bomb', 'skeleton-key', 'grappling-hook'],
  },
  arcanist: {
    id: 'arcanist',
    name: 'Arcanist',
    title: 'Astral Chronomancer',
    icon: '🔮',
    color: '#8B5CF6',
    maxHp: 8,
    stats: { might: 0, finesse: 1, arcana: 3 },
    abilityId: 'arcane-sight',
    abilityName: 'Arcane Sight',
    abilityDescription:
      'Reveal all hidden DCs, true unscrambled numbers, and failure penalties on every card before lock-in.',
    startingItems: ['chronos-shard', 'scroll-of-fireball', 'blink-crystal'],
  },
  cleric: {
    id: 'cleric',
    name: 'Cleric',
    title: 'Dawnfire Hierophant',
    icon: '✨',
    color: '#38BDF8',
    maxHp: 10,
    stats: { might: 1, finesse: 0, arcana: 3 },
    abilityId: 'sacred-blessing',
    abilityName: 'Sacred Blessing',
    abilityDescription:
      'Grant +3 to an ally’s D20 roll AND restore 2 HP to the most wounded living party member.',
    startingItems: ['phoenix-vial', 'sunburst-chalice', 'aegis-scroll'],
  },
}

export const ADVENTURE_ITEM_SPECS: Record<AdventureItemId, AdventureItemSpec> = {
  'tower-shield': {
    id: 'tower-shield',
    name: 'Tower Shield',
    archetype: 'vanguard',
    icon: '🛡️',
    description: 'Negate all party HP damage for one entire scene.',
  },
  'bloodstone-axe': {
    id: 'bloodstone-axe',
    name: 'Bloodstone Axe',
    archetype: 'vanguard',
    icon: '🪓',
    description: 'Automatically pass one Might check with critical force.',
  },
  warhorn: {
    id: 'warhorn',
    name: 'Warhorn',
    archetype: 'vanguard',
    icon: '📯',
    description: 'Grant +2 to every living player’s D20 roll this scene.',
  },
  'smoke-bomb': {
    id: 'smoke-bomb',
    name: 'Smoke Bomb',
    archetype: 'shadow',
    icon: '💨',
    description: 'Shroud a player so they take zero damage if their check fails.',
  },
  'skeleton-key': {
    id: 'skeleton-key',
    name: 'Skeleton Key',
    archetype: 'shadow',
    icon: '🗝️',
    description: 'Unlock any sealed chest, sluice, or door ([LOCK]) without rolling.',
  },
  'grappling-hook': {
    id: 'grappling-hook',
    name: 'Grappling Hook',
    archetype: 'shadow',
    icon: '🪝',
    description: 'Bypass one chasm, bridge gap, or climb hazard ([CHASM]) automatically.',
  },
  'chronos-shard': {
    id: 'chronos-shard',
    name: 'Chronos Shard',
    archetype: 'arcanist',
    icon: '⏳',
    description: 'Rewind time to re-roll a failed D20 with an automatic +4 bonus (or auto-pass).',
  },
  'scroll-of-fireball': {
    id: 'scroll-of-fireball',
    name: 'Scroll of Fireball',
    archetype: 'arcanist',
    icon: '🔥',
    description: 'Incinerate enemies for +2 automatic Party Success Points in combat.',
  },
  'blink-crystal': {
    id: 'blink-crystal',
    name: 'Blink Crystal',
    archetype: 'arcanist',
    icon: '💎',
    description: 'Teleport past one environmental trap or hazard ([TRAP]/[HAZARD]) unscathed.',
  },
  'phoenix-vial': {
    id: 'phoenix-vial',
    name: 'Phoenix Vial',
    archetype: 'cleric',
    icon: '🧪',
    description: 'Revive one Spectral Ghost player to 4 HP (or heal a living player +4 HP).',
  },
  'sunburst-chalice': {
    id: 'sunburst-chalice',
    name: 'Sunburst Chalice',
    archetype: 'cleric',
    icon: '🏆',
    description: 'Heal every living party member for +3 HP immediately.',
  },
  'aegis-scroll': {
    id: 'aegis-scroll',
    name: 'Aegis Scroll',
    archetype: 'cleric',
    icon: '📜',
    description: 'Reduce all action DCs in the current scene by 3 for one turn.',
  },
}

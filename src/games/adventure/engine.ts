import {
  ADVENTURE_ITEM_SPECS,
  ARCHETYPE_SPECS,
  type ActiveCrucialCheckState,
  type AdventureActionCard,
  type AdventureItemId,
  type AdventurePlayerState,
  type AdventureQuestState,
  type AdventureSceneNode,
  type ArchetypeId,
  type CampaignId,
} from './types'
import { getAdventureCampaign } from './campaigns'

export interface AdventureUserIdentity {
  userId: string
  displayName: string
  avatarColor: string
}

const ARCHETYPE_ORDER: ArchetypeId[] = ['vanguard', 'shadow', 'arcanist', 'cleric']

function createInitialCrucialCheck(
  node: AdventureSceneNode,
  designatedUser?: AdventureUserIdentity | null,
): ActiveCrucialCheckState | null {
  if (!node.crucialSkillCheck) return null
  const spec = node.crucialSkillCheck
  return {
    active: true,
    kind: spec.kind,
    title: spec.title,
    instruction: spec.instruction,
    targetDescription: spec.targetDescription,
    fallbackDc: spec.fallbackDc,
    startedAt: Date.now(),
    durationSec: 60,
    designatedUserId: designatedUser?.userId ?? null,
    designatedName: designatedUser?.displayName ?? null,
    resolved: false,
    outcome: 'pending',
    rollValue: null,
    summaryText: `Awaiting ${spec.kind === 'putting' ? 'Putting Strip shot' : spec.kind === 'darts' ? 'Dartboard throw' : 'High-Stakes Wrist D20 roll'} (or Couch Fallback D20)...`,
  }
}

export function createPlayerState(
  user: AdventureUserIdentity,
  archetype: ArchetypeId,
): AdventurePlayerState {
  const spec = ARCHETYPE_SPECS[archetype]
  return {
    userId: user.userId,
    displayName: user.displayName,
    avatarColor: user.avatarColor,
    archetype,
    hp: spec.maxHp,
    maxHp: spec.maxHp,
    isGhost: false,
    tetheredToUserId: null,
    spectralRoll: null,
    spectralBonusGranted: 0,
    spectralShieldGranted: false,
    items: [...spec.startingItems],
    abilityUsedInAct: null,
    hoveredCardId: null,
    lockedCardId: null,
    autoPassReason: null,
    damageShieldedBy: null,
    blessingBonus: 0,
    undeadConsecratedBonus: 0,
    d20Roll: null,
    totalRoll: null,
    rollOutcome: 'pending',
  }
}

export function computeRequiredSuccessPoints(
  players: Record<string, AdventurePlayerState>,
): number {
  const livingCount = Object.values(players).filter((p) => !p.isGhost && p.hp > 0).length
  if (livingCount <= 0) return 1
  return Math.max(1, Math.ceil(livingCount / 2))
}

export function createInitialAdventureState(
  campaignId: CampaignId = 'sunken-reliquary',
): AdventureQuestState {
  const campaign = getAdventureCampaign(campaignId)
  const startNode = campaign.nodes[campaign.startNodeId]
  return {
    revision: 1,
    updatedAt: Date.now(),
    campaignId,
    phase: 'choosing',
    currentNodeId: campaign.startNodeId,
    previousNodeId: null,
    lastTransitionOutcome: 'start',
    worldFlags: [],
    threatLevel: 0,
    bossWeaknessExposed: false,
    bossDcReduction: 0,
    bossHpReduced: false,
    arcaneSightActive: false,
    aegisScrollActive: false,
    warhornBonusActive: false,
    towerShieldActive: false,
    players: {},
    partySuccessPoints: 0,
    requiredSuccessPoints: 1,
    crucialCheck: createInitialCrucialCheck(startNode, null),
    lastResolutionLog: [
      `📜 Campaign Launched: ${campaign.title} — ${campaign.subtitle}. Pick your Archetype and choose an Action Card!`,
    ],
    lastDiceShowcase: null,
    combatShakeAt: 0,
    triumphBurstAt: 0,
  }
}

export function ensurePlayerEnrolled(
  state: AdventureQuestState,
  user: AdventureUserIdentity,
  preferredArchetype?: ArchetypeId,
): { players: Record<string, AdventurePlayerState>; player: AdventurePlayerState } {
  const existing = state.players[user.userId]
  if (existing) {
    const updated: AdventurePlayerState = {
      ...existing,
      displayName: user.displayName,
      avatarColor: user.avatarColor,
    }
    return {
      players: { ...state.players, [user.userId]: updated },
      player: updated,
    }
  }

  const takenArchetypes = new Set(
    Object.values(state.players).map((p) => p.archetype),
  )
  const chosenArch =
    preferredArchetype ??
    ARCHETYPE_ORDER.find((a) => !takenArchetypes.has(a)) ??
    ARCHETYPE_ORDER[Object.keys(state.players).length % ARCHETYPE_ORDER.length]

  const fresh = createPlayerState(user, chosenArch)
  const nextPlayers = {
    ...state.players,
    [user.userId]: fresh,
  }
  return { players: nextPlayers, player: fresh }
}

export function getActiveSceneNode(state: AdventureQuestState): AdventureSceneNode {
  const campaign = getAdventureCampaign(state.campaignId)
  return (
    campaign.nodes[state.currentNodeId] ??
    campaign.nodes[campaign.startNodeId] ??
    Object.values(campaign.nodes)[0]
  )
}

export function resolveNarrativeEchoText(
  state: AdventureQuestState,
  node: AdventureSceneNode = getActiveSceneNode(state),
): string[] {
  const echoes: string[] = []
  if (
    (state.lastTransitionOutcome === 'success' ||
      state.lastTransitionOutcome === 'critical') &&
    node.narrativeEcho.fromSuccess
  ) {
    echoes.push(node.narrativeEcho.fromSuccess)
  } else if (state.lastTransitionOutcome === 'fail' && node.narrativeEcho.fromFail) {
    echoes.push(node.narrativeEcho.fromFail)
  }

  if (node.narrativeEcho.flags) {
    for (const [flagKey, echoSentence] of Object.entries(node.narrativeEcho.flags)) {
      if (state.worldFlags.includes(flagKey)) {
        echoes.push(echoSentence)
      }
    }
  }
  return echoes
}

export function computeEffectiveCardDc(
  state: AdventureQuestState,
  node: AdventureSceneNode,
  card: AdventureActionCard,
): number {
  let dc = card.dc
  if (state.aegisScrollActive) {
    dc -= 3
  }
  if (node.stageNumber >= 11 || card.tags.includes('boss')) {
    dc -= state.bossDcReduction
    if (state.bossWeaknessExposed) {
      dc -= 2
    }
  }
  if (state.threatLevel >= 7 && !node.isSanctuary) {
    dc += 1
  }
  return Math.max(5, dc)
}

export function isDcRevealedToParty(
  state: AdventureQuestState,
  node: AdventureSceneNode,
): boolean {
  if (state.arcaneSightActive) return true
  if (node.isSanctuary) return true
  if (state.worldFlags.includes('neural_ward_active')) return true
  return false
}

export function selectCampaignAndReset(
  state: AdventureQuestState,
  campaignId: CampaignId,
  localUser?: AdventureUserIdentity,
): AdventureQuestState {
  const campaign = getAdventureCampaign(campaignId)
  const startNode = campaign.nodes[campaign.startNodeId]

  const resetPlayers: Record<string, AdventurePlayerState> = {}
  for (const [uid, p] of Object.entries(state.players)) {
    resetPlayers[uid] = createPlayerState(
      { userId: uid, displayName: p.displayName, avatarColor: p.avatarColor },
      p.archetype,
    )
  }

  if (localUser && !resetPlayers[localUser.userId]) {
    resetPlayers[localUser.userId] = createPlayerState(localUser, 'vanguard')
  }

  return {
    revision: state.revision + 1,
    updatedAt: Date.now(),
    campaignId,
    phase: 'choosing',
    currentNodeId: campaign.startNodeId,
    previousNodeId: null,
    lastTransitionOutcome: 'start',
    worldFlags: [],
    threatLevel: 0,
    bossWeaknessExposed: false,
    bossDcReduction: 0,
    bossHpReduced: false,
    arcaneSightActive: false,
    aegisScrollActive: false,
    warhornBonusActive: false,
    towerShieldActive: false,
    players: resetPlayers,
    partySuccessPoints: 0,
    requiredSuccessPoints: computeRequiredSuccessPoints(resetPlayers),
    crucialCheck: createInitialCrucialCheck(startNode, localUser),
    lastResolutionLog: [
      `⚔️ Started "${campaign.title}"! Act I — ${startNode.title}. Choose your Archetype and lock in an Action Card.`,
    ],
    lastDiceShowcase: null,
    combatShakeAt: 0,
    triumphBurstAt: Date.now(),
  }
}

export function selectPlayerArchetype(
  state: AdventureQuestState,
  user: AdventureUserIdentity,
  archetype: ArchetypeId,
): AdventureQuestState {
  const fresh = createPlayerState(user, archetype)
  const prev = state.players[user.userId]
  // Preserve current HP ratio only if mid-dungeon and not on node-1; on node-1 give full fresh loadout
  const isStartNode = state.currentNodeId === 'node-1'
  const nextPlayer: AdventurePlayerState =
    isStartNode || !prev
      ? fresh
      : {
          ...fresh,
          hp: prev.isGhost ? 0 : Math.min(fresh.maxHp, Math.max(1, prev.hp)),
          isGhost: prev.isGhost,
        }

  const nextPlayers = {
    ...state.players,
    [user.userId]: nextPlayer,
  }
  const spec = ARCHETYPE_SPECS[archetype]
  return {
    ...state,
    revision: state.revision + 1,
    updatedAt: Date.now(),
    players: nextPlayers,
    requiredSuccessPoints: computeRequiredSuccessPoints(nextPlayers),
    lastResolutionLog: [
      `${spec.icon} ${user.displayName} joined the party as the ${spec.name} (${spec.maxHp} HP · +${spec.stats.might} Might / +${spec.stats.finesse} Finesse / +${spec.stats.arcana} Arcana).`,
      ...state.lastResolutionLog.slice(0, 5),
    ],
  }
}

export function hoverActionCard(
  state: AdventureQuestState,
  user: AdventureUserIdentity,
  cardId: string | null,
): AdventureQuestState {
  const { players, player } = ensurePlayerEnrolled(state, user)
  if (player.hoveredCardId === cardId) return state
  const nextPlayers = {
    ...players,
    [user.userId]: {
      ...player,
      hoveredCardId: cardId,
    },
  }
  return {
    ...state,
    revision: state.revision + 1,
    updatedAt: Date.now(),
    players: nextPlayers,
    requiredSuccessPoints: computeRequiredSuccessPoints(nextPlayers),
  }
}

export function lockActionCard(
  state: AdventureQuestState,
  user: AdventureUserIdentity,
  cardId: string,
): AdventureQuestState {
  const node = getActiveSceneNode(state)
  const card = node.choices.find((c) => c.id === cardId) ?? node.choices[0]
  if (!card) return state

  const { players, player } = ensurePlayerEnrolled(state, user)
  if (player.isGhost) {
    return state
  }

  const nextPlayers = {
    ...players,
    [user.userId]: {
      ...player,
      hoveredCardId: card.id,
      lockedCardId: card.id,
    },
  }

  return {
    ...state,
    revision: state.revision + 1,
    updatedAt: Date.now(),
    players: nextPlayers,
    requiredSuccessPoints: computeRequiredSuccessPoints(nextPlayers),
    lastResolutionLog: [
      `🃏 ${user.displayName} locked in "${card.title}" (${card.attribute.toUpperCase()}).`,
      ...state.lastResolutionLog.slice(0, 5),
    ],
  }
}

export function triggerClassAbility(
  state: AdventureQuestState,
  user: AdventureUserIdentity,
  targetUserId?: string,
): AdventureQuestState {
  const node = getActiveSceneNode(state)
  const { players, player } = ensurePlayerEnrolled(state, user)
  if (player.isGhost) return state
  if (player.abilityUsedInAct === node.act) {
    return state
  }

  const spec = ARCHETYPE_SPECS[player.archetype]
  const nextPlayers = { ...players }
  let nextArcaneSight = state.arcaneSightActive
  let nextLog = ''
  let nextPartySuccess = state.partySuccessPoints

  if (player.archetype === 'vanguard') {
    // Bulwark Intercept: Shield a teammate (or self if solo) from failed-roll damage
    const target =
      (targetUserId ? nextPlayers[targetUserId] : undefined) ??
      Object.values(nextPlayers)
        .filter((p) => !p.isGhost && p.userId !== user.userId)
        .sort((a, b) => a.hp - b.hp)[0] ??
      player

    nextPlayers[target.userId] = {
      ...target,
      damageShieldedBy: `${player.displayName}'s Bulwark Intercept`,
    }
    nextPlayers[user.userId] = {
      ...nextPlayers[user.userId],
      abilityUsedInAct: node.act,
    }
    nextLog = `🛡️ ${player.displayName} activated Bulwark Intercept to shield ${target.displayName} from failed-roll damage!`
  } else if (player.archetype === 'shadow') {
    // Trickster's Edge: Bypass a lock/trap card OR grant auto-pass / re-roll with +2 Finesse
    const lockTrapCard =
      node.choices.find(
        (c) =>
          c.id === player.lockedCardId &&
          (c.tags.includes('lock') || c.tags.includes('trap')),
      ) ??
      node.choices.find((c) => c.tags.includes('lock') || c.tags.includes('trap')) ??
      node.choices.find((c) => c.id === player.lockedCardId) ??
      node.choices[0]

    const wasAlreadyCounted =
      player.rollOutcome === 'success' ||
      player.rollOutcome === 'critical' ||
      player.rollOutcome === 'bypassed'

    nextPlayers[user.userId] = {
      ...player,
      abilityUsedInAct: node.act,
      lockedCardId: lockTrapCard.id,
      autoPassReason: "Trickster's Edge",
      rollOutcome: 'bypassed',
      d20Roll: 20,
      totalRoll: 20 + spec.stats.finesse,
    }
    if (!wasAlreadyCounted) {
      nextPartySuccess += 1
    }
    nextLog = `🗡️ ${player.displayName} triggered Trickster's Edge — automatically bypassing "${lockTrapCard.title}" (+1 Party Success)!`
  } else if (player.archetype === 'arcanist') {
    // Arcane Sight: Reveal all DCs, unscrambled numbers, and failure penalties + +2 Arcana focus
    nextArcaneSight = true
    nextPlayers[user.userId] = {
      ...player,
      abilityUsedInAct: node.act,
      blessingBonus: player.blessingBonus + 2,
    }
    nextLog = `🔮 ${player.displayName} cast Arcane Sight — revealing all true DCs & failure penalties across the screen (+2 Arcana Focus)!`
  } else if (player.archetype === 'cleric') {
    // Sacred Blessing: +3 to an ally's D20 roll AND restore 2 HP to most wounded living ally
    const wounded =
      (targetUserId ? nextPlayers[targetUserId] : undefined) ??
      Object.values(nextPlayers)
        .filter((p) => !p.isGhost)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] ??
      player

    const healedHp = Math.min(wounded.maxHp, wounded.hp + 2)
    nextPlayers[wounded.userId] = {
      ...wounded,
      hp: healedHp,
      blessingBonus: wounded.blessingBonus + 3,
    }
    nextPlayers[user.userId] = {
      ...nextPlayers[user.userId],
      abilityUsedInAct: node.act,
    }
    nextLog = `✨ ${player.displayName} invoked Sacred Blessing on ${wounded.displayName} (+3 Roll Bonus & restored +2 HP -> ${healedHp}/${wounded.maxHp} HP)!`
  }

  return {
    ...state,
    revision: state.revision + 1,
    updatedAt: Date.now(),
    arcaneSightActive: nextArcaneSight,
    partySuccessPoints: nextPartySuccess,
    players: nextPlayers,
    triumphBurstAt: Date.now(),
    lastResolutionLog: [nextLog, ...state.lastResolutionLog.slice(0, 5)],
  }
}

export function expendAdventureItem(
  state: AdventureQuestState,
  user: AdventureUserIdentity,
  itemId: AdventureItemId,
  targetUserId?: string,
): AdventureQuestState {
  const node = getActiveSceneNode(state)
  const { players, player } = ensurePlayerEnrolled(state, user)
  if (!player.items.includes(itemId)) return state

  const itemSpec = ADVENTURE_ITEM_SPECS[itemId]
  const remainingItems = player.items.filter((id) => id !== itemId)
  const nextPlayers: Record<string, AdventurePlayerState> = {
    ...players,
    [user.userId]: {
      ...player,
      items: remainingItems,
    },
  }

  let nextTowerShield = state.towerShieldActive
  let nextWarhorn = state.warhornBonusActive
  let nextAegis = state.aegisScrollActive
  let nextPartySuccess = state.partySuccessPoints
  let nextLog = `${itemSpec.icon} ${player.displayName} used ${itemSpec.name}!`

  const grantAutoPassOnCard = (targetCard: AdventureActionCard, reason: string) => {
    const cur = nextPlayers[user.userId]
    const alreadyCounted =
      cur.rollOutcome === 'success' ||
      cur.rollOutcome === 'critical' ||
      cur.rollOutcome === 'bypassed'
    nextPlayers[user.userId] = {
      ...cur,
      lockedCardId: targetCard.id,
      autoPassReason: reason,
      rollOutcome: 'bypassed',
      d20Roll: 20,
      totalRoll: 25,
    }
    if (!alreadyCounted) {
      nextPartySuccess += 1
    }
  }

  switch (itemId) {
    case 'tower-shield': {
      nextTowerShield = true
      nextLog = `🛡️ ${player.displayName} planted the Tower Shield — all party HP damage is negated for this entire scene!`
      break
    }
    case 'bloodstone-axe': {
      const mightCard =
        node.choices.find(
          (c) => c.id === player.lockedCardId && c.attribute === 'might',
        ) ??
        node.choices.find((c) => c.attribute === 'might') ??
        node.choices[0]
      grantAutoPassOnCard(mightCard, 'Bloodstone Axe')
      nextLog = `🪓 ${player.displayName} cleaved with the Bloodstone Axe — automatically passing "${mightCard.title}" (+1 Party Success)!`
      break
    }
    case 'warhorn': {
      nextWarhorn = true
      nextLog = `📯 ${player.displayName} sounded the Warhorn — +2 to every living player's D20 roll this scene!`
      break
    }
    case 'smoke-bomb': {
      const target =
        (targetUserId ? nextPlayers[targetUserId] : undefined) ?? nextPlayers[user.userId]
      nextPlayers[target.userId] = {
        ...target,
        damageShieldedBy: 'Smoke Bomb',
      }
      nextLog = `💨 ${player.displayName} deployed a Smoke Bomb — ${target.displayName} will escape all damage if their check fails!`
      break
    }
    case 'skeleton-key': {
      const lockCard =
        node.choices.find((c) => c.tags.includes('lock')) ??
        node.choices.find((c) => c.id === player.lockedCardId) ??
        node.choices[0]
      grantAutoPassOnCard(lockCard, 'Skeleton Key')
      nextLog = `🗝️ ${player.displayName} used the Skeleton Key — unlocking "${lockCard.title}" without rolling (+1 Party Success)!`
      break
    }
    case 'grappling-hook': {
      const chasmCard =
        node.choices.find((c) => c.tags.includes('chasm')) ??
        node.choices.find((c) => c.id === player.lockedCardId) ??
        node.choices[0]
      grantAutoPassOnCard(chasmCard, 'Grappling Hook')
      nextLog = `🪝 ${player.displayName} fired the Grappling Hook — bypassing "${chasmCard.title}" automatically (+1 Party Success)!`
      break
    }
    case 'chronos-shard': {
      const target =
        (targetUserId ? nextPlayers[targetUserId] : undefined) ??
        Object.values(nextPlayers).find((p) => p.rollOutcome === 'fail') ??
        nextPlayers[user.userId]
      const card =
        node.choices.find((c) => c.id === target.lockedCardId) ?? node.choices[0]
      const wasFailed = target.rollOutcome === 'fail'
      nextPlayers[target.userId] = {
        ...target,
        lockedCardId: card.id,
        blessingBonus: target.blessingBonus + 4,
        hp: wasFailed ? Math.min(target.maxHp, target.hp + card.failHpDamage) : target.hp,
        isGhost: false,
        autoPassReason: 'Chronos Shard Rewind',
        rollOutcome: 'bypassed',
        d20Roll: 19,
        totalRoll: 24,
      }
      nextPartySuccess += 1
      nextLog = `⏳ ${player.displayName} shattered the Chronos Shard — rewinding time for ${target.displayName} into a guaranteed triumph!`
      break
    }
    case 'scroll-of-fireball': {
      const combatCard =
        node.choices.find((c) => c.tags.includes('combat') || c.tags.includes('boss')) ??
        node.choices[0]
      grantAutoPassOnCard(combatCard, 'Scroll of Fireball')
      nextPartySuccess += 1 // +2 total success points!
      nextLog = `🔥 ${player.displayName} unleashed the Scroll of Fireball — incinerating foes for +2 automatic Party Success Points!`
      break
    }
    case 'blink-crystal': {
      const trapCard =
        node.choices.find(
          (c) => c.tags.includes('trap') || c.tags.includes('hazard'),
        ) ??
        node.choices.find((c) => c.id === player.lockedCardId) ??
        node.choices[0]
      grantAutoPassOnCard(trapCard, 'Blink Crystal')
      nextLog = `💎 ${player.displayName} shattered the Blink Crystal — teleporting past "${trapCard.title}" unscathed (+1 Party Success)!`
      break
    }
    case 'phoenix-vial': {
      const ghostTarget =
        (targetUserId && nextPlayers[targetUserId]?.isGhost
          ? nextPlayers[targetUserId]
          : undefined) ??
        Object.values(nextPlayers).find((p) => p.isGhost) ??
        Object.values(nextPlayers).sort((a, b) => a.hp - b.hp)[0] ??
        nextPlayers[user.userId]

      if (ghostTarget.isGhost) {
        nextPlayers[ghostTarget.userId] = {
          ...ghostTarget,
          isGhost: false,
          hp: 4,
          tetheredToUserId: null,
          spectralRoll: null,
        }
        nextLog = `🧪 ${player.displayName} uncorked the Phoenix Vial — reviving Spectral Ghost ${ghostTarget.displayName} back to mortal life at 4 HP!`
      } else {
        const nextHp = Math.min(ghostTarget.maxHp, ghostTarget.hp + 4)
        nextPlayers[ghostTarget.userId] = {
          ...ghostTarget,
          hp: nextHp,
        }
        nextLog = `🧪 ${player.displayName} used the Phoenix Vial — healing ${ghostTarget.displayName} to ${nextHp}/${ghostTarget.maxHp} HP!`
      }
      break
    }
    case 'sunburst-chalice': {
      for (const [uid, p] of Object.entries(nextPlayers)) {
        if (!p.isGhost && p.hp > 0) {
          nextPlayers[uid] = {
            ...p,
            hp: Math.min(p.maxHp, p.hp + 3),
          }
        }
      }
      nextLog = `🏆 ${player.displayName} raised the Sunburst Chalice — healing every living party member for +3 HP!`
      break
    }
    case 'aegis-scroll': {
      nextAegis = true
      nextLog = `📜 ${player.displayName} unrolled the Aegis Scroll — reducing all scene DCs by 3 for this turn!`
      break
    }
  }

  return {
    ...state,
    revision: state.revision + 1,
    updatedAt: Date.now(),
    towerShieldActive: nextTowerShield,
    warhornBonusActive: nextWarhorn,
    aegisScrollActive: nextAegis,
    partySuccessPoints: nextPartySuccess,
    requiredSuccessPoints: computeRequiredSuccessPoints(nextPlayers),
    players: nextPlayers,
    triumphBurstAt: Date.now(),
    lastResolutionLog: [nextLog, ...state.lastResolutionLog.slice(0, 5)],
  }
}

export function tetherSpectralGhost(
  state: AdventureQuestState,
  ghostUserId: string,
  targetAllyUserId: string,
): AdventureQuestState {
  const ghost = state.players[ghostUserId]
  const ally = state.players[targetAllyUserId]
  if (!ghost || !ghost.isGhost || !ally || ally.isGhost) return state

  const nextPlayers = {
    ...state.players,
    [ghostUserId]: {
      ...ghost,
      tetheredToUserId: targetAllyUserId,
    },
  }

  return {
    ...state,
    revision: state.revision + 1,
    updatedAt: Date.now(),
    players: nextPlayers,
    lastResolutionLog: [
      `👻 Spectral Ghost ${ghost.displayName} tethered their spirit to ${ally.displayName}!`,
      ...state.lastResolutionLog.slice(0, 5),
    ],
  }
}

export function rollSpectralGhostSupportD20(
  state: AdventureQuestState,
  ghostUserId: string,
  forcedD20?: number,
): AdventureQuestState {
  const ghost = state.players[ghostUserId]
  if (!ghost || !ghost.isGhost) return state

  const livingAllies = Object.values(state.players).filter(
    (p) => !p.isGhost && p.hp > 0 && p.userId !== ghostUserId,
  )
  const targetAlly =
    (ghost.tetheredToUserId ? state.players[ghost.tetheredToUserId] : undefined) ??
    livingAllies[0]

  const d20 =
    forcedD20 ?? Math.max(1, Math.min(20, Math.floor(Math.random() * 20) + 1))

  const bonus = d20 === 20 ? 4 : d20 >= 12 ? 2 : 1
  const shielded = d20 === 20

  const nextPlayers = { ...state.players }
  nextPlayers[ghostUserId] = {
    ...ghost,
    tetheredToUserId: targetAlly?.userId ?? ghost.tetheredToUserId,
    spectralRoll: d20,
    spectralBonusGranted: bonus,
    spectralShieldGranted: shielded,
  }

  if (targetAlly) {
    nextPlayers[targetAlly.userId] = {
      ...targetAlly,
      blessingBonus: targetAlly.blessingBonus + bonus,
      damageShieldedBy: shielded
        ? `${ghost.displayName}'s Nat 20 Spectral Aegis`
        : targetAlly.damageShieldedBy,
    }
  }

  const logMsg =
    d20 === 20
      ? `👻✨ NATURAL 20 SPECTRAL ROLL! Ghost ${ghost.displayName} grants +4 Spectral Bonus AND shields ${targetAlly?.displayName ?? 'the party'} from all turn damage!`
      : d20 >= 12
        ? `👻 Ghost ${ghost.displayName} rolled a ${d20} — granting +2 Spectral Bonus to ${targetAlly?.displayName ?? 'their tethered ally'}!`
        : `👻 Ghost ${ghost.displayName} rolled a ${d20} — whispering a +1 Spectral Bonus to ${targetAlly?.displayName ?? 'their tethered ally'}.`

  return {
    ...state,
    revision: state.revision + 1,
    updatedAt: Date.now(),
    players: nextPlayers,
    triumphBurstAt: d20 >= 12 ? Date.now() : state.triumphBurstAt,
    lastDiceShowcase: {
      rollerName: `${ghost.displayName} (Ghost)`,
      archetype: ghost.archetype,
      d20,
      modifier: bonus,
      total: d20,
      dc: 12,
      outcome: 'spectral',
      timestamp: Date.now(),
    },
    lastResolutionLog: [logMsg, ...state.lastResolutionLog.slice(0, 5)],
  }
}

export function resolveCrucialSkillCheck(
  state: AdventureQuestState,
  user: AdventureUserIdentity,
  source: 'putting' | 'darts' | 'wrist-d20',
  physicalResult?: {
    succeeded: boolean
    isCritical?: boolean
    detailLabel?: string
    rollValue?: number
  },
): AdventureQuestState {
  const node = getActiveSceneNode(state)
  const spec = node.crucialSkillCheck
  if (!spec || !state.crucialCheck || state.crucialCheck.resolved) {
    return state
  }

  const { players, player } = ensurePlayerEnrolled(state, user)
  const nextPlayers = { ...players }
  const effectiveDc = Math.max(
    5,
    spec.fallbackDc -
      state.bossDcReduction -
      (state.aegisScrollActive ? 3 : 0) -
      (state.bossWeaknessExposed ? 2 : 0),
  )

  let succeeded = false
  let isCritical = false
  let d20Val = 15
  let mod = 0
  let summary = ''

  if (physicalResult && (source === 'putting' || source === 'darts')) {
    succeeded = physicalResult.succeeded
    isCritical = Boolean(physicalResult.isCritical)
    d20Val = isCritical ? 20 : succeeded ? 18 : 6
    summary = succeeded
      ? `${physicalResult.detailLabel ?? 'Physical Lounge Check'} SUCCEEDED! ${spec.successRewardText}`
      : `${physicalResult.detailLabel ?? 'Physical Lounge Check'} missed! ${spec.failPenaltyText}`
  } else {
    // Wrist D20 or Couch Fallback D20 roll
    d20Val =
      physicalResult?.rollValue ??
      Math.max(1, Math.min(20, Math.floor(Math.random() * 20) + 1))
    const archStats = ARCHETYPE_SPECS[player.archetype].stats
    const bestStat = Math.max(archStats.might, archStats.finesse, archStats.arcana)
    mod =
      bestStat +
      (state.warhornBonusActive ? 2 : 0) +
      player.blessingBonus +
      (state.worldFlags.includes('weapons_consecrated') ? 1 : 0)
    const total = d20Val + mod
    isCritical = d20Val === 20
    succeeded = isCritical || total >= effectiveDc
    summary = succeeded
      ? `🎲 ${user.displayName} rolled D20 (${d20Val}) + ${mod} = ${total} vs DC ${effectiveDc} — ${spec.successRewardText}`
      : `🎲 ${user.displayName} rolled D20 (${d20Val}) + ${mod} = ${total} vs DC ${effectiveDc} — ${spec.failPenaltyText}`
  }

  const nextFlags = [...state.worldFlags]
  if (succeeded && spec.grantsWorldFlag && !nextFlags.includes(spec.grantsWorldFlag)) {
    nextFlags.push(spec.grantsWorldFlag)
  }

  let nextBossWeakness = state.bossWeaknessExposed
  let nextBossDcRed = state.bossDcReduction
  if (succeeded && (isCritical || spec.exposesBossWeakness)) {
    nextBossWeakness = true
    nextBossDcRed += 1
  }

  let nextPartySuccess = state.partySuccessPoints
  let nextCombatShake = state.combatShakeAt
  let nextTriumphBurst = state.triumphBurstAt

  if (succeeded) {
    nextPartySuccess += isCritical ? 2 : 1
    nextTriumphBurst = Date.now()
  } else if (!state.towerShieldActive && !player.damageShieldedBy) {
    const newHp = Math.max(0, player.hp - spec.failHpPenalty)
    nextPlayers[user.userId] = {
      ...player,
      hp: newHp,
      isGhost: newHp === 0,
    }
    nextCombatShake = Date.now()
  }

  return {
    ...state,
    revision: state.revision + 1,
    updatedAt: Date.now(),
    worldFlags: nextFlags,
    bossWeaknessExposed: nextBossWeakness,
    bossDcReduction: nextBossDcRed,
    partySuccessPoints: nextPartySuccess,
    players: nextPlayers,
    requiredSuccessPoints: computeRequiredSuccessPoints(nextPlayers),
    combatShakeAt: nextCombatShake,
    triumphBurstAt: nextTriumphBurst,
    crucialCheck: {
      ...state.crucialCheck,
      active: false,
      resolved: true,
      designatedUserId: user.userId,
      designatedName: user.displayName,
      outcome: isCritical ? 'critical' : succeeded ? 'success' : 'fail',
      rollValue: d20Val + mod,
      summaryText: summary,
    },
    lastDiceShowcase: {
      rollerName: user.displayName,
      archetype: player.archetype,
      d20: d20Val,
      modifier: mod,
      total: d20Val + mod,
      dc: effectiveDc,
      outcome: isCritical ? 'critical' : succeeded ? 'success' : 'fail',
      timestamp: Date.now(),
    },
    lastResolutionLog: [summary, ...state.lastResolutionLog.slice(0, 5)],
  }
}

export function rollPlayerAdventureD20(
  state: AdventureQuestState,
  user: AdventureUserIdentity,
  forcedD20?: number,
): AdventureQuestState {
  const node = getActiveSceneNode(state)
  const { players, player } = ensurePlayerEnrolled(state, user)

  if (player.isGhost) {
    return rollSpectralGhostSupportD20(state, user.userId, forcedD20)
  }

  const card =
    node.choices.find((c) => c.id === player.lockedCardId) ??
    node.choices.find((c) => c.id === player.hoveredCardId) ??
    node.choices[0]
  if (!card) return state

  const nextPlayers = { ...players }
  const spec = ARCHETYPE_SPECS[player.archetype]
  const effectiveDc = computeEffectiveCardDc(state, node, card)

  const d20 =
    forcedD20 ?? Math.max(1, Math.min(20, Math.floor(Math.random() * 20) + 1))

  const statMod = spec.stats[card.attribute]
  const warhornMod = state.warhornBonusActive ? 2 : 0
  const consecratedMod =
    state.worldFlags.includes('weapons_consecrated') || player.undeadConsecratedBonus > 0
      ? 1
      : 0
  const totalMod = statMod + warhornMod + consecratedMod + player.blessingBonus
  const totalRoll = d20 + totalMod

  const isNat20 = d20 === 20
  const passed = isNat20 || totalRoll >= effectiveDc || player.rollOutcome === 'bypassed'

  const nextFlags = [...state.worldFlags]
  let nextBossDcRed = state.bossDcReduction
  let nextBossWeakness = state.bossWeaknessExposed
  let nextPartySuccess = state.partySuccessPoints
  let nextCombatShake = state.combatShakeAt
  let nextTriumphBurst = state.triumphBurstAt
  let logLine = ''

  // Avoid double-counting if player already rolled a pass this turn
  const previouslyPassed =
    player.rollOutcome === 'success' ||
    player.rollOutcome === 'critical' ||
    player.rollOutcome === 'bypassed'

  if (passed) {
    const addedPoints = isNat20 ? 2 : 1
    if (!previouslyPassed) {
      nextPartySuccess += addedPoints
    }
    if (card.grantsWorldFlag && !nextFlags.includes(card.grantsWorldFlag)) {
      nextFlags.push(card.grantsWorldFlag)
    }
    if (card.reducesBossDc) {
      nextBossDcRed += card.reducesBossDc
    }
    if (isNat20) {
      nextBossWeakness = true
    }
    const healAmt = card.healOnSuccess ?? 0
    const nextHp = Math.min(player.maxHp, player.hp + healAmt)

    nextPlayers[user.userId] = {
      ...player,
      lockedCardId: card.id,
      hp: nextHp,
      d20Roll: d20,
      totalRoll,
      rollOutcome: isNat20 ? 'critical' : 'success',
    }
    nextTriumphBurst = Date.now()
    logLine = `${isNat20 ? '🌟 NAT 20!' : '✅ PASS!'} ${user.displayName} rolled ${d20} + ${totalMod} = ${totalRoll} vs DC ${effectiveDc} on "${card.title}" — ${card.successBonusText}`
  } else {
    // Failed roll — check shields or Vanguard Bulwark Intercept
    let damageTaken = card.failHpDamage
    let shieldNote = ''
    if (state.towerShieldActive) {
      damageTaken = 0
      shieldNote = ' (Blocked by Tower Shield!)'
    } else if (player.damageShieldedBy) {
      if (player.damageShieldedBy.includes('Bulwark Intercept')) {
        // Vanguard absorbs reduced damage (-1)
        const vanguardEntry = Object.values(nextPlayers).find(
          (p) => p.archetype === 'vanguard' && !p.isGhost && p.userId !== user.userId,
        )
        if (vanguardEntry) {
          const absorbed = Math.max(1, damageTaken - 1)
          const vanHp = Math.max(0, vanguardEntry.hp - absorbed)
          nextPlayers[vanguardEntry.userId] = {
            ...vanguardEntry,
            hp: vanHp,
            isGhost: vanHp === 0,
          }
          damageTaken = 0
          shieldNote = ` (Intercepted by ${vanguardEntry.displayName}! -${absorbed} HP)`
        } else {
          damageTaken = Math.max(0, damageTaken - 1)
        }
      } else {
        damageTaken = 0
        shieldNote = ` (Negated by ${player.damageShieldedBy}!)`
      }
    }

    const nextHp = Math.max(0, player.hp - damageTaken)
    const turnedGhost = nextHp === 0 && !node.isSanctuary
    nextPlayers[user.userId] = {
      ...player,
      lockedCardId: card.id,
      hp: nextHp,
      isGhost: turnedGhost,
      d20Roll: d20,
      totalRoll,
      rollOutcome: 'fail',
    }
    nextCombatShake = Date.now()
    logLine = `❌ FAIL! ${user.displayName} rolled ${d20} + ${totalMod} = ${totalRoll} vs DC ${effectiveDc} on "${card.title}" — ${card.failPenaltyText}${shieldNote}${turnedGhost ? ' 💀 Entered SPECTRAL GHOST mode!' : ''}`
  }

  return {
    ...state,
    revision: state.revision + 1,
    updatedAt: Date.now(),
    worldFlags: nextFlags,
    bossDcReduction: nextBossDcRed,
    bossWeaknessExposed: nextBossWeakness,
    partySuccessPoints: nextPartySuccess,
    players: nextPlayers,
    combatShakeAt: nextCombatShake,
    triumphBurstAt: nextTriumphBurst,
    lastDiceShowcase: {
      rollerName: user.displayName,
      archetype: player.archetype,
      d20,
      modifier: totalMod,
      total: totalRoll,
      dc: effectiveDc,
      outcome: isNat20 ? 'critical' : passed ? 'success' : 'fail',
      timestamp: Date.now(),
    },
    lastResolutionLog: [logLine, ...state.lastResolutionLog.slice(0, 5)],
  }
}

export function advanceAdventureScene(
  state: AdventureQuestState,
  triggerUser?: AdventureUserIdentity,
): AdventureQuestState {
  const campaign = getAdventureCampaign(state.campaignId)
  const currentNode = getActiveSceneNode(state)

  // If no one has rolled yet and someone triggers advance, auto-roll for triggerUser so solo/quick play never stalls
  let workingState = state
  const anyRollMade = Object.values(workingState.players).some(
    (p) => p.rollOutcome !== 'pending',
  )
  if (!anyRollMade && triggerUser) {
    workingState = rollPlayerAdventureD20(workingState, triggerUser)
  }

  const playerList = Object.values(workingState.players)
  const livingOrRolled = playerList.filter(
    (p) => !p.isGhost || p.rollOutcome !== 'pending',
  )
  const required = Math.max(1, workingState.requiredSuccessPoints)
  const totalSuccess = workingState.partySuccessPoints

  const allLivingPassed =
    livingOrRolled.length > 0 &&
    livingOrRolled.every(
      (p) =>
        p.rollOutcome === 'success' ||
        p.rollOutcome === 'critical' ||
        p.rollOutcome === 'bypassed',
    )
  const anyCritical =
    playerList.some((p) => p.rollOutcome === 'critical') ||
    workingState.crucialCheck?.outcome === 'critical'

  const partySucceeded =
    currentNode.isSanctuary || totalSuccess >= required || allLivingPassed

  const isCriticalTriumph = partySucceeded && (allLivingPassed || anyCritical)

  const nextFlags = [...workingState.worldFlags]
  if (
    isCriticalTriumph &&
    currentNode.criticalGrantsFlag &&
    !nextFlags.includes(currentNode.criticalGrantsFlag)
  ) {
    nextFlags.push(currentNode.criticalGrantsFlag)
  }

  let nextBossWeakness = workingState.bossWeaknessExposed
  if (isCriticalTriumph) {
    nextBossWeakness = true
  }

  const targetNodeId = isCriticalTriumph
    ? (currentNode.nextNodeCritical ?? currentNode.nextNodeSuccess)
    : partySucceeded
      ? currentNode.nextNodeSuccess
      : currentNode.nextNodeFail

  // Check if all players are Ghosts on a non-sanctuary fail or if Finale reached Victory/Defeat
  const allDead =
    playerList.length > 0 && playerList.every((p) => p.isGhost || p.hp <= 0)

  if (targetNodeId === 'victory' || (currentNode.isFinale && partySucceeded)) {
    return {
      ...workingState,
      revision: workingState.revision + 1,
      updatedAt: Date.now(),
      phase: 'victory',
      worldFlags: nextFlags,
      bossWeaknessExposed: nextBossWeakness,
      triumphBurstAt: Date.now(),
      lastResolutionLog: [
        `🏆 CAMPAIGN VICTORY! Your party conquered "${campaign.title}" and defeated ${campaign.bossName}!`,
        ...workingState.lastResolutionLog.slice(0, 5),
      ],
    }
  }

  if (targetNodeId === 'defeat' || (allDead && !campaign.nodes[targetNodeId]?.isSanctuary)) {
    if (currentNode.isFinale) {
      return {
        ...workingState,
        revision: workingState.revision + 1,
        updatedAt: Date.now(),
        phase: 'defeat',
        combatShakeAt: Date.now(),
        lastResolutionLog: [
          `💀 DEFEAT AT THE FINALE! ${campaign.bossName} overwhelmed the party. Click "Restart Campaign" or switch adventures to try again!`,
          ...workingState.lastResolutionLog.slice(0, 5),
        ],
      }
    }
  }

  const nextNode = campaign.nodes[targetNodeId] ?? currentNode
  const enteringSanctuary = Boolean(nextNode.isSanctuary)

  // Prepare players for the next node (revive Spectral Ghosts to 4 HP at Sanctuary Shrine!)
  const nextPlayers: Record<string, AdventurePlayerState> = {}
  for (const [uid, p] of Object.entries(workingState.players)) {
    const revivedAtShrine = enteringSanctuary && p.isGhost
    const consecratedBonus = nextFlags.includes('weapons_consecrated') ? 1 : p.undeadConsecratedBonus
    nextPlayers[uid] = {
      ...p,
      hp: revivedAtShrine ? 4 : p.hp,
      isGhost: revivedAtShrine ? false : p.isGhost,
      tetheredToUserId: null,
      spectralRoll: null,
      spectralBonusGranted: 0,
      spectralShieldGranted: false,
      hoveredCardId: null,
      lockedCardId: null,
      autoPassReason: null,
      damageShieldedBy: null,
      blessingBonus: 0,
      undeadConsecratedBonus: consecratedBonus,
      d20Roll: null,
      totalRoll: null,
      rollOutcome: 'pending',
    }
  }

  const nextThreat = enteringSanctuary
    ? Math.max(0, workingState.threatLevel - 2)
    : partySucceeded
      ? workingState.threatLevel
      : Math.min(10, workingState.threatLevel + 2)

  const transitionOutcome: 'success' | 'fail' | 'critical' = isCriticalTriumph
    ? 'critical'
    : partySucceeded
      ? 'success'
      : 'fail'

  const transitionBanner = enteringSanctuary
    ? `✨ SANCTUARY REACHED (${nextNode.title})! All Spectral Ghosts revive to 4 HP and Threat Level drops to ${nextThreat}/10.`
    : isCriticalTriumph
      ? `🌟 CRITICAL PARTY TRIUMPH (${totalSuccess}/${required} pts)! Boss Weakness Exposed — advancing to ${nextNode.title}!`
      : partySucceeded
        ? `✅ PARTY SUCCEEDED (${totalSuccess}/${required} pts)! Advancing to ${nextNode.title}.`
        : `⚠️ PARTY FORCED ONTO FAIL PATH (${totalSuccess}/${required} pts)! Threat Level rises to ${nextThreat}/10 — entering ${nextNode.title}!`

  return {
    ...workingState,
    revision: workingState.revision + 1,
    updatedAt: Date.now(),
    phase: 'choosing',
    currentNodeId: nextNode.id,
    previousNodeId: currentNode.id,
    lastTransitionOutcome: transitionOutcome,
    worldFlags: nextFlags,
    threatLevel: nextThreat,
    bossWeaknessExposed: nextBossWeakness,
    arcaneSightActive: false,
    aegisScrollActive: false,
    warhornBonusActive: false,
    towerShieldActive: false,
    players: nextPlayers,
    partySuccessPoints: 0,
    requiredSuccessPoints: computeRequiredSuccessPoints(nextPlayers),
    crucialCheck: createInitialCrucialCheck(nextNode, triggerUser),
    triumphBurstAt: partySucceeded ? Date.now() : workingState.triumphBurstAt,
    combatShakeAt: !partySucceeded ? Date.now() : workingState.combatShakeAt,
    lastResolutionLog: [
      transitionBanner,
      ...workingState.lastResolutionLog.slice(0, 5),
    ],
  }
}

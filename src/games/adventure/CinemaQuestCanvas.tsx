import * as THREE from 'three'
import { ADVENTURE_CAMPAIGN_LIST, getAdventureCampaign } from './campaigns'
import {
  computeEffectiveCardDc,
  createInitialAdventureState,
  getActiveSceneNode,
  isDcRevealedToParty,
  resolveNarrativeEchoText,
} from './engine'
import {
  ADVENTURE_ITEM_SPECS,
  ARCHETYPE_SPECS,
  type AdventureActionCard,
  type AdventureItemId,
  type AdventurePlayerState,
  type AdventureQuestState,
  type AdventureSceneNode,
  type ArchetypeId,
  type AttributeKind,
  type CampaignId,
} from './types'

export type QuestHotspotAction =
  | { type: 'select-campaign'; campaignId: CampaignId }
  | { type: 'select-archetype'; archetype: ArchetypeId }
  | { type: 'lock-card'; cardId: string }
  | { type: 'roll-d20' }
  | { type: 'roll-crucial-fallback' }
  | { type: 'advance-scene' }
  | { type: 'use-ability' }
  | { type: 'use-item'; itemId: AdventureItemId }
  | { type: 'tether-ghost'; targetUserId: string }
  | { type: 'restart-campaign' }

export interface QuestCanvasHotspot {
  id: string
  x: number
  y: number
  w: number
  h: number
  action: QuestHotspotAction
}

interface AmbientParticle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  alpha: number
  phase: number
  hue: string
}

const CANVAS_W = 1920
const CANVAS_H = 1080

const ATTRIBUTE_BADGE: Record<
  AttributeKind,
  { label: string; icon: string; color: string; bg: string }
> = {
  might: {
    label: 'MIGHT',
    icon: '⚔️',
    color: '#F97316',
    bg: 'rgba(249, 115, 22, 0.22)',
  },
  finesse: {
    label: 'FINESSE',
    icon: '🗡️',
    color: '#10B981',
    bg: 'rgba(16, 185, 129, 0.22)',
  },
  arcana: {
    label: 'ARCANA',
    icon: '🔮',
    color: '#A855F7',
    bg: 'rgba(168, 85, 247, 0.24)',
  },
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function fillWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 6,
): number {
  const words = text.split(/\s+/)
  let line = ''
  let lineCount = 0
  let curY = y

  for (let i = 0; i < words.length; i++) {
    const testLine = line ? `${line} ${words[i]}` : words[i]
    const metrics = ctx.measureText(testLine)
    if (metrics.width > maxWidth && line) {
      ctx.fillText(line, x, curY)
      line = words[i]
      curY += lineHeight
      lineCount++
      if (lineCount >= maxLines - 1) {
        const rest = words.slice(i).join(' ')
        ctx.fillText(
          rest.length > 48 ? `${rest.slice(0, 45)}...` : rest,
          x,
          curY,
        )
        return curY + lineHeight
      }
    } else {
      line = testLine
    }
  }
  if (line) {
    ctx.fillText(line, x, curY)
    curY += lineHeight
  }
  return curY
}

class CinemaQuestCanvasController {
  public readonly canvas: HTMLCanvasElement
  public readonly texture: THREE.CanvasTexture
  private readonly ctx: CanvasRenderingContext2D
  private state: AdventureQuestState = createInitialAdventureState('sunken-reliquary')
  private localUserId = ''
  private hoveredHotspotId: string | null = null
  private hotspots: QuestCanvasHotspot[] = []
  private particles: AmbientParticle[] = []
  private animTimer: number | null = null
  private activeConsumers = new Set<string>()
  private nodeEnteredAt = Date.now()
  private lastRenderedNodeId = 'node-1'

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.width = CANVAS_W
    this.canvas.height = CANVAS_H
    const context = this.canvas.getContext('2d')
    if (!context) {
      throw new Error('Unable to initialize 2D context for CinemaQuestCanvas')
    }
    this.ctx = context

    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.colorSpace = THREE.SRGBColorSpace
    this.texture.minFilter = THREE.LinearFilter
    this.texture.magFilter = THREE.LinearFilter
    this.texture.generateMipmaps = false

    this.initParticles()
    this.renderFrame(0)
  }

  private initParticles() {
    this.particles = []
    for (let i = 0; i < 68; i++) {
      this.particles.push({
        x: ((i * 173) % 1000) * (CANVAS_W / 1000),
        y: ((i * 293) % 1000) * (CANVAS_H / 1000),
        vx: (((i * 47) % 100) / 100 - 0.5) * 26,
        vy: -18 - ((i * 83) % 45),
        radius: 2 + ((i * 19) % 5),
        alpha: 0.25 + (((i * 31) % 65) / 100),
        phase: (i * 0.7) % (Math.PI * 2),
        hue: i % 2 === 0 ? '#22D3EE' : '#F59E0B',
      })
    }
  }

  public setConsumerActive(id: string, active: boolean) {
    if (active) {
      this.activeConsumers.add(id)
    } else {
      this.activeConsumers.delete(id)
    }
    if (this.activeConsumers.size > 0 && this.animTimer === null) {
      let lastTs = performance.now()
      let lastRenderTs = 0
      this.animTimer = window.setInterval(() => {
        const now = performance.now()
        const isRollingNow =
          this.state.lastDiceShowcase !== null &&
          Date.now() - this.state.lastDiceShowcase.timestamp < 1600
        const minIntervalMs = isRollingNow ? 33 : 100 // 30fps during d20 roll animation, 10fps when idle
        if (now - lastRenderTs < minIntervalMs) return
        const dt = Math.min(0.15, (now - lastTs) / 1000)
        lastTs = now
        lastRenderTs = now
        this.renderFrame(dt)
      }, 33)
    } else if (this.activeConsumers.size === 0 && this.animTimer !== null) {
      window.clearInterval(this.animTimer)
      this.animTimer = null
    }
  }

  public updateState(nextState: AdventureQuestState, localUserId: string) {
    if (nextState.currentNodeId !== this.lastRenderedNodeId) {
      this.lastRenderedNodeId = nextState.currentNodeId
      this.nodeEnteredAt = Date.now()
    }
    this.state = nextState
    this.localUserId = localUserId
    this.renderFrame(0.016)
  }

  public getState(): AdventureQuestState {
    return this.state
  }

  public hitTestUv(uvX: number, uvY: number): QuestCanvasHotspot | null {
    const px = uvX * CANVAS_W
    const py = (1 - uvY) * CANVAS_H
    for (let i = this.hotspots.length - 1; i >= 0; i--) {
      const h = this.hotspots[i]
      if (px >= h.x && px <= h.x + h.w && py >= h.y && py <= h.y + h.h) {
        return h
      }
    }
    return null
  }

  public setHoveredUv(uvX: number | null, uvY: number | null): QuestCanvasHotspot | null {
    if (uvX === null || uvY === null) {
      if (this.hoveredHotspotId !== null) {
        this.hoveredHotspotId = null
        this.renderFrame(0.016)
      }
      return null
    }
    const hit = this.hitTestUv(uvX, uvY)
    const nextId = hit?.id ?? null
    if (nextId !== this.hoveredHotspotId) {
      this.hoveredHotspotId = nextId
      this.renderFrame(0.016)
    }
    return hit
  }

  // ==========================================================================
  // LAYER 1: Procedural Architectural & Atmospheric Backdrops (1920x1080)
  // ==========================================================================
  private renderLayer1Backdrop(
    ctx: CanvasRenderingContext2D,
    campaignId: CampaignId,
    node: AdventureSceneNode,
    timeSec: number,
  ) {
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H)
    if (campaignId === 'sunken-reliquary') {
      grad.addColorStop(0, '#040B14')
      grad.addColorStop(0.5, '#071927')
      grad.addColorStop(1, '#03101A')
    } else if (campaignId === 'forge-of-the-iron-titan') {
      grad.addColorStop(0, '#120605')
      grad.addColorStop(0.55, '#240C08')
      grad.addColorStop(1, '#3B1107')
    } else if (campaignId === 'whispering-canopy') {
      grad.addColorStop(0, '#04120E')
      grad.addColorStop(0.55, '#0A211B')
      grad.addColorStop(1, '#140B24')
    } else {
      grad.addColorStop(0, '#070414')
      grad.addColorStop(0.5, '#140B2E')
      grad.addColorStop(1, '#090518')
    }
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

    // Parallax architectural silhouettes
    ctx.save()
    ctx.globalAlpha = 0.24
    if (campaignId === 'sunken-reliquary') {
      // Flooded Gothic Cathedral Arches & Caustic Waterline
      ctx.strokeStyle = '#22D3EE'
      ctx.lineWidth = 2
      for (let i = 0; i < 6; i++) {
        const ax = 120 + i * 330
        ctx.beginPath()
        ctx.moveTo(ax - 95, CANVAS_H)
        ctx.lineTo(ax - 95, 220)
        ctx.quadraticCurveTo(ax, 90, ax + 95, 220)
        ctx.lineTo(ax + 95, CANVAS_H)
        ctx.stroke()
      }
    } else if (campaignId === 'forge-of-the-iron-titan') {
      // Subterranean Lava Viaducts & Giant Foundry Cogs
      ctx.strokeStyle = '#F97316'
      ctx.lineWidth = 3
      for (let i = 0; i < 5; i++) {
        const cx = 200 + i * 380
        ctx.beginPath()
        ctx.arc(cx, 240, 110, 0, Math.PI * 2)
        ctx.stroke()
      }
      const lavaGlow = ctx.createLinearGradient(0, CANVAS_H - 180, 0, CANVAS_H)
      lavaGlow.addColorStop(0, 'rgba(249, 115, 22, 0)')
      lavaGlow.addColorStop(1, `rgba(234, 88, 12, ${0.42 + Math.sin(timeSec * 3) * 0.1})`)
      ctx.fillStyle = lavaGlow
      ctx.fillRect(0, CANVAS_H - 180, CANVAS_W, 180)
    } else if (campaignId === 'whispering-canopy') {
      // Tangled Bioluminescent Roots & Giant Mushroom Silhouettes
      ctx.strokeStyle = '#10B981'
      ctx.lineWidth = 4
      for (let i = 0; i < 6; i++) {
        const rx = 140 + i * 310
        ctx.beginPath()
        ctx.moveTo(rx, 80)
        ctx.bezierCurveTo(
          rx - 80,
          360,
          rx + 90,
          640,
          rx - 30,
          CANVAS_H,
        )
        ctx.stroke()
      }
    } else {
      // Floating Astral Monoliths & Celestial Rings
      ctx.strokeStyle = '#A855F7'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(410, 340, 220, timeSec * 0.2, timeSec * 0.2 + Math.PI * 1.4)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(410, 340, 265, -timeSec * 0.15, -timeSec * 0.15 + Math.PI * 1.2)
      ctx.stroke()
    }

    // Sanctuary golden aura or Boss crimson vignette
    if (node.isSanctuary) {
      const sancGlow = ctx.createRadialGradient(410, 320, 30, 410, 320, 520)
      sancGlow.addColorStop(0, 'rgba(56, 189, 248, 0.35)')
      sancGlow.addColorStop(1, 'rgba(56, 189, 248, 0)')
      ctx.fillStyle = sancGlow
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    }
    ctx.restore()
  }

  // ==========================================================================
  // LAYER 2: Continuous 30fps Ambient Particle Effects
  // ==========================================================================
  private renderLayer2Particles(
    ctx: CanvasRenderingContext2D,
    campaignId: CampaignId,
    dt: number,
    timeSec: number,
  ) {
    ctx.save()
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i]
      p.phase += dt * 1.8
      p.x += (p.vx + Math.sin(p.phase) * 12) * dt
      p.y += p.vy * dt

      if (p.y < -20) {
        p.y = CANVAS_H + 15
        p.x = (p.x + 217) % CANVAS_W
      }
      if (p.x < 0) p.x += CANVAS_W
      if (p.x > CANVAS_W) p.x -= CANVAS_W

      if (campaignId === 'sunken-reliquary') {
        // Abyssal water bubbles & ghostly cyan wisps
        ctx.strokeStyle = i % 3 === 0 ? '#67E8F9' : '#22D3EE'
        ctx.fillStyle = 'rgba(34, 211, 238, 0.18)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius * 1.35, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      } else if (campaignId === 'forge-of-the-iron-titan') {
        // Rising orange embers & falling ash
        ctx.fillStyle = i % 3 === 0 ? '#FDE047' : i % 2 === 0 ? '#F97316' : '#94A3B8'
        ctx.globalAlpha = p.alpha * (0.65 + 0.35 * Math.sin(timeSec * 5 + i))
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fill()
      } else if (campaignId === 'whispering-canopy') {
        // Bioluminescent emerald/violet spores
        ctx.fillStyle = i % 2 === 0 ? '#34D399' : '#C084FC'
        ctx.globalAlpha = p.alpha * (0.55 + 0.45 * Math.cos(p.phase))
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius * 1.2, 0, Math.PI * 2)
        ctx.fill()
      } else {
        // Orbiting starfield dust & geometric rune shards
        ctx.fillStyle = i % 2 === 0 ? '#E879F9' : '#38BDF8'
        ctx.globalAlpha = p.alpha
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.phase * 0.5)
        ctx.fillRect(-p.radius, -p.radius, p.radius * 2, p.radius * 2)
        ctx.restore()
      }
    }
    ctx.restore()
  }

  // ==========================================================================
  // LAYER 3: Illustrated Scene Focal Art & Animated Boss Telegraphs
  // ==========================================================================
  private renderLayer3FocalArt(
    ctx: CanvasRenderingContext2D,
    campaignId: CampaignId,
    node: AdventureSceneNode,
    timeSec: number,
  ) {
    const boxX = 48
    const boxY = 108
    const boxW = 732
    const boxH = 376

    ctx.save()
    drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 18)
    ctx.fillStyle = 'rgba(8, 12, 20, 0.78)'
    ctx.fill()
    ctx.lineWidth = 2.5
    ctx.strokeStyle =
      campaignId === 'sunken-reliquary'
        ? '#22D3EE'
        : campaignId === 'forge-of-the-iron-titan'
          ? '#F97316'
          : campaignId === 'whispering-canopy'
            ? '#10B981'
            : '#A855F7'
    ctx.stroke()

    ctx.clip()

    const cx = boxX + boxW / 2
    const cy = boxY + boxH / 2
    const breathe = Math.sin(timeSec * 2.3) * 6

    // Ambient radial spotlight behind centerpiece
    const halo = ctx.createRadialGradient(cx, cy, 18, cx, cy, 260)
    halo.addColorStop(
      0,
      node.isFinale
        ? 'rgba(239, 68, 68, 0.36)'
        : node.isSanctuary
          ? 'rgba(56, 189, 248, 0.36)'
          : 'rgba(229, 169, 60, 0.24)',
    )
    halo.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = halo
    ctx.fillRect(boxX, boxY, boxW, boxH)

    // Bespoke procedural illustration per campaign & stage
    ctx.save()
    ctx.translate(cx, cy + breathe)

    if (node.isSanctuary) {
      // Radiant Sanctuary Shrine Alter & Revive Halo
      ctx.strokeStyle = '#38BDF8'
      ctx.lineWidth = 3.5
      ctx.beginPath()
      ctx.arc(0, -10, 92, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = 'rgba(56, 189, 248, 0.22)'
      ctx.fill()

      // Chalice / Sundial / Brazier centerpiece
      ctx.fillStyle = '#FBBF24'
      ctx.beginPath()
      ctx.moveTo(-42, 65)
      ctx.lineTo(42, 65)
      ctx.lineTo(22, 10)
      ctx.lineTo(48, -35)
      ctx.lineTo(-48, -35)
      ctx.lineTo(-22, 10)
      ctx.closePath()
      ctx.fill()

      ctx.fillStyle = '#67E8F9'
      ctx.beginPath()
      ctx.arc(0, -52, 24 + Math.sin(timeSec * 4) * 4, 0, Math.PI * 2)
      ctx.fill()
    } else if (node.stageNumber >= 11) {
      // Multi-Phase Boss Silhouette & Crown/Core Telegraph
      const bossColor =
        campaignId === 'sunken-reliquary'
          ? '#22D3EE'
          : campaignId === 'forge-of-the-iron-titan'
            ? '#F97316'
            : campaignId === 'whispering-canopy'
              ? '#10B981'
              : '#C084FC'

      // Outer menacing aura rings
      ctx.strokeStyle = bossColor
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(0, -8, 118 + Math.sin(timeSec * 3.5) * 6, 0, Math.PI * 2)
      ctx.stroke()

      // Boss armored shoulders & mantle
      ctx.fillStyle = '#0F172A'
      ctx.strokeStyle = bossColor
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(-125, 95)
      ctx.lineTo(-95, -35)
      ctx.lineTo(-38, -72)
      ctx.lineTo(0, -110)
      ctx.lineTo(38, -72)
      ctx.lineTo(95, -35)
      ctx.lineTo(125, 95)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()

      // Weak-point Crown / Furnace Core / Blight-Heart / Third Eye
      const weakColor = this.state.bossWeaknessExposed ? '#FACC15' : '#EF4444'
      ctx.fillStyle = weakColor
      ctx.beginPath()
      ctx.arc(0, -18, 28 + Math.sin(timeSec * 6) * 5, 0, Math.PI * 2)
      ctx.fill()

      // Glowing eyes
      ctx.fillStyle = '#F8FAFC'
      ctx.beginPath()
      ctx.arc(-24, -56, 7, 0, Math.PI * 2)
      ctx.arc(24, -56, 7, 0, Math.PI * 2)
      ctx.fill()
    } else if (node.crucialSkillCheck?.kind === 'putting') {
      // Crucial Putting Check Target Chute & Glowing Orb Illustration
      ctx.strokeStyle = '#34D399'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(-210, 75)
      ctx.quadraticCurveTo(0, -15, 195, -55)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(-210, 115)
      ctx.quadraticCurveTo(0, 25, 195, -15)
      ctx.stroke()

      // Target Socket Ring
      ctx.fillStyle = 'rgba(16, 185, 129, 0.3)'
      ctx.beginPath()
      ctx.arc(195, -35, 32, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()

      // Rolling Sphere animated along the channel
      const tProg = (timeSec * 0.55) % 1
      const ballX = -180 + tProg * 350
      const ballY = 85 - tProg * 115
      ctx.fillStyle = '#FBBF24'
      ctx.beginPath()
      ctx.arc(ballX, ballY, 18, 0, Math.PI * 2)
      ctx.fill()
    } else if (node.crucialSkillCheck?.kind === 'darts') {
      // Crucial Dartboard Target & Soul-Gem / Valve / Constellation Reticle
      const rings = [105, 78, 52, 24]
      rings.forEach((r, idx) => {
        ctx.strokeStyle = idx % 2 === 0 ? '#F43F5E' : '#38BDF8'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(0, 0, r, 0, Math.PI * 2)
        ctx.stroke()
      })
      ctx.fillStyle = '#EF4444'
      ctx.beginPath()
      ctx.arc(0, 0, 14 + Math.sin(timeSec * 5) * 3, 0, Math.PI * 2)
      ctx.fill()
    } else {
      // Atmospheric Dungeon / Bridge / Gate Centerpiece
      ctx.strokeStyle = '#E5A93C'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(0, 0, 96, 0, Math.PI * 2)
      ctx.stroke()

      // Crossed Halberds / Runic Gate / Bridge Arch
      ctx.beginPath()
      ctx.moveTo(-135, 65)
      ctx.quadraticCurveTo(0, -90, 135, 65)
      ctx.stroke()

      ctx.fillStyle = '#38BDF8'
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath()
        ctx.arc(i * 44, 10 + Math.abs(i) * 12, 9, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.restore()

    // Top-left & Bottom-left Overlay Badges inside the Art Viewport
    ctx.fillStyle = 'rgba(9, 13, 22, 0.86)'
    drawRoundedRect(ctx, boxX + 16, boxY + 14, 340, 36, 10)
    ctx.fill()
    ctx.fillStyle = '#F8FAFC'
    ctx.font = 'bold 16px Inter, system-ui, sans-serif'
    ctx.fillText(node.hazardBadge, boxX + 28, boxY + 38)

    if (this.state.bossWeaknessExposed) {
      ctx.fillStyle = 'rgba(234, 179, 8, 0.92)'
      drawRoundedRect(ctx, boxX + boxW - 265, boxY + 14, 249, 34, 10)
      ctx.fill()
      ctx.fillStyle = '#090D16'
      ctx.font = 'bold 14px Inter, system-ui, sans-serif'
      ctx.fillText('⚡ BOSS WEAKNESS EXPOSED (-2 DC)', boxX + boxW - 253, boxY + 36)
    }

    ctx.restore()
  }

  // ==========================================================================
  // LAYER 4: Graphic-Novel Narrative Frame, Tarot Cards & Party Dock
  // ==========================================================================
  public renderFrame(dt: number) {
    const ctx = this.ctx
    const timeSec = performance.now() / 1000
    const state = this.state
    const campaign = getAdventureCampaign(state.campaignId)
    const node = getActiveSceneNode(state)
    this.hotspots = []

    const shakeElapsed = Date.now() - state.combatShakeAt
    const isShaking = shakeElapsed >= 0 && shakeElapsed < 750
    const shakeX = isShaking ? Math.sin(timeSec * 55) * 9 : 0
    const shakeY = isShaking ? Math.cos(timeSec * 48) * 7 : 0

    ctx.save()
    ctx.translate(shakeX, shakeY)

    // 1. Render Layer 1 (Backdrops) & Layer 2 (30fps Particles) & Layer 3 (Focal Art)
    this.renderLayer1Backdrop(ctx, state.campaignId, node, timeSec)
    this.renderLayer2Particles(ctx, state.campaignId, dt, timeSec)
    this.renderLayer3FocalArt(ctx, state.campaignId, node, timeSec)

    // 2. Top Campaign Header Bar (y: 16..94)
    drawRoundedRect(ctx, 48, 16, CANVAS_W - 96, 78, 16)
    ctx.fillStyle = 'rgba(10, 14, 23, 0.9)'
    ctx.fill()
    ctx.lineWidth = 1.5
    ctx.strokeStyle = 'rgba(244, 241, 234, 0.16)'
    ctx.stroke()

    ctx.fillStyle = campaign.accentColor
    ctx.font = 'bold 24px Inter, system-ui, sans-serif'
    ctx.fillText(`⚔️ ${campaign.title.toUpperCase()}`, 72, 50)

    ctx.fillStyle = '#94A3B8'
    ctx.font = '600 15px Inter, system-ui, sans-serif'
    ctx.fillText(
      `ACT ${node.act} · STAGE ${node.stageNumber}/12 · PARTY SUCCESS: ${state.partySuccessPoints}/${state.requiredSuccessPoints} NEEDED`,
      72,
      76,
    )

    // Campaign Switcher Tabs (x: 680..1520)
    ADVENTURE_CAMPAIGN_LIST.forEach((camp, idx) => {
      const tabW = 205
      const tabX = 680 + idx * (tabW + 10)
      const tabY = 28
      const tabH = 52
      const isSelected = camp.id === state.campaignId
      const hotspotId = `camp-tab-${camp.id}`
      this.hotspots.push({
        id: hotspotId,
        x: tabX,
        y: tabY,
        w: tabW,
        h: tabH,
        action: { type: 'select-campaign', campaignId: camp.id },
      })

      drawRoundedRect(ctx, tabX, tabY, tabW, tabH, 11)
      ctx.fillStyle = isSelected
        ? camp.accentColor
        : this.hoveredHotspotId === hotspotId
          ? '#1E293B'
          : '#111827'
      ctx.fill()

      ctx.fillStyle = isSelected ? '#090D16' : '#E2E8F0'
      ctx.font = 'bold 13px Inter, system-ui, sans-serif'
      ctx.fillText(`${idx + 1}. ${camp.title.slice(0, 20)}`, tabX + 12, tabY + 24)
      ctx.font = '500 11px Inter, system-ui, sans-serif'
      ctx.fillStyle = isSelected ? '#1E293B' : '#94A3B8'
      ctx.fillText(camp.bossName.slice(0, 24), tabX + 12, tabY + 41)
    })

    // Threat Level Meter (0..10) on Top Right
    const threatX = 1565
    ctx.fillStyle = '#F8FAFC'
    ctx.font = 'bold 14px Inter, system-ui, sans-serif'
    ctx.fillText(`🔥 THREAT LEVEL: ${state.threatLevel}/10`, threatX, 44)
    for (let t = 0; t < 10; t++) {
      drawRoundedRect(ctx, threatX + t * 28, 54, 23, 14, 4)
      ctx.fillStyle =
        t < state.threatLevel
          ? state.threatLevel >= 7
            ? '#EF4444'
            : '#F59E0B'
          : '#1E293B'
      ctx.fill()
    }
    if (state.worldFlags.length > 0) {
      ctx.fillStyle = '#38BDF8'
      ctx.font = '600 12px Inter, system-ui, sans-serif'
      ctx.fillText(
        `FLAGS (${state.worldFlags.length}): ${state.worldFlags.slice(-2).join(', ')}`,
        threatX,
        84,
      )
    }

    // 3. Narrative Story Frame & Echo Callout (x: 48..780, y: 496..826)
    const storyX = 48
    const storyY = 496
    const storyW = 732
    const storyH = 330
    drawRoundedRect(ctx, storyX, storyY, storyW, storyH, 18)
    ctx.fillStyle = 'rgba(10, 14, 23, 0.92)'
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = 'rgba(229, 169, 60, 0.38)'
    ctx.stroke()

    ctx.fillStyle = '#F8FAFC'
    ctx.font = 'bold 25px Inter, system-ui, sans-serif'
    ctx.fillText(node.title, storyX + 24, storyY + 38)

    ctx.fillStyle = campaign.accentColor
    ctx.font = '600 14px Inter, system-ui, sans-serif'
    ctx.fillText(node.subtitle, storyX + 24, storyY + 60)

    let textCursorY = storyY + 86
    const echoes = resolveNarrativeEchoText(state, node)
    if (echoes.length > 0) {
      drawRoundedRect(ctx, storyX + 20, textCursorY - 18, storyW - 40, 52, 10)
      ctx.fillStyle =
        state.lastTransitionOutcome === 'fail'
          ? 'rgba(239, 68, 68, 0.16)'
          : 'rgba(56, 189, 248, 0.16)'
      ctx.fill()
      ctx.fillStyle =
        state.lastTransitionOutcome === 'fail' ? '#FCA5A5' : '#7DD3FC'
      ctx.font = 'italic 600 14px Inter, system-ui, sans-serif'
      textCursorY = fillWrappedText(
        ctx,
        `↳ ${echoes.join(' ')}`,
        storyX + 32,
        textCursorY + 2,
        storyW - 64,
        20,
        2,
      )
      textCursorY += 16
    }

    // Typewriter reveal for main scene prose
    const elapsedChars = Math.min(
      node.prose.length,
      Math.floor((Date.now() - this.nodeEnteredAt) / 10) + 45,
    )
    const visibleProse = node.prose.slice(0, elapsedChars)
    ctx.fillStyle = '#E2E8F0'
    ctx.font = '400 17px Georgia, serif'
    textCursorY = fillWrappedText(
      ctx,
      visibleProse,
      storyX + 24,
      textCursorY + 6,
      storyW - 48,
      25,
      5,
    )

    // Latest Resolution Log Strip at bottom of Narrative Box
    if (state.lastResolutionLog.length > 0) {
      drawRoundedRect(ctx, storyX + 20, storyY + storyH - 58, storyW - 40, 44, 10)
      ctx.fillStyle = 'rgba(20, 28, 44, 0.95)'
      ctx.fill()
      ctx.fillStyle = '#FDE68A'
      ctx.font = '600 13px Inter, system-ui, sans-serif'
      const latestLog = state.lastResolutionLog[0]
      ctx.fillText(
        latestLog.length > 92 ? `${latestLog.slice(0, 89)}...` : latestLog,
        storyX + 32,
        storyY + storyH - 31,
      )
    }

    // 4. Right Panel: Tarot Action Cards OR Victory/Defeat Banner (x: 804..1872, y: 108..618)
    const cardsAreaX = 804
    const cardsAreaY = 108
    const cardsAreaW = 1068
    const cardsAreaH = 505

    if (state.phase === 'victory' || state.phase === 'defeat') {
      drawRoundedRect(ctx, cardsAreaX, cardsAreaY, cardsAreaW, cardsAreaH, 22)
      ctx.fillStyle =
        state.phase === 'victory'
          ? 'rgba(6, 78, 59, 0.92)'
          : 'rgba(127, 29, 29, 0.92)'
      ctx.fill()
      ctx.lineWidth = 3
      ctx.strokeStyle = state.phase === 'victory' ? '#34D399' : '#F87171'
      ctx.stroke()

      ctx.fillStyle = '#F8FAFC'
      ctx.font = 'bold 42px Inter, system-ui, sans-serif'
      ctx.fillText(
        state.phase === 'victory'
          ? `🏆 VICTORY! ${campaign.bossName.toUpperCase()} VANQUISHED!`
          : `💀 PARTY FALLEN AT ${node.title.toUpperCase()}`,
        cardsAreaX + 48,
        cardsAreaY + 110,
      )

      ctx.fillStyle = '#E2E8F0'
      ctx.font = '500 20px Inter, system-ui, sans-serif'
      fillWrappedText(
        ctx,
        state.phase === 'victory'
          ? `Your party conquered all 12 stages of ${campaign.title} with ${state.worldFlags.length} World Flags unlocked and Threat Level ${state.threatLevel}/10!`
          : `The darkness of ${campaign.title} claimed your expedition. Rally your party and launch another run!`,
        cardsAreaX + 48,
        cardsAreaY + 170,
        cardsAreaW - 96,
        30,
        4,
      )

      const restartBtnX = cardsAreaX + 48
      const restartBtnY = cardsAreaY + 340
      const restartBtnW = 360
      const restartBtnH = 68
      this.hotspots.push({
        id: 'btn-restart-campaign',
        x: restartBtnX,
        y: restartBtnY,
        w: restartBtnW,
        h: restartBtnH,
        action: { type: 'restart-campaign' },
      })
      drawRoundedRect(ctx, restartBtnX, restartBtnY, restartBtnW, restartBtnH, 14)
      ctx.fillStyle = '#F59E0B'
      ctx.fill()
      ctx.fillStyle = '#090D16'
      ctx.font = 'bold 22px Inter, system-ui, sans-serif'
      ctx.fillText('🔄 Play Again / Reset Run', restartBtnX + 38, restartBtnY + 42)
    } else {
      const choices = node.choices
      const count = choices.length
      const gap = 16
      const cardW = Math.floor((cardsAreaW - gap * (count - 1)) / count)
      const dcRevealed = isDcRevealedToParty(state, node)
      const localPlayer = state.players[this.localUserId]

      choices.forEach((card: AdventureActionCard, idx: number) => {
        const cx = cardsAreaX + idx * (cardW + gap)
        const cy = cardsAreaY
        const ch = cardsAreaH
        const hotspotId = `card-${card.id}`
        this.hotspots.push({
          id: hotspotId,
          x: cx,
          y: cy,
          w: cardW,
          h: ch,
          action: { type: 'lock-card', cardId: card.id },
        })

        const isLocalLocked = localPlayer?.lockedCardId === card.id
        const isHovered = this.hoveredHotspotId === hotspotId
        const attrSpec = ATTRIBUTE_BADGE[card.attribute]

        drawRoundedRect(ctx, cx, cy, cardW, ch, 18)
        ctx.fillStyle = isLocalLocked
          ? 'rgba(30, 41, 59, 0.96)'
          : isHovered
            ? 'rgba(23, 33, 50, 0.95)'
            : 'rgba(12, 18, 30, 0.92)'
        ctx.fill()
        ctx.lineWidth = isLocalLocked ? 3.5 : 2
        ctx.strokeStyle = isLocalLocked
          ? '#FACC15'
          : isHovered
            ? attrSpec.color
            : 'rgba(244, 241, 234, 0.16)'
        ctx.stroke()

        // Attribute Header Banner
        drawRoundedRect(ctx, cx + 14, cy + 14, cardW - 28, 42, 10)
        ctx.fillStyle = attrSpec.bg
        ctx.fill()
        ctx.fillStyle = attrSpec.color
        ctx.font = 'bold 15px Inter, system-ui, sans-serif'
        ctx.fillText(
          `${attrSpec.icon} ${attrSpec.label} CHECK`,
          cx + 26,
          cy + 41,
        )

        // Scene Tags Row ([LOCK], [TRAP], [CHASM], [COMBAT])
        ctx.fillStyle = '#94A3B8'
        ctx.font = 'bold 11px Inter, system-ui, sans-serif'
        ctx.fillText(
          card.tags.map((t) => `[${t.toUpperCase()}]`).join(' '),
          cx + 18,
          cy + 78,
        )

        // Card Title
        ctx.fillStyle = '#F8FAFC'
        ctx.font = 'bold 19px Inter, system-ui, sans-serif'
        const afterTitleY = fillWrappedText(
          ctx,
          card.title,
          cx + 18,
          cy + 108,
          cardW - 36,
          24,
          2,
        )

        // Card Narrative Choice Description
        ctx.fillStyle = '#CBD5E1'
        ctx.font = '400 14.5px Inter, system-ui, sans-serif'
        fillWrappedText(
          ctx,
          card.description,
          cx + 18,
          afterTitleY + 10,
          cardW - 36,
          21,
          5,
        )

        // DC & Failure Consequence Box (Revealed by Arcane Sight / Neural Ward / Lock-in)
        const dcBoxY = cy + ch - 155
        drawRoundedRect(ctx, cx + 14, dcBoxY, cardW - 28, 72, 10)
        ctx.fillStyle = 'rgba(7, 10, 18, 0.88)'
        ctx.fill()

        const effectiveDc = computeEffectiveCardDc(state, node, card)
        const showTrueDc = dcRevealed || isLocalLocked
        const isScrambled = Boolean(node.scramblesDisplayedDc && !dcRevealed)

        ctx.font = 'bold 15px Inter, system-ui, sans-serif'
        if (isScrambled) {
          ctx.fillStyle = '#E879F9'
          ctx.fillText('👁️ DC: 9? 19? Ψ (SCRAMBLED)', cx + 24, dcBoxY + 26)
          ctx.fillStyle = '#C084FC'
          ctx.font = '500 12px Inter, system-ui, sans-serif'
          ctx.fillText('Use Arcane Sight or Neural Ward!', cx + 24, dcBoxY + 50)
        } else if (showTrueDc) {
          ctx.fillStyle = '#38BDF8'
          ctx.fillText(
            `🎯 TARGET DC: ${effectiveDc}${effectiveDc < card.dc ? ` (Base ${card.dc})` : ''}`,
            cx + 24,
            dcBoxY + 26,
          )
          ctx.fillStyle = '#FCA5A5'
          ctx.font = '500 12px Inter, system-ui, sans-serif'
          const penShort =
            card.failPenaltyText.length > 36
              ? `${card.failPenaltyText.slice(0, 34)}...`
              : card.failPenaltyText
          ctx.fillText(penShort, cx + 24, dcBoxY + 50)
        } else {
          ctx.fillStyle = '#FBBF24'
          ctx.fillText(
            `🔒 DC ?? · Fail: -${card.failHpDamage} HP`,
            cx + 24,
            dcBoxY + 26,
          )
          ctx.fillStyle = '#94A3B8'
          ctx.font = '500 12px Inter, system-ui, sans-serif'
          ctx.fillText('Click to Lock In (or cast Arcane Sight)', cx + 24, dcBoxY + 50)
        }

        // Real-Time Colored Player Name Badges Hovering / Locked on This Card
        const cardPlayers = Object.values(state.players).filter(
          (p) => p.lockedCardId === card.id || p.hoveredCardId === card.id,
        )
        cardPlayers.slice(0, 4).forEach((p, pIdx) => {
          const badgeX = cx + 14 + (pIdx % 2) * ((cardW - 34) / 2 + 6)
          const badgeY = cy + ch - 72 + Math.floor(pIdx / 2) * 30
          const badgeW = (cardW - 34) / 2
          drawRoundedRect(ctx, badgeX, badgeY, badgeW, 25, 7)
          ctx.fillStyle = p.avatarColor || '#38BDF8'
          ctx.fill()
          ctx.fillStyle = '#090D16'
          ctx.font = 'bold 12px Inter, system-ui, sans-serif'
          const tag = p.rollOutcome !== 'pending' ? `✓${p.totalRoll}` : '🔒'
          ctx.fillText(
            `${tag} ${p.displayName.slice(0, 9)}`,
            badgeX + 8,
            badgeY + 17,
          )
        })
      })
    }

    // 5. Crucial Physical Lounge Skill Check Bar & Action Controls (x: 804..1872, y: 626..826)
    const midBarX = 804
    const midBarY = 626
    const midBarW = 1068
    const midBarH = 200
    drawRoundedRect(ctx, midBarX, midBarY, midBarW, midBarH, 18)
    ctx.fillStyle = 'rgba(11, 16, 27, 0.94)'
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = state.crucialCheck?.active
      ? '#38BDF8'
      : 'rgba(244, 241, 234, 0.16)'
    ctx.stroke()

    if (state.crucialCheck) {
      const cc = state.crucialCheck
      const elapsedSec = Math.floor((Date.now() - cc.startedAt) / 1000)
      const remainSec = Math.max(0, cc.durationSec - elapsedSec)

      ctx.fillStyle = cc.resolved
        ? cc.outcome === 'fail'
          ? '#F87171'
          : '#34D399'
        : '#38BDF8'
      ctx.font = 'bold 19px Inter, system-ui, sans-serif'
      ctx.fillText(
        `${cc.kind === 'putting' ? '⛳' : cc.kind === 'darts' ? '🎯' : '🎲'} ${cc.title.toUpperCase()} ${!cc.resolved ? `· ⏱ ${remainSec}s SPOTLIGHT` : `· ${cc.outcome.toUpperCase()}`}`,
        midBarX + 24,
        midBarY + 34,
      )

      ctx.fillStyle = '#E2E8F0'
      ctx.font = '400 14.5px Inter, system-ui, sans-serif'
      fillWrappedText(
        ctx,
        cc.resolved ? cc.summaryText : cc.instruction,
        midBarX + 24,
        midBarY + 62,
        midBarW - 48,
        20,
        2,
      )

      if (!cc.resolved) {
        const fbBtnX = midBarX + 24
        const fbBtnY = midBarY + 122
        const fbBtnW = 355
        const fbBtnH = 58
        this.hotspots.push({
          id: 'btn-crucial-fallback',
          x: fbBtnX,
          y: fbBtnY,
          w: fbBtnW,
          h: fbBtnH,
          action: { type: 'roll-crucial-fallback' },
        })
        drawRoundedRect(ctx, fbBtnX, fbBtnY, fbBtnW, fbBtnH, 12)
        ctx.fillStyle =
          this.hoveredHotspotId === 'btn-crucial-fallback' ? '#38BDF8' : '#0284C7'
        ctx.fill()
        ctx.fillStyle = '#F8FAFC'
        ctx.font = 'bold 16px Inter, system-ui, sans-serif'
        ctx.fillText(
          `🎲 Roll Couch Fallback D20 (DC ${cc.fallbackDc})`,
          fbBtnX + 22,
          fbBtnY + 35,
        )
      }
    } else {
      ctx.fillStyle = '#FACC15'
      ctx.font = 'bold 18px Inter, system-ui, sans-serif'
      ctx.fillText(
        '🎲 INDIVIDUAL CONSEQUENCE & PARTY PROGRESSION PHASE',
        midBarX + 24,
        midBarY + 36,
      )
      ctx.fillStyle = '#CBD5E1'
      ctx.font = '400 15px Inter, system-ui, sans-serif'
      ctx.fillText(
        '1. Click an Action Card above to lock your choice.  2. Trigger Class Abilities or Items below.  3. Roll your D20 & Advance!',
        midBarX + 24,
        midBarY + 68,
      )
    }

    // Primary Roll D20 Button & Advance Scene Button
    const rollBtnX = midBarX + 400
    const rollBtnY = midBarY + 122
    const rollBtnW = 305
    const rollBtnH = 58
    this.hotspots.push({
      id: 'btn-roll-d20',
      x: rollBtnX,
      y: rollBtnY,
      w: rollBtnW,
      h: rollBtnH,
      action: { type: 'roll-d20' },
    })
    drawRoundedRect(ctx, rollBtnX, rollBtnY, rollBtnW, rollBtnH, 12)
    ctx.fillStyle =
      this.hoveredHotspotId === 'btn-roll-d20' ? '#FBBF24' : '#E5A93C'
    ctx.fill()
    ctx.fillStyle = '#090D16'
    ctx.font = 'bold 18px Inter, system-ui, sans-serif'
    const myPlayer = state.players[this.localUserId]
    ctx.fillText(
      myPlayer?.isGhost
        ? '👻 Roll Spectral Ghost D20'
        : myPlayer?.d20Roll
          ? `🎲 Re-Roll / Rolled (${myPlayer.totalRoll})`
          : '🎲 Roll My Check D20!',
      rollBtnX + 24,
      rollBtnY + 36,
    )

    const advBtnX = midBarX + 725
    const advBtnY = midBarY + 122
    const advBtnW = 318
    const advBtnH = 58
    this.hotspots.push({
      id: 'btn-advance-scene',
      x: advBtnX,
      y: advBtnY,
      w: advBtnW,
      h: advBtnH,
      action: { type: 'advance-scene' },
    })
    drawRoundedRect(ctx, advBtnX, advBtnY, advBtnW, advBtnH, 12)
    ctx.fillStyle =
      this.hoveredHotspotId === 'btn-advance-scene' ? '#10B981' : '#059669'
    ctx.fill()
    ctx.fillStyle = '#F8FAFC'
    ctx.font = 'bold 17px Inter, system-ui, sans-serif'
    ctx.fillText(
      `⏭ Resolve & Advance (${state.partySuccessPoints}/${state.requiredSuccessPoints})`,
      advBtnX + 22,
      advBtnY + 36,
    )

    // 6. Bottom Dock: Archetype Selector, Party Portraits, Items & 2D Polyhedral D20 Showcase (y: 840..1064)
    const dockX = 48
    const dockY = 840
    const dockW = CANVAS_W - 96
    const dockH = 224
    drawRoundedRect(ctx, dockX, dockY, dockW, dockH, 18)
    ctx.fillStyle = 'rgba(9, 13, 22, 0.95)'
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = 'rgba(244, 241, 234, 0.16)'
    ctx.stroke()

    // Left Column of Bottom Dock: Choose Archetype + Active Player Ability & Items (x: 68..690)
    ctx.fillStyle = '#94A3B8'
    ctx.font = 'bold 13px Inter, system-ui, sans-serif'
    ctx.fillText('CHOOSE YOUR CLASS ARCHETYPE & USE STARTING ITEMS:', 70, dockY + 28)

    const archIds: ArchetypeId[] = ['vanguard', 'shadow', 'arcanist', 'cleric']
    archIds.forEach((archId, idx) => {
      const spec = ARCHETYPE_SPECS[archId]
      const bx = 70 + idx * 152
      const by = dockY + 40
      const bw = 144
      const bh = 54
      const isMine = myPlayer?.archetype === archId
      const hId = `arch-${archId}`
      this.hotspots.push({
        id: hId,
        x: bx,
        y: by,
        w: bw,
        h: bh,
        action: { type: 'select-archetype', archetype: archId },
      })
      drawRoundedRect(ctx, bx, by, bw, bh, 10)
      ctx.fillStyle = isMine ? spec.color : '#161F30'
      ctx.fill()
      ctx.fillStyle = isMine ? '#090D16' : '#F8FAFC'
      ctx.font = 'bold 14px Inter, system-ui, sans-serif'
      ctx.fillText(`${spec.icon} ${spec.name}`, bx + 12, by + 23)
      ctx.font = '500 11px Inter, system-ui, sans-serif'
      ctx.fillStyle = isMine ? '#1E293B' : '#94A3B8'
      ctx.fillText(
        `${spec.maxHp}HP · M+${spec.stats.might} F+${spec.stats.finesse} A+${spec.stats.arcana}`,
        bx + 12,
        by + 42,
      )
    })

    // Local Player's Active Class Ability & 3 Starting Items Row (y: dockY + 108)
    const activeArch = ARCHETYPE_SPECS[myPlayer?.archetype ?? 'vanguard']
    const abilityAvailable =
      !myPlayer || myPlayer.abilityUsedInAct !== node.act
    const abilX = 70
    const abilY = dockY + 108
    const abilW = 210
    const abilH = 96
    this.hotspots.push({
      id: 'btn-use-ability',
      x: abilX,
      y: abilY,
      w: abilW,
      h: abilH,
      action: { type: 'use-ability' },
    })
    drawRoundedRect(ctx, abilX, abilY, abilW, abilH, 12)
    ctx.fillStyle = abilityAvailable ? 'rgba(139, 92, 246, 0.28)' : '#111827'
    ctx.fill()
    ctx.lineWidth = 1.5
    ctx.strokeStyle = abilityAvailable ? '#A855F7' : '#334155'
    ctx.stroke()
    ctx.fillStyle = abilityAvailable ? '#F8FAFC' : '#64748B'
    ctx.font = 'bold 14px Inter, system-ui, sans-serif'
    ctx.fillText(
      `⚡ ${activeArch.abilityName}`,
      abilX + 12,
      abilY + 24,
    )
    ctx.font = '400 11.5px Inter, system-ui, sans-serif'
    ctx.fillStyle = abilityAvailable ? '#CBD5E1' : '#64748B'
    fillWrappedText(
      ctx,
      abilityAvailable ? activeArch.abilityDescription : 'Used in this Act',
      abilX + 12,
      abilY + 44,
      abilW - 24,
      16,
      3,
    )

    const myItems = myPlayer?.items ?? activeArch.startingItems
    activeArch.startingItems.forEach((itemId, idx) => {
      const itemSpec = ADVENTURE_ITEM_SPECS[itemId]
      const hasItem = myItems.includes(itemId)
      const ix = 294 + idx * 128
      const iy = dockY + 108
      const iw = 120
      const ih = 96
      if (hasItem) {
        this.hotspots.push({
          id: `item-${itemId}`,
          x: ix,
          y: iy,
          w: iw,
          h: ih,
          action: { type: 'use-item', itemId },
        })
      }
      drawRoundedRect(ctx, ix, iy, iw, ih, 12)
      ctx.fillStyle = hasItem ? '#162234' : '#0D131F'
      ctx.fill()
      ctx.lineWidth = 1.5
      ctx.strokeStyle = hasItem ? '#38BDF8' : '#1E293B'
      ctx.stroke()
      ctx.fillStyle = hasItem ? '#F8FAFC' : '#475569'
      ctx.font = 'bold 12.5px Inter, system-ui, sans-serif'
      ctx.fillText(`${itemSpec.icon} ${itemSpec.name}`, ix + 8, iy + 24)
      ctx.font = '400 10.5px Inter, system-ui, sans-serif'
      ctx.fillStyle = hasItem ? '#94A3B8' : '#475569'
      fillWrappedText(
        ctx,
        hasItem ? itemSpec.description : 'Expended',
        ix + 8,
        iy + 44,
        iw - 16,
        14,
        3,
      )
    })

    // Center Column of Bottom Dock: Party Member Portraits & Spectral Ghost Status (x: 695..1470)
    ctx.fillStyle = '#94A3B8'
    ctx.font = 'bold 13px Inter, system-ui, sans-serif'
    ctx.fillText(
      'PARTY ROSTER (CLICK AN ALLY TO TETHER WHEN IN SPECTRAL GHOST MODE):',
      700,
      dockY + 28,
    )

    const partyMembers: AdventurePlayerState[] = Object.values(state.players)
    if (partyMembers.length === 0) {
      ctx.fillStyle = '#64748B'
      ctx.font = 'italic 15px Inter, system-ui, sans-serif'
      ctx.fillText(
        'Click any Class Archetype or Action Card to join the expedition party!',
        700,
        dockY + 95,
      )
    } else {
      partyMembers.slice(0, 4).forEach((member, idx) => {
        const px = 700 + idx * 194
        const py = dockY + 42
        const pw = 184
        const ph = 162
        const mSpec = ARCHETYPE_SPECS[member.archetype]

        this.hotspots.push({
          id: `party-member-${member.userId}`,
          x: px,
          y: py,
          w: pw,
          h: ph,
          action: { type: 'tether-ghost', targetUserId: member.userId },
        })

        drawRoundedRect(ctx, px, py, pw, ph, 14)
        ctx.fillStyle = member.isGhost
          ? 'rgba(8, 51, 68, 0.85)'
          : 'rgba(17, 24, 39, 0.92)'
        ctx.fill()
        ctx.lineWidth = member.isGhost ? 3 : 2
        ctx.strokeStyle = member.isGhost ? '#22D3EE' : mSpec.color
        ctx.stroke()

        ctx.fillStyle = member.isGhost ? '#67E8F9' : '#F8FAFC'
        ctx.font = 'bold 15px Inter, system-ui, sans-serif'
        ctx.fillText(
          `${member.isGhost ? '👻' : mSpec.icon} ${member.displayName.slice(0, 12)}`,
          px + 12,
          py + 26,
        )

        ctx.fillStyle = member.isGhost ? '#22D3EE' : mSpec.color
        ctx.font = '600 12px Inter, system-ui, sans-serif'
        ctx.fillText(
          member.isGhost ? 'SPECTRAL GHOST (0 HP)' : `${mSpec.name} · ${member.hp}/${member.maxHp} HP`,
          px + 12,
          py + 46,
        )

        // Animated HP Bar
        drawRoundedRect(ctx, px + 12, py + 56, pw - 24, 14, 6)
        ctx.fillStyle = '#090D16'
        ctx.fill()
        const hpRatio = Math.max(0, Math.min(1, member.hp / member.maxHp))
        if (hpRatio > 0) {
          drawRoundedRect(
            ctx,
            px + 12,
            py + 56,
            Math.max(8, (pw - 24) * hpRatio),
            14,
            6,
          )
          ctx.fillStyle =
            hpRatio > 0.5 ? '#10B981' : hpRatio > 0.25 ? '#F59E0B' : '#EF4444'
          ctx.fill()
        }

        // Item icons & Roll badge
        ctx.fillStyle = '#CBD5E1'
        ctx.font = '500 12px Inter, system-ui, sans-serif'
        const itemIcons = member.items
          .map((i) => ADVENTURE_ITEM_SPECS[i].icon)
          .join(' ')
        ctx.fillText(`Items: ${itemIcons || 'None'}`, px + 12, py + 92)

        if (member.damageShieldedBy) {
          ctx.fillStyle = '#38BDF8'
          ctx.font = '600 11px Inter, system-ui, sans-serif'
          ctx.fillText(
            `🛡️ ${member.damageShieldedBy.slice(0, 20)}`,
            px + 12,
            py + 112,
          )
        }

        ctx.font = 'bold 13px Inter, system-ui, sans-serif'
        if (member.isGhost) {
          ctx.fillStyle = '#67E8F9'
          ctx.fillText(
            member.spectralRoll
              ? `Spectral D20: ${member.spectralRoll} (+${member.spectralBonusGranted})`
              : 'Roll D20 to buff ally!',
            px + 12,
            py + 142,
          )
        } else if (member.rollOutcome !== 'pending') {
          ctx.fillStyle =
            member.rollOutcome === 'fail' ? '#F87171' : '#34D399'
          ctx.fillText(
            `🎲 Rolled: ${member.totalRoll} (${member.rollOutcome.toUpperCase()})`,
            px + 12,
            py + 142,
          )
        } else {
          ctx.fillStyle = '#94A3B8'
          ctx.fillText(
            member.lockedCardId ? 'Card Locked · Ready' : 'Selecting Card...',
            px + 12,
            py + 142,
          )
        }
      })
    }

    // Right Column of Bottom Dock: Animated 2D Polyhedral D20 Showcase (x: 1490..1852)
    const d20BoxX = 1490
    const d20BoxY = dockY + 20
    const d20BoxW = 362
    const d20BoxH = 184
    drawRoundedRect(ctx, d20BoxX, d20BoxY, d20BoxW, d20BoxH, 16)
    ctx.fillStyle = 'rgba(13, 19, 33, 0.96)'
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = '#E5A93C'
    ctx.stroke()

    // Draw Polyhedral Icosahedron (D20) Hexagon + Inner Triangles
    const hexX = d20BoxX + 76
    const hexY = d20BoxY + 92
    const hexR = 54
    const showcase = state.lastDiceShowcase
    const spinAngle =
      showcase && Date.now() - showcase.timestamp < 900
        ? (Date.now() - showcase.timestamp) * 0.015
        : 0

    ctx.save()
    ctx.translate(hexX, hexY)
    ctx.rotate(spinAngle)
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const ang = (i * Math.PI) / 3 - Math.PI / 2
      const vx = Math.cos(ang) * hexR
      const vy = Math.sin(ang) * hexR
      if (i === 0) ctx.moveTo(vx, vy)
      else ctx.lineTo(vx, vy)
    }
    ctx.closePath()
    ctx.fillStyle =
      showcase?.outcome === 'critical'
        ? '#F59E0B'
        : showcase?.outcome === 'success'
          ? '#059669'
          : showcase?.outcome === 'spectral'
            ? '#0891B2'
            : showcase?.outcome === 'fail'
              ? '#B91C1C'
              : '#1E293B'
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = '#F8FAFC'
    ctx.stroke()
    ctx.restore()

    ctx.fillStyle = '#F8FAFC'
    ctx.font = 'bold 30px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(
      showcase ? String(showcase.d20) : '20',
      hexX,
      hexY + 11,
    )
    ctx.textAlign = 'left'

    ctx.fillStyle = '#FACC15'
    ctx.font = 'bold 15px Inter, system-ui, sans-serif'
    ctx.fillText(
      showcase ? `${showcase.rollerName}` : 'POLYHEDRAL D20',
      d20BoxX + 148,
      d20BoxY + 52,
    )
    ctx.fillStyle = '#E2E8F0'
    ctx.font = 'bold 20px Inter, system-ui, sans-serif'
    ctx.fillText(
      showcase
        ? `${showcase.d20} + ${showcase.modifier} = ${showcase.total}`
        : 'Ready to Roll',
      d20BoxX + 148,
      d20BoxY + 86,
    )
    ctx.fillStyle =
      showcase?.outcome === 'fail' ? '#FCA5A5' : '#6EE7B7'
    ctx.font = 'bold 14px Inter, system-ui, sans-serif'
    ctx.fillText(
      showcase
        ? `vs DC ${showcase.dc} · ${showcase.outcome.toUpperCase()}`
        : 'Click Screen or Wrist HUD',
      d20BoxX + 148,
      d20BoxY + 118,
    )

    // Crimson Damage Flash or Golden Triumph Particle Burst Overlay
    if (isShaking) {
      ctx.fillStyle = 'rgba(220, 38, 38, 0.22)'
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    }
    const burstElapsed = Date.now() - state.triumphBurstAt
    if (burstElapsed >= 0 && burstElapsed < 900) {
      ctx.strokeStyle = `rgba(250, 204, 21, ${1 - burstElapsed / 900})`
      ctx.lineWidth = 6
      ctx.strokeRect(8, 8, CANVAS_W - 16, CANVAS_H - 16)
    }

    ctx.restore()
    this.texture.needsUpdate = true
  }
}

let sharedQuestCanvasController: CinemaQuestCanvasController | null = null

export function getCinemaQuestCanvas(): CinemaQuestCanvasController {
  if (!sharedQuestCanvasController) {
    sharedQuestCanvasController = new CinemaQuestCanvasController()
  }
  return sharedQuestCanvasController
}

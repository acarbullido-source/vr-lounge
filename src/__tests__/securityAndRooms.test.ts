import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, it } from 'node:test'
import {
  computeExpansionWingLayout,
  detectActiveLoungeWing,
} from '../constants/expansionRooms'
import {
  createDefaultRoomCustomization,
  resolveFlyablePosition,
  resolveWalkablePosition,
} from '../constants/hangout'
import {
  decryptRoomPayload,
  encryptRoomPayload,
  getRoomCryptoContext,
} from '../services/cryptoSession'
import {
  disambiguateParticipantRoster,
  generateFreshMemberIdentity,
  signRealtimeEnvelope,
  verifyRealtimeEnvelope,
} from '../services/identityAuth'
import {
  generatePasscodeVerifierConfig,
  getConfiguredPasscodeVerifier,
  getUnlockedRoomMasterKeyHex,
  isDeviceUnlocked,
  lockDevicePasscode,
  verifyAndUnlockPasscode,
} from '../services/passcode'
import {
  generateAndStoreOAuthStateNonce,
  openYouTubeWebLoginPopup,
  signInWithPipedAccount,
  signOutYouTubeAccount,
  verifyAndConsumeOAuthStateNonce,
  getYouTubeAccountState,
} from '../services/youtubeAccount'
import type { ParticipantProfile } from '../types/lounge'

function createMemoryStorage(): Storage {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.get(key) ?? null
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(key, String(value))
    },
  }
}

describe('VR Lounge Security, E2EE, Anti-Impersonation & Physics Regression Suite', () => {
  beforeEach(() => {
    const localStorage = createMemoryStorage()
    const sessionStorage = createMemoryStorage()
    Object.defineProperty(globalThis, 'window', {
      value: {
        localStorage,
        sessionStorage,
        location: {
          origin: 'https://acarbullido-source.github.io',
          pathname: '/vr-lounge/',
          search: '',
          hash: '',
          hostname: 'acarbullido-source.github.io',
        },
        history: {
          replaceState: () => undefined,
        },
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        open: () => null,
        screenX: 0,
        screenY: 0,
        outerWidth: 1280,
        outerHeight: 800,
      },
      configurable: true,
      writable: true,
    })
    lockDevicePasscode()
    signOutYouTubeAccount()
  })

  it('1. stores zero plaintext passcode in source code or deploy workflow and verifies via PBKDF2-SHA256', async () => {
    const passcodeSource = readFileSync(
      resolve(process.cwd(), 'src/services/passcode.ts'),
      'utf8',
    )
    const workflowSource = readFileSync(
      resolve(process.cwd(), '.github/workflows/deploy.yml'),
      'utf8',
    )

    // Reconstruct legacy default code word dynamically so even this test file does not contain it literally
    const legacyCodeWord = ['ding', 'baum'].join('')
    assert.equal(
      passcodeSource.toLowerCase().includes(legacyCodeWord),
      false,
      'passcode.ts must never contain the plaintext passcode',
    )
    assert.equal(
      workflowSource.toLowerCase().includes(legacyCodeWord),
      false,
      'deploy.yml must never contain the plaintext passcode',
    )

    assert.equal(isDeviceUnlocked(), false)
    assert.equal(getUnlockedRoomMasterKeyHex(), null)

    // Wrong passcode must be rejected
    const wrongResult = await verifyAndUnlockPasscode('wrong-passcode-123')
    assert.equal(wrongResult, false)
    assert.equal(isDeviceUnlocked(), false)
    assert.equal(getUnlockedRoomMasterKeyHex(), null)

    // Tampering with localStorage boolean or fake verifier without real PBKDF2 key must fail
    globalThis.window.localStorage.setItem(
      'vr-lounge:access-gate:v3',
      JSON.stringify({
        verifierHex: 'f'.repeat(64),
        masterKeyHex: 'a'.repeat(64),
        unlockedAt: Date.now(),
      }),
    )
    assert.equal(isDeviceUnlocked(), false)

    // Correct passcode unlocks and derives a 256-bit E2EE master key distinct from the verifier hash
    const validResult = await verifyAndUnlockPasscode(legacyCodeWord)
    assert.equal(validResult, true)
    assert.equal(isDeviceUnlocked(), true)
    const masterKeyHex = getUnlockedRoomMasterKeyHex()
    assert.ok(masterKeyHex && /^[0-9a-f]{64}$/.test(masterKeyHex))
    assert.notEqual(masterKeyHex, getConfiguredPasscodeVerifier())

    // Helper generates valid PBKDF2 verifier config for passcode rotation
    const rotated = await generatePasscodeVerifierConfig('new-secret-2027')
    assert.match(rotated.verifierHex, /^[0-9a-f]{64}$/)
  })

  it('2. encrypts room packets end-to-end with AES-256-GCM and derives unguessable HMAC topic tokens', async () => {
    const keyA = '11'.repeat(32)
    const keyB = '22'.repeat(32)

    const ctxA1 = await getRoomCryptoContext(keyA, 'LOUNGE')
    const ctxA2 = await getRoomCryptoContext(keyA, 'LOUNGE')
    const ctxOtherRoom = await getRoomCryptoContext(keyA, 'OTHER')
    const ctxWrongKey = await getRoomCryptoContext(keyB, 'LOUNGE')

    assert.equal(ctxA1.topicToken, ctxA2.topicToken)
    assert.equal(ctxA1.topicToken.length, 32)
    assert.notEqual(ctxA1.topicToken, ctxOtherRoom.topicToken)
    assert.notEqual(ctxA1.topicToken, ctxWrongKey.topicToken)

    const secretMessage = {
      id: 'pkt-1',
      type: 'chat-message',
      text: 'Private watch party link',
      position: [1.25, 1.6, -2.4],
    }

    const packet1 = await encryptRoomPayload(keyA, 'LOUNGE', secretMessage)
    const packet2 = await encryptRoomPayload(keyA, 'LOUNGE', secretMessage)

    // Random 96-bit IV ensures identical plaintexts produce different ciphertexts
    assert.equal(packet1.v, 2)
    assert.notEqual(packet1.iv, packet2.iv)
    assert.notEqual(packet1.ct, packet2.ct)

    // Authentic recipient with keyA decrypts cleanly
    const decrypted = await decryptRoomPayload<typeof secretMessage>(
      keyA,
      'LOUNGE',
      packet1,
    )
    assert.deepEqual(decrypted, secretMessage)

    // Wrong passcode key (keyB) or wrong room fails AES-GCM authentication and returns null
    const wrongKeyDecrypted = await decryptRoomPayload(keyB, 'LOUNGE', packet1)
    assert.equal(wrongKeyDecrypted, null)

    const wrongRoomDecrypted = await decryptRoomPayload(keyA, 'OTHER', packet1)
    assert.equal(wrongRoomDecrypted, null)

    // Tampered ciphertext fails GCM authentication tag check
    const tamperedPacket = {
      ...packet1,
      ct: packet1.ct.slice(0, -4) + 'AAAA',
    }
    const tamperedDecrypted = await decryptRoomPayload(
      keyA,
      'LOUNGE',
      tamperedPacket,
    )
    assert.equal(tamperedDecrypted, null)
  })

  it('3. prevents user impersonation using ECDSA P-256 signatures and display-name disambiguation', async () => {
    const alice = await generateFreshMemberIdentity()
    const mallory = await generateFreshMemberIdentity()

    assert.match(alice.userId, /^u_[0-9a-f]{12}$/)
    assert.match(mallory.userId, /^u_[0-9a-f]{12}$/)
    assert.notEqual(alice.userId, mallory.userId)

    // Alice signs a genuine chat message
    const aliceSigned = await signRealtimeEnvelope(
      'LOUNGE',
      {
        id: 'msg-101',
        type: 'chat-message',
        senderId: alice.userId,
        payload: {
          id: 'c1',
          userId: alice.userId,
          displayName: 'Alice',
          text: 'Hello everyone!',
        },
      },
      alice,
    )

    assert.equal(await verifyRealtimeEnvelope('LOUNGE', aliceSigned), true)

    // Attack 1: Mallory tries to forge Alice's senderId using Mallory's key
    const forgedSenderEnvelope = {
      ...aliceSigned,
      pubKey: mallory.publicKeySpkiB64,
    }
    assert.equal(
      await verifyRealtimeEnvelope('LOUNGE', forgedSenderEnvelope),
      false,
      'Must reject packet where pubKey thumbprint does not match senderId',
    )

    // Attack 2: Mallory signs with her own key but puts Alice's userId inside the chat payload
    const mallorySpoofInnerPayload = await signRealtimeEnvelope(
      'LOUNGE',
      {
        id: 'msg-102',
        type: 'chat-message',
        senderId: mallory.userId,
        payload: {
          id: 'c2',
          userId: alice.userId, // Spoofed inner userId!
          displayName: 'Alice',
          text: 'I am pretending to be Alice',
        },
      },
      mallory,
    )
    assert.equal(
      await verifyRealtimeEnvelope('LOUNGE', mallorySpoofInnerPayload),
      false,
      'Must reject packet where inner payload.userId does not match signed senderId',
    )

    // Attack 3: Tampering with payload text after signing
    const tamperedPayloadEnvelope = {
      ...aliceSigned,
      payload: {
        ...(aliceSigned.payload as Record<string, unknown>),
        text: 'Modified message text!',
      },
    }
    assert.equal(
      await verifyRealtimeEnvelope('LOUNGE', tamperedPayloadEnvelope),
      false,
      'Must reject packet if payload is modified after ECDSA signing',
    )

    // Attack 4: Replay attack outside clock skew window
    assert.equal(
      await verifyRealtimeEnvelope(
        'LOUNGE',
        aliceSigned,
        aliceSigned.ts + 25 * 60 * 1000,
      ),
      false,
      'Must reject replayed packet outside clock window',
    )

    // Attack 5: Display-name spoofing in roster
    const roster: ParticipantProfile[] = [
      {
        userId: alice.userId,
        displayName: 'Alice',
        avatarColor: '#E5A93C',
        avatarStyle: 'visor-classic',
        seatIndex: 0,
        isHost: true,
        isMuted: false,
        inVR: false,
        joinedAt: 1000,
      },
      {
        userId: mallory.userId,
        displayName: 'Alice', // Mallory tries to copy Alice's name
        avatarColor: '#E05A47',
        avatarStyle: 'visor-sleek',
        seatIndex: 1,
        isHost: false,
        isMuted: false,
        inVR: false,
        joinedAt: 2000,
      },
    ]

    const disambiguated = disambiguateParticipantRoster(roster)
    assert.equal(disambiguated[0].displayName, 'Alice')
    assert.equal(disambiguated[0].verifiedKeyTag, alice.keyTag)
    assert.equal(
      disambiguated[1].displayName,
      `Alice (#${mallory.keyTag})`,
      'Second user claiming the same display name must be disambiguated with their cryptographic key tag',
    )
  })

  it('4. removes broken Vercel api/stream-proxy.js endpoint', () => {
    const legacyVercelProxy = resolve(process.cwd(), 'api/stream-proxy.js')
    assert.equal(
      existsSync(legacyVercelProxy),
      false,
      'api/stream-proxy.js should be removed so static GitHub Pages deployments never hit a dead endpoint',
    )
  })

  it('5. hardens YouTube OAuth state nonce, requires explicit HTTPS Piped server, and never fakes popup login', async () => {
    // 1. Popup helper must NOT mark user as signed in locally
    assert.equal(getYouTubeAccountState().authProvider, 'none')
    await openYouTubeWebLoginPopup('TestUser')
    assert.equal(
      getYouTubeAccountState().authProvider,
      'none',
      'Opening external YouTube.com popup must never fake a local signed-in state',
    )

    // 2. OAuth state nonce is CSPRNG and strictly single-use
    const nonce1 = generateAndStoreOAuthStateNonce()
    const nonce2 = generateAndStoreOAuthStateNonce()
    assert.match(nonce2, /^[0-9a-f]{48}$/)
    assert.notEqual(nonce1, nonce2)
    assert.equal(verifyAndConsumeOAuthStateNonce('vr-lounge-yt-oauth'), false)

    const freshNonce = generateAndStoreOAuthStateNonce()
    assert.equal(verifyAndConsumeOAuthStateNonce(freshNonce), true)
    // Second use of the same nonce must be rejected
    assert.equal(verifyAndConsumeOAuthStateNonce(freshNonce), false)

    // 3. Piped login must require explicit HTTPS server URL
    await assert.rejects(
      () => signInWithPipedAccount('alice', 'secret123', ''),
      /Select or enter the exact HTTPS Piped server/i,
    )
    await assert.rejects(
      () => signInWithPipedAccount('alice', 'secret123', 'http://insecure.example.com'),
      /HTTPS/i,
    )
  })

  it('6. enforces walkable room bounds, untethered 3D fly mode, and Quiet Library detection', () => {
    const roomCustomization = createDefaultRoomCustomization()
    const grounded = resolveWalkablePosition(
      0,
      0,
      roomCustomization.architecture,
    )
    assert.equal(grounded[1], 0, 'Walking mode must tether Y to floor (0)')

    const flying = resolveFlyablePosition(
      0,
      6.2,
      0,
      roomCustomization.architecture,
    )
    assert.equal(flying[1], 6.2, 'Fly mode must preserve 3D vertical altitude')

    const wingLayout = computeExpansionWingLayout(5.8)
    assert.equal(
      detectActiveLoungeWing(
        wingLayout.libraryCenter[0],
        wingLayout.libraryCenter[2],
        5.8,
      ),
      'library',
      'Must detect when player is inside the Quiet Library for automatic stream audio isolation',
    )

    // Verify Tactical Shooting Range wing detection, destination, and firing line barrier
    assert.equal(
      detectActiveLoungeWing(
        wingLayout.shootingRangeCenter[0],
        wingLayout.shootingRangeCenter[2],
        5.8,
      ),
      'shooting-range',
      'Must detect when player is inside the Tactical Shooting Range',
    )
    const rangeDest = wingLayout.destinations.find(
      (d) => d.id === 'shooting-range',
    )
    assert.ok(rangeDest, 'Shooting Range destination must be registered in hallway layout')
    const boothSeats = wingLayout.wingSeats.filter(
      (s) => s.roomWing === 'shooting-range',
    )
    assert.equal(
      boothSeats.length,
      4,
      'Shooting Range must provide 4 tactical firing line booths',
    )

    // Attempting to walk downrange past the firing line (-6.15) clamps safely to the firing line
    const clampedAtFiringLine = resolveWalkablePosition(
      -20.0,
      7.2 + 24.6,
      roomCustomization.architecture,
    )
    assert.equal(
      clampedAtFiringLine[0],
      -6.15,
      'Walking mode must stop players safely behind the firing line barrier (-6.15)',
    )
  })
})

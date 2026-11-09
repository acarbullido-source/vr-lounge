import type { AdventureCampaignDefinition } from '../types'

export const SUNKEN_RELIQUARY_CAMPAIGN: AdventureCampaignDefinition = {
  id: 'sunken-reliquary',
  title: 'The Sunken Reliquary',
  subtitle: 'Flooded Catacombs of the Drowned King',
  themeSummary:
    'Descend into abyssal gothic catacombs where black tidewaters rise with every heartbeat, coral-armored skeletal legions hold the tollbridges, and Lich King Malakor guards his triple phylactery.',
  accentColor: '#22D3EE',
  secondaryColor: '#0E7490',
  startNodeId: 'node-1',
  bossName: 'Lich King Malakor',
  nodes: {
    'node-1': {
      id: 'node-1',
      stageNumber: 1,
      act: 1,
      title: 'The Drowned Narthex',
      subtitle: 'Act I · Stage 1 · Subterranean Cathedral Threshold',
      hazardBadge: '🌊 RISING ABYSSAL TIDE',
      prose:
        'Waist-deep black water surges down the sunken cathedral stairs as twin rusted iron portcullises groan shut behind your party. Barnacle-crusted gargoyles leer from the vaulted pillars while pale necrotic lanterns flicker beneath the rising tide.',
      narrativeEcho: {
        fromSuccess:
          'Your torches hiss above the dark water as your party descends into the outer reliquary.',
      },
      focalArt: 'sunken-portcullis',
      choices: [
        {
          id: 'sr-1-might',
          title: 'Wedge the Portcullis Gear',
          description:
            'Jam an iron crowbar into thewinch assembly and heave the counter-chain to lock the floodgate open.',
          attribute: 'might',
          dc: 12,
          tags: ['hazard'],
          failPenaltyText: 'Rusted teeth snap back across your gauntlets (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'You jam the iron gear and secure an emergency air vent!',
        },
        {
          id: 'sr-1-finesse',
          title: 'Pick the Drainage Sluice Lock',
          description:
            'Reach beneath the freezing black surface to manipulate the corroded brass tumblers of the side-sluice.',
          attribute: 'finesse',
          dc: 12,
          tags: ['lock', 'trap'],
          failPenaltyText: 'A spring-loaded needle-trap slices your wrist (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'The brass sluice clicks open, drawing down the surge!',
        },
        {
          id: 'sr-1-arcana',
          title: 'Decipher the Tidal Warning Glyphs',
          description:
            'Channel witch-light across the sunken friezes to read the ancient hydro-romantic ward sequence.',
          attribute: 'arcana',
          dc: 11,
          tags: ['riddle'],
          failPenaltyText: 'Necrotic feedback sears your optic nerves (-2 HP).',
          failHpDamage: 2,
          successBonusText:
            'The runes illuminate the safest footing across the flooded flagstones!',
          grantsWorldFlag: 'tidal_glyphs_read',
        },
        {
          id: 'sr-1-smash',
          title: 'Shatter the Gargoyle Conduit',
          description:
            'Cleave through the lead intake pipe feeding the narthex basin before the pressure seals the doors.',
          attribute: 'might',
          dc: 13,
          tags: ['combat', 'hazard'],
          failPenaltyText: 'High-pressure brine blasts you backward into a pillar (-3 HP).',
          failHpDamage: 3,
          successBonusText: 'The intake pipe ruptures outward, relieving the flood pressure!',
        },
      ],
      nextNodeSuccess: 'node-2',
      nextNodeFail: 'node-2',
      criticalGrantsFlag: 'tidal_glyphs_read',
    },

    'node-2': {
      id: 'node-2',
      stageNumber: 2,
      act: 1,
      title: 'The Weeping Cistern',
      subtitle: 'Act I · Stage 2 · Rising Water Counter-Weight Puzzle',
      hazardBadge: '⛳ CRUCIAL PUTTING CHECK · FLOODGATE ALIGNMENT',
      prose:
        'Six colossal bronze gargoyle spouts pour foaming torrents into a circular cistern. Across the flooded stone channel, an ancient counter-weight socket waits to receive a runic bronze sphere—the only mechanism that can align the upper floodgates before the floor gives way.',
      narrativeEcho: {
        fromSuccess:
          'Having stabilized the narthex sluices, you enter the cistern with precious seconds to spare.',
        fromFail:
          'Bruised by the slamming narthex gates, you stumble into the roaring cistern as water already laps at your ribs.',
        flags: {
          tidal_glyphs_read:
            'Echo of the Glyphs: The hydro-runes you translated reveal the exact slope of the submerged stone channel!',
        },
      },
      focalArt: 'weeping-cistern',
      crucialSkillCheck: {
        kind: 'putting',
        title: 'Crucial Lounge Putting Check: Align the Floodgate Sphere',
        instruction:
          'Step up to the VR Lounge Putting Strip (or roll the Couch Fallback D20) to guide the bronze counter-weight sphere down the flooded stone channel into the floodgate socket!',
        targetDescription: 'Sink a putt on the Lounge Putting Strip (or Roll D20 ≥ DC 14)',
        fallbackDc: 14,
        successRewardText:
          'The bronze sphere drops dead-center into the socket! Ancient chains roar as the cistern drains.',
        failPenaltyText:
          'The sphere veers off the mossy rim—the cistern floor fractures into a raging whirlpool!',
        failHpPenalty: 2,
        grantsWorldFlag: 'high_ground_secured',
      },
      choices: [
        {
          id: 'sr-2-finesse',
          title: 'Guide the Counter-Weight Channel',
          description:
            'Use deft angles and steady hands to bank the runic sphere along the mossy stone trough.',
          attribute: 'finesse',
          dc: 12,
          tags: ['trap', 'hazard'],
          failPenaltyText: 'Cross-currents slam the bronze sphere back into your shins (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'You align the trough baffles for a clean roll!',
          grantsWorldFlag: 'high_ground_secured',
        },
        {
          id: 'sr-2-might',
          title: 'Crank the Manual Spillway Wheel',
          description:
            'Brace your boots against the submerged ribs and haul on the barnacle-rusted iron wheel.',
          attribute: 'might',
          dc: 13,
          tags: ['hazard'],
          failPenaltyText: 'The wheel kicks back, wrenching your shoulder (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'With a titanic groan, the auxiliary spillway grinds open!',
        },
        {
          id: 'sr-2-arcana',
          title: 'Freeze the Gargoyle Spouts',
          description:
            'Weave a rime-frost sigil across the roaring bronze mouths to choke the torrent into ice.',
          attribute: 'arcana',
          dc: 12,
          tags: ['hazard'],
          failPenaltyText: 'Abyssal nekro-steam scalds your hands (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'Jagged icicles seal the gargoyle maws!',
        },
      ],
      nextNodeSuccess: 'node-3a',
      nextNodeFail: 'node-3b',
      nextNodeCritical: 'node-3a',
      criticalGrantsFlag: 'high_ground_secured',
    },

    'node-3a': {
      id: 'node-3a',
      stageNumber: 3,
      act: 1,
      title: 'The Dry Ossuary Gallery',
      subtitle: 'Act I · Stage 3A · Upper Catwalk Advantage',
      hazardBadge: '✨ UPPER PATH · DRY CATWALKS',
      prose:
        'As the cistern drains away beneath your boots, dry marble catwalks and gilded reliquary alcoves emerge high above the bone pits. From this elevated vantage, you spot the patrolling undead below and an unplundered crypt-warden chest.',
      narrativeEcho: {
        fromSuccess:
          'Because you aligned the cistern floodgates, the water receded completely—granting your party dry high ground!',
        flags: {
          high_ground_secured:
            'High Ground Secured: Your elevated catwalk position reveals the Bone-Wardens’ patrol blind spots ahead.',
        },
      },
      focalArt: 'ossuary-catwalk',
      choices: [
        {
          id: 'sr-3a-lock',
          title: 'Unseal the Reliquary Chest',
          description:
            'Pick the silver-inlaid ossuary coffer containing blessed oil and catacomb charts.',
          attribute: 'finesse',
          dc: 11,
          tags: ['lock'],
          failPenaltyText: 'A warded latch sparks across your fingers (-1 HP).',
          failHpDamage: 1,
          successBonusText: 'You recover consecrated vials (+1 HP healed)!',
          healOnSuccess: 1,
          grantsWorldFlag: 'high_ground_secured',
        },
        {
          id: 'sr-3a-arcana',
          title: 'Study the Inquisitor’s Mural',
          description:
            'Transcribe the faded silver mural depicting Lich King Malakor’s original binding ritual.',
          attribute: 'arcana',
          dc: 11,
          tags: ['riddle'],
          failPenaltyText: 'The mural’s cursed pigment whispers dread (-1 HP).',
          failHpDamage: 1,
          successBonusText: 'You uncover a vital clue to the Lich’s mortal lineage!',
          grantsWorldFlag: 'mural_transcribed',
        },
        {
          id: 'sr-3a-might',
          title: 'Topple a Pillar onto the Patrol Below',
          description:
            'Shoulder a cracked limestone column off the balcony to crush the skeletal vanguard beneath you.',
          attribute: 'might',
          dc: 12,
          tags: ['combat'],
          failPenaltyText: 'Flying stone splinters graze your cheek (-1 HP).',
          failHpDamage: 1,
          successBonusText: 'The column obliterates the ambushers waiting at the bridge!',
        },
      ],
      nextNodeSuccess: 'node-4',
      nextNodeFail: 'node-4',
    },

    'node-3b': {
      id: 'node-3b',
      stageNumber: 3,
      act: 1,
      title: 'The Undertow Chasm',
      subtitle: 'Act I · Stage 3B · Collapsed Whirlpool Trench',
      hazardBadge: '⚠️ LOWER PATH · CHURNING WHIRLPOOL',
      prose:
        'With the floodgates jammed, the cistern floor collapses into a roaring subterranean chasm! Black whirlpools spin shattered coffins and jagged iron fencing across a twenty-foot gap toward the lower aqueduct.',
      narrativeEcho: {
        fromFail:
          'Because the cistern overflowed, the flagstones gave way—plunging your party into the churning undertow trench!',
      },
      focalArt: 'undertow-whirlpool',
      choices: [
        {
          id: 'sr-3b-chasm',
          title: 'Swing Across the Chasm Chains',
          description:
            'Leap for the slick overheadchandelier chains (or deploy a Grappling Hook) to clear the whirlpool.',
          attribute: 'finesse',
          dc: 13,
          tags: ['chasm', 'hazard'],
          failPenaltyText: 'The undertow drags you against jagged reef-stone (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'You vault cleanly onto the far aqueduct ledge!',
        },
        {
          id: 'sr-3b-might',
          title: 'Haul Allies Against the Riptide',
          description:
            'Anchor your boots into a submerged gargoyle horn and pull your party through the foaming current.',
          attribute: 'might',
          dc: 13,
          tags: ['chasm', 'hazard'],
          failPenaltyText: 'A spinning oak coffin batters your ribs (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'Your raw strength drags the squad out of the vortex!',
        },
        {
          id: 'sr-3b-arcana',
          title: 'Part the Whirlpool with Kinetic Force',
          description:
            'Unleash a shockwave of arcane repulsion to momentarily still the maelstrom.',
          attribute: 'arcana',
          dc: 13,
          tags: ['chasm', 'hazard'],
          failPenaltyText: 'Backlash from the abyssal current bruises your aura (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'A temporary kinetic causeway opens across the foam!',
        },
      ],
      nextNodeSuccess: 'node-4',
      nextNodeFail: 'node-4',
    },

    'node-4': {
      id: 'node-4',
      stageNumber: 4,
      act: 1,
      title: "The Bone-Wardens' Tollbridge",
      subtitle: 'Act I · Stage 4 · Narrow Aqueduct Phalanx',
      hazardBadge: '⚔️ SKELETAL PHALANX BLOCKADE',
      prose:
        'A narrow stone aqueduct spans the subterranean abyss. Blocking the crossing stands a locked phalanx of coral-encrusted Skeletal Wardens, their barnacle-plated tower shields overlapping as hollow eye sockets blaze with cold cyan fire.',
      narrativeEcho: {
        fromSuccess:
          'Advancing in tight formation, your party confronts the Bone-Wardens before they can sound their horn.',
        fromFail:
          'Battered by the undertow, you haul yourselves onto the bridge just as the Bone-Wardens lock their shields.',
        flags: {
          high_ground_secured:
            'High Ground Advantage: From the upper gallery, you drop down behind the wardens’ front shield-wall!',
        },
      },
      focalArt: 'bone-warden-bridge',
      choices: [
        {
          id: 'sr-4-might',
          title: 'Shatter the Coral Shield-Wall',
          description:
            'Charge the center of the phalanx with heavy weapons to splinter their fused bone-and-coral shields.',
          attribute: 'might',
          dc: 13,
          tags: ['combat'],
          failPenaltyText: 'Rusted halberds thrust between the shields (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'Bone and coral explode outward as the phalanx crumbles!',
        },
        {
          id: 'sr-4-finesse',
          title: 'Flank Along the Aqueduct Parapet',
          description:
            'Sprint along the narrow two-inch outer ledge to sever the wardens’ spine-tendons from behind.',
          attribute: 'finesse',
          dc: 13,
          tags: ['combat', 'chasm'],
          failPenaltyText: 'A skeletal pike grazes your flank on the narrow ledge (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'You dance behind their shields and topple three wardens into the abyss!',
        },
        {
          id: 'sr-4-arcana',
          title: 'Disrupt Their Necromantic Tether',
          description:
            'Sunder the cyan soul-threads linking the Bone-Wardens to Malakor’s distant throne.',
          attribute: 'arcana',
          dc: 12,
          tags: ['combat'],
          failPenaltyText: 'Soul-shrapnel lashes back across your mind (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'Their cyan eye-flames gutter out and the skeletons collapse!',
        },
      ],
      nextNodeSuccess: 'node-5a',
      nextNodeFail: 'node-5b',
      nextNodeCritical: 'node-5a',
    },

    'node-5a': {
      id: 'node-5a',
      stageNumber: 5,
      act: 2,
      title: 'The Reliquary Vault',
      subtitle: 'Act II · Stage 5A · Forbidden Archive of the Lich',
      hazardBadge: '✨ UPPER PATH · ANCIENT VAULT',
      prose:
        'Having broken the Bone-Warden phalanx cleanly, you breach the dry, candle-lit Reliquary Vault before its iron shutters can drop. Inside rest the obsidian tablets recording Lich King Malakor’s mortal true name and the flaw in his crown phylactery.',
      narrativeEcho: {
        fromSuccess:
          'Your swift triumph on the tollbridge left the Reliquary Vault unguarded and wide open!',
        flags: {
          mural_transcribed:
            'Inquisitor’s Key: Your earlier transcription matches the cipher on the Lich’s central sarcophagus!',
        },
      },
      focalArt: 'reliquary-vault',
      choices: [
        {
          id: 'sr-5a-arcana',
          title: 'Speak the Unbinding True-Name',
          description:
            'Intone Malakor’s mortal name in reverse to fracture the protective wards around his soul-vessel.',
          attribute: 'arcana',
          dc: 12,
          tags: ['riddle'],
          failPenaltyText: 'A glyph-ward singes your lips (-1 HP).',
          failHpDamage: 1,
          successBonusText: 'A distant shriek echoes—Malakor’s phylactery cracks (-1 Boss DC)!',
          grantsWorldFlag: 'phylactery_cracked',
          reducesBossDc: 1,
        },
        {
          id: 'sr-5a-finesse',
          title: 'Disarm the Jeweled Reliquary Casket',
          description:
            'Bypass the poison-gas needles guarding the royal burial offerings.',
          attribute: 'finesse',
          dc: 12,
          tags: ['lock', 'trap'],
          failPenaltyText: 'A puff of tomb-spore stings your lungs (-1 HP).',
          failHpDamage: 1,
          successBonusText: 'You claim the Phylactery Breaker signet!',
          grantsWorldFlag: 'phylactery_cracked',
          reducesBossDc: 1,
        },
        {
          id: 'sr-5a-might',
          title: 'Pry Open the Obsidian Sarcophagus',
          description:
            'Heave the thousand-pound lid aside to expose the Lich’s consecrated regalia.',
          attribute: 'might',
          dc: 12,
          tags: ['lock'],
          failPenaltyText: 'The heavy granite lid pinches your fingers (-1 HP).',
          failHpDamage: 1,
          successBonusText: 'You shatter the Lich’s anchor seal inside the tomb!',
          grantsWorldFlag: 'phylactery_cracked',
        },
      ],
      nextNodeSuccess: 'node-6',
      nextNodeFail: 'node-6',
    },

    'node-5b': {
      id: 'node-5b',
      stageNumber: 5,
      act: 2,
      title: 'The Drowned Catacomb Maze',
      subtitle: 'Act II · Stage 5B · Bone-Hydra Ambush in Chest-Deep Water',
      hazardBadge: '⚠️ LOWER PATH · BONE HYDRA LAIR',
      prose:
        'Forced off the tollbridge into the flooded lower catacombs, your party wades through chest-deep black water choked with floating skulls. Suddenly the surface erupts as a multi-headed Bone Hydra lunges from the submerged ossuary alcoves!',
      narrativeEcho: {
        fromFail:
          'Driven back from the tollbridge shutters, you are forced through the flooded Bone-Hydra catacombs!',
      },
      focalArt: 'bone-hydra-maze',
      choices: [
        {
          id: 'sr-5b-might',
          title: 'Sever the Central Hydra Neck',
          description:
            'Stand firm in the swirling water and cleave through the creature’s fused spinal column.',
          attribute: 'might',
          dc: 14,
          tags: ['combat', 'hazard'],
          failPenaltyText: 'Serrated bone-jaws clamp onto your pauldron (-3 HP).',
          failHpDamage: 3,
          successBonusText: 'Your strike shatters the primary skull and drives the beast back!',
        },
        {
          id: 'sr-5b-finesse',
          title: 'Dive Beneath the Snapping Jaws',
          description:
            'Slip through a narrow submerged grating where the massive hydra heads cannot follow.',
          attribute: 'finesse',
          dc: 13,
          tags: ['combat', 'trap'],
          failPenaltyText: 'A thrashing tail-spine lashes your back (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'You dart through the iron grate while the skulls tangle!',
        },
        {
          id: 'sr-5b-arcana',
          title: 'Boil the Catacomb Pool',
          description:
            'Detonate a sphere of radiant heat underwater to flash-boil the necrotic marrow binding the hydra.',
          attribute: 'arcana',
          dc: 13,
          tags: ['combat'],
          failPenaltyText: 'The hydra’s death-rattle shockwave batters you (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'Radiant steam dissolves the marrow-sinews holding the beast together!',
        },
      ],
      nextNodeSuccess: 'node-6',
      nextNodeFail: 'node-6',
    },

    'node-6': {
      id: 'node-6',
      stageNumber: 6,
      act: 2,
      title: 'The Whispering Bell-Belfry',
      subtitle: 'Act II · Stage 6 · Necrotic Resonance Chamber',
      hazardBadge: '🔔 PSYCHIC DOOM TOLL',
      prose:
        'Suspended half-submerged in an inverted gothic belfry hangs the Great Mourning Bell of Malakor. Every time the black swell rocks its verdigris bronze clapper, a wave of psychic dread ripples across the water, threatening to stop mortal hearts.',
      narrativeEcho: {
        fromSuccess:
          'Emerging from the vault with the Lich’s secrets in hand, you reach the submerged belfry.',
        fromFail:
          'Pulling yourselves out of the Bone Hydra’s reach, you stagger into the echoing belfry.',
        flags: {
          phylactery_cracked:
            'Cracked Phylactery: The Mourning Bell’s pitch is already discordant from the damage you dealt to Malakor’s vessel!',
        },
      },
      focalArt: 'sunken-bell',
      choices: [
        {
          id: 'sr-6-arcana',
          title: 'Weave a Ward of Silence',
          description:
            'Project a counter-harmonic rune bubble around the bronze rim to mute the necrotic tolling.',
          attribute: 'arcana',
          dc: 13,
          tags: ['hazard', 'riddle'],
          failPenaltyText: 'The bell’s psychic shockwave makes your ears bleed (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'Dead silence falls over the water as the necrotic resonance dies!',
        },
        {
          id: 'sr-6-might',
          title: 'Shatter the Bronze Clapper',
          description:
            'Leap onto the swinging bell rim and smash the iron clapper chain with a two-handed blow.',
          attribute: 'might',
          dc: 13,
          tags: ['hazard'],
          failPenaltyText: 'The sonic vibration numbs your arms and cracks your ribs (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'The five-hundred-pound clapper snaps free and plunges into the deep!',
        },
        {
          id: 'sr-6-finesse',
          title: 'Muffle the Yoke with Silk & Chains',
          description:
            'Scale the slick belfry rafters and wedge padded grave-shrouds into the swinging axle.',
          attribute: 'finesse',
          dc: 12,
          tags: ['trap', 'chasm'],
          failPenaltyText: 'You slip from the wet rafters into the freezing swell (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'The muffled axle locks tight without a single further toll!',
        },
      ],
      nextNodeSuccess: 'node-7',
      nextNodeFail: 'node-7',
    },

    'node-7': {
      id: 'node-7',
      stageNumber: 7,
      act: 2,
      title: 'Sanctuary Shrine — The Air-Pocket Chapel',
      subtitle: 'Act II · Stage 7 · Mid-Dungeon Silver-Warded Diving Bell',
      hazardBadge: '✨ SANCTUARY SHRINE · GHOSTS REVIVE TO 4 HP',
      prose:
        'Inside a massive silver-warded diving bell pocket, ancient air-runes hold the black ocean at bay. Warm cerulean braziers burn around a statue of the Dawn-Saint. All Spectral Ghosts in your party are immediately pulled back into mortal flesh at 4 HP!',
      narrativeEcho: {
        fromSuccess:
          'With the Mourning Bell silenced, your party enters the tranquil Air-Pocket Chapel undisturbed.',
        fromFail:
          'Reeling from the belfry’s psychic toll, you tumble through the silver ward-curtain into safe, breathable air.',
      },
      focalArt: 'diving-bell-shrine',
      isSanctuary: true,
      choices: [
        {
          id: 'sr-7-pray',
          title: 'Drink from the Silver Chalice Font',
          description:
            'Partake of the blessed spring water to mend wounds and restore +3 HP to yourself.',
          attribute: 'arcana',
          dc: 8,
          tags: ['sanctuary'],
          failPenaltyText: 'The cold spring water shocks your system (0 HP lost).',
          failHpDamage: 0,
          successBonusText: 'Warm silver light knits your wounds (+3 HP restored)!',
          healOnSuccess: 3,
        },
        {
          id: 'sr-7-consecrate',
          title: 'Consecrate Weapons in Blue Flame',
          description:
            'Anoint your blades and staves in the Dawn-Saint’s brazier (+1 bonus on all rolls for the rest of the run).',
          attribute: 'might',
          dc: 9,
          tags: ['sanctuary'],
          failPenaltyText: 'The flame flickers but leaves you unharmed (0 HP lost).',
          failHpDamage: 0,
          successBonusText: 'Your weapons blaze with undead-banishing silver fire (+1 Roll Bonus & +2 HP)!',
          healOnSuccess: 2,
          grantsWorldFlag: 'weapons_consecrated',
        },
        {
          id: 'sr-7-scout',
          title: 'Scout the Sluice-Gate Blueprints',
          description:
            'Examine the builder’s brass plaques inside the chapel to lower Threat Level and heal +2 HP.',
          attribute: 'finesse',
          dc: 8,
          tags: ['sanctuary'],
          failPenaltyText: 'Some plaques are corroded, but you rest safely (0 HP lost).',
          failHpDamage: 0,
          successBonusText: 'You chart a stealth route through the sluices (+2 HP restored)!',
          healOnSuccess: 2,
        },
      ],
      nextNodeSuccess: 'node-8',
      nextNodeFail: 'node-8',
    },

    'node-8': {
      id: 'node-8',
      stageNumber: 8,
      act: 2,
      title: 'The Sluice-Gate Gauntlet',
      subtitle: 'Act II · Stage 8 · Rapidly Submerging Lock Chamber',
      hazardBadge: '🌊 CRUSHING WATER PRESSURE',
      prose:
        'Beyond the chapel lies the main hydro-lock tunnel. Seeing intruders approaching his sanctum, Malakor triggers a catastrophic flush! Foaming walls of water roar down the tunnel as ceiling grates drop and brass pressure-valves spin wildly.',
      narrativeEcho: {
        fromSuccess:
          'Refreshed and consecrated from the Air-Pocket Chapel, your party charges into the hydro-lock gauntlet!',
        flags: {
          weapons_consecrated:
            'Consecrated Arms: Silver fire trails from your weapons, illuminating the submerged valve housings!',
        },
      },
      focalArt: 'sluice-gauntlet',
      choices: [
        {
          id: 'sr-8-finesse',
          title: 'Synchronize the Three Valve Locks',
          description:
            'Leap between the spinning brass wheels to equalize chamber pressure before the ceiling submerges.',
          attribute: 'finesse',
          dc: 13,
          tags: ['lock', 'trap'],
          failPenaltyText: 'A bursting steam-pipe lashes your legs (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'All three pressure gauges lock into the green!',
        },
        {
          id: 'sr-8-might',
          title: 'Hold the Iron Flood-Hatch Open',
          description:
            'Plant your back against the descending two-ton flood-hatch so your allies can dive through.',
          attribute: 'might',
          dc: 14,
          tags: ['hazard'],
          failPenaltyText: 'The crushing weight bruises your shoulders (-3 HP).',
          failHpDamage: 3,
          successBonusText: 'With a roar of defiance, you hold the hatch until everyone clears it!',
        },
        {
          id: 'sr-8-arcana',
          title: 'Conjure an Air-Bubble Conduit',
          description:
            'Encase the party in a pressurized sphere of breathable arcane force to ride the surge forward.',
          attribute: 'arcana',
          dc: 13,
          tags: ['hazard'],
          failPenaltyText: 'The raging torrent cracks your barrier at the last second (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'Your arcane sphere shoots through the sluice like a torpedo!',
        },
      ],
      nextNodeSuccess: 'node-9',
      nextNodeFail: 'node-9',
    },

    'node-9': {
      id: 'node-9',
      stageNumber: 9,
      act: 3,
      title: 'The Necropolis Antechamber',
      subtitle: 'Act III · Stage 9 · Twin Skeletal Dread-Knights',
      hazardBadge: '🎯 CRUCIAL DARTBOARD CHECK · SNIPE THE SOUL-GEM',
      prose:
        'Before the towering bone doors of the Throne Room stand twin nine-foot Skeletal Dread-Knights clad in abyssal plate. Between their overlapping breastplates pulses a single shared crimson Soul-Gem that regenerates their shattered bones every second.',
      narrativeEcho: {
        fromSuccess:
          'Bursting out of the sluice-lock at full speed, you catch the Twin Dread-Knights mid-salute!',
        fromFail:
          'Half-drowned by the sluice surge, you cough up black brine as the Twin Dread-Knights lower their greatswords.',
      },
      focalArt: 'dread-knights',
      crucialSkillCheck: {
        kind: 'darts',
        title: 'Crucial Lounge Dartboard Check: Snipe the Shared Soul-Gem',
        instruction:
          'Step up to the VR Lounge Dartboard and hit any scoring ring or Bullseye (or roll the Couch Fallback D20) to snipe the glowing crimson Soul-Gem between the Dread-Knights’ armor plates!',
        targetDescription: 'Hit a scoring ring / Bullseye on the Lounge Dartboard (or Roll D20 ≥ DC 14)',
        fallbackDc: 14,
        successRewardText:
          'Dead-eye shot! Your projectile pierces the crimson Soul-Gem, shattering both Dread-Knights simultaneously!',
        failPenaltyText:
          'The shot glances off their pauldrons—the Dread-Knights cleave across the antechamber!',
        failHpPenalty: 2,
        grantsWorldFlag: 'dread_knights_shattered',
        exposesBossWeakness: true,
      },
      choices: [
        {
          id: 'sr-9-finesse',
          title: 'Thread a Shot Through the Visor Slit',
          description:
            'Aim for the narrow gap between their gorgets where the crimson tether-gem pulses.',
          attribute: 'finesse',
          dc: 13,
          tags: ['combat'],
          failPenaltyText: 'A greatsword shockwave sends you skidding across the marble (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'Your precision strike fractures the Soul-Gem housing!',
        },
        {
          id: 'sr-9-might',
          title: 'Parry Both Greatswords at Once',
          description:
            'Meet their synchronized overhead cleave head-on to lock their blades in the floor.',
          attribute: 'might',
          dc: 14,
          tags: ['combat'],
          failPenaltyText: 'The twin impact drives you to one knee (-3 HP).',
          failHpDamage: 3,
          successBonusText: 'Sparks fly as you wrench both greatswords wide open!',
        },
        {
          id: 'sr-9-arcana',
          title: 'Overload the Crimson Tether',
          description:
            'Pump raw astral voltage into their shared soul-link until the gem detonates.',
          attribute: 'arcana',
          dc: 13,
          tags: ['combat'],
          failPenaltyText: 'Necrotic arc-lightning jumps back to your chest (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'The overloaded Soul-Gem implodes in a flash of violet fire!',
        },
      ],
      nextNodeSuccess: 'node-10a',
      nextNodeFail: 'node-10b',
      nextNodeCritical: 'node-10a',
      criticalGrantsFlag: 'dread_knights_shattered',
    },

    'node-10a': {
      id: 'node-10a',
      stageNumber: 10,
      act: 3,
      title: 'The Phylactery Reliquary',
      subtitle: 'Act III · Stage 10A · Ambushing the Ritual Acolytes',
      hazardBadge: '✨ UPPER PATH · SOUL-VESSEL AMBUSH (-2 BOSS DC)',
      prose:
        'With the Dread-Knights destroyed in silence, your party slips into the side-sacristy where three hooded Lich-Acolytes are channeling shields into Malakor’s floating bone-chalice phylactery. They have not spotted you yet!',
      narrativeEcho: {
        fromSuccess:
          'Because you shattered the Dread-Knights’ Soul-Gem cleanly, you catch the ritual acolytes completely off-guard!',
        flags: {
          phylactery_cracked:
            'Double Fracture: The hairline crack you inflicted in the Vault glows bright gold along the chalice rim!',
        },
      },
      focalArt: 'phylactery-chamber',
      choices: [
        {
          id: 'sr-10a-might',
          title: 'Smash the Bone-Chalice Pedestal',
          description:
            'Charge the altar and pulverize the second soul-vessel before the acolytes can raise a barrier.',
          attribute: 'might',
          dc: 12,
          tags: ['combat'],
          failPenaltyText: 'Dying acolyte curses singe your hands (-1 HP).',
          failHpDamage: 1,
          successBonusText:
            'The bone-chalice shatters into dust—Malakor’s final Boss DC drops by 2!',
          grantsWorldFlag: 'soul_vessel_destroyed',
          reducesBossDc: 2,
        },
        {
          id: 'sr-10a-finesse',
          title: 'Silently Eliminate the Chanting Acolytes',
          description:
            'Strike from the pillar shadows to sever the ritualists’ focus simultaneously.',
          attribute: 'finesse',
          dc: 12,
          tags: ['combat'],
          failPenaltyText: 'An acolyte’s bone-dagger nicks your arm (-1 HP).',
          failHpDamage: 1,
          successBonusText: 'The ritual collapses without a sound (-2 Boss DC)!',
          grantsWorldFlag: 'soul_vessel_destroyed',
          reducesBossDc: 2,
        },
        {
          id: 'sr-10a-arcana',
          title: 'Siphon the Phylactery’s Lifeforce',
          description:
            'Invert the ritual circle to drain the vessel’s power into your own party (+2 HP & -2 Boss DC).',
          attribute: 'arcana',
          dc: 12,
          tags: ['riddle'],
          failPenaltyText: 'Cold soul-frost numbs your fingertips (-1 HP).',
          failHpDamage: 1,
          successBonusText: 'You drain the vessel dry, healing +2 HP and weakening Malakor!',
          healOnSuccess: 2,
          grantsWorldFlag: 'soul_vessel_destroyed',
          reducesBossDc: 2,
        },
      ],
      nextNodeSuccess: 'node-11',
      nextNodeFail: 'node-11',
    },

    'node-10b': {
      id: 'node-10b',
      stageNumber: 10,
      act: 3,
      title: 'The Soul-Drain Vortex',
      subtitle: 'Act III · Stage 10B · Cursed Threshold Gauntlet',
      hazardBadge: '⚠️ LOWER PATH · NECROTIC CURSE STORM',
      prose:
        'Alerted by the clash in the antechamber, Malakor’s acolytes complete their warding chant! The corridor leading to the throne room twists into a screaming vortex of pale green wraiths that claw at your armor and vitality.',
      narrativeEcho: {
        fromFail:
          'Because the Dread-Knights sounded the alarm, the acolytes unleashed the Soul-Drain Vortex across the threshold!',
      },
      focalArt: 'soul-vortex',
      choices: [
        {
          id: 'sr-10b-arcana',
          title: 'Raise a Radiant Ward-Dome',
          description:
            'Burn your arcane reserves to carve a tunnel of pure light through the wraith-storm.',
          attribute: 'arcana',
          dc: 14,
          tags: ['hazard', 'trap'],
          failPenaltyText: 'Shrieking wraiths siphon your warmth (-3 HP).',
          failHpDamage: 3,
          successBonusText: 'Your radiant dome incinerates the grasping specters!',
        },
        {
          id: 'sr-10b-might',
          title: 'Bull-Rush Through the Wraith Wall',
          description:
            'Lower your shoulders and power through the freezing gale to kick down the throne doors.',
          attribute: 'might',
          dc: 14,
          tags: ['hazard'],
          failPenaltyText: 'Grave-chill penetrates your armor plates (-3 HP).',
          failHpDamage: 3,
          successBonusText: 'You smash through the heavy bone doors into the sanctum!',
        },
        {
          id: 'sr-10b-finesse',
          title: 'Shadow-Step Between the Soul Eddies',
          description:
            'Read the spiral rhythm of the vortex and dart through the eye of the storm.',
          attribute: 'finesse',
          dc: 14,
          tags: ['trap', 'hazard'],
          failPenaltyText: 'Spectral claws rake across your cloak (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'You slip through the vortex unscathed!',
        },
      ],
      nextNodeSuccess: 'node-11',
      nextNodeFail: 'node-11',
    },

    'node-11': {
      id: 'node-11',
      stageNumber: 11,
      act: 3,
      title: 'The Throne of Drowned Kings',
      subtitle: 'Act III · Stage 11 · Lich King Malakor Rises',
      hazardBadge: '💀 BOSS PHASE I · TIDAL BONE-WALLS',
      prose:
        'At the heart of the sunken basilica, Lich King Malakor rises from a whirlpool of glowing skulls. Crowned in black abyssal gold, he raises hisLeviathan Staff—summoning thirty-foot walls of fused whale-bone and drowning brine that crash toward your party!',
      narrativeEcho: {
        fromSuccess:
          'Entering the basilica in peak formation, you confront Malakor as his protective wards sputter!',
        fromFail:
          'Staggering out of the Soul-Drain Vortex, you face the Lich King as the cathedral waters churn!',
        flags: {
          soul_vessel_destroyed:
            'Shattered Vessel: Malakor clutches his chest—one of his three soul-flames is already extinguished!',
          weapons_consecrated:
            'Dawn-Saint’s Fire: Your consecrated weapons flare bright silver in the Lich’s presence!',
        },
      },
      focalArt: 'lich-throne',
      choices: [
        {
          id: 'sr-11-might',
          title: 'Cleave the Crashing Bone-Barricade',
          description:
            'Shatter the conjured rib-cage wall to open a direct charge lane toward the Lich’s dais.',
          attribute: 'might',
          dc: 14,
          tags: ['combat', 'boss'],
          failPenaltyText: 'Jagged bone-shards erupt beneath your feet (-3 HP).',
          failHpDamage: 3,
          successBonusText: 'You blast a gap straight through the Lich’s bone-wall!',
          reducesBossDc: 1,
        },
        {
          id: 'sr-11-finesse',
          title: 'Vault the Whirlpool Pillars',
          description:
            'Leap from spinning debris column to column to flank Malakor on his high altar.',
          attribute: 'finesse',
          dc: 14,
          tags: ['combat', 'chasm', 'boss'],
          failPenaltyText: 'A necrotic water-lance clips your shoulder (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'You land right on the steps of the Drowned Throne!',
          reducesBossDc: 1,
        },
        {
          id: 'sr-11-arcana',
          title: 'Counter-Spell the Leviathan Staff',
          description:
            'Unravel Malakor’s necrotic tide-invocation before the wave crests.',
          attribute: 'arcana',
          dc: 14,
          tags: ['combat', 'boss'],
          failPenaltyText: 'Abyssal lightning scorches your aura (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'The tidal wave collapses into harmless mist!',
          reducesBossDc: 1,
        },
      ],
      nextNodeSuccess: 'node-12',
      nextNodeFail: 'node-12',
      nextNodeCritical: 'node-12',
      criticalGrantsFlag: 'malakor_staff_cracked',
    },

    'node-12': {
      id: 'node-12',
      stageNumber: 12,
      act: 3,
      title: 'Finale — Lich King Malakor Unbound',
      subtitle: 'Act III · Stage 12 · Climax of the Sunken Reliquary',
      hazardBadge: '🎲 CRUCIAL FINALE CHECK · SHATTER THE CROWN PHYLACTERY',
      prose:
        'Hissing curses in a dead tongue, Lich King Malakor levitates above the maelstrom to cast *Abyssal Deluge*! His iron-and-gold Crown Phylactery blazes with exposed necrotic energy. One final coordinated strike will shatter his crown and free the Sunken Reliquary forever!',
      narrativeEcho: {
        fromSuccess:
          'With his bone-walls broken, Malakor’s Crown Phylactery lies wide open to your finishing blow!',
        fromFail:
          'Though battered by his tidal barrage, your party rallies for one final, desperate strike at his crown!',
        flags: {
          phylactery_cracked:
            'Vault Advantage: The true-name fracture you carved in Act II splits the front of his crown!',
          soul_vessel_destroyed:
            'Sacristy Advantage: With his second soul-vessel gone, Malakor’s shield is paper-thin!',
        },
      },
      focalArt: 'lich-malakor-unbound',
      isFinale: true,
      crucialSkillCheck: {
        kind: 'wrist-d20',
        title: 'Crucial Finale Check: Shatter the Crown Phylactery!',
        instruction:
          'Roll the High-Stakes Finale D20 from your Wrist HUD, /mobile companion, or Cinema Screen (or hit a Bullseye on the Dartboard) to shatter Malakor’s Crown Phylactery before he finishes Abyssal Deluge!',
        targetDescription: 'Roll High-Stakes D20 ≥ DC 13 (reduced by Boss Weaknesses) or Hit Dartboard',
        fallbackDc: 13,
        successRewardText:
          'CRITICAL TRIUMPH! The Crown Phylactery explodes in a supernova of cyan and golden light as Lich King Malakor dissolves into the receding tide!',
        failPenaltyText:
          'Abyssal Deluge detonates across the throne room (-3 HP), forcing a desperate final melee clash!',
        failHpPenalty: 3,
      },
      choices: [
        {
          id: 'sr-12-might',
          title: 'Deliver the Earth-Shaker Overhead Cleave',
          description:
            'Leap from the highest altar step and bring your weapon down squarely onto Malakor’s crown.',
          attribute: 'might',
          dc: 15,
          tags: ['combat', 'boss'],
          failPenaltyText: 'Malakor’s death-grip aura drains your lifeforce (-3 HP).',
          failHpDamage: 3,
          successBonusText: 'Your weapon splits the Crown Phylactery in two!',
        },
        {
          id: 'sr-12-finesse',
          title: 'Pierce the Eye of the Crown',
          description:
            'Send a pinpoint strike straight through the central black diamond of the phylactery.',
          attribute: 'finesse',
          dc: 15,
          tags: ['combat', 'boss'],
          failPenaltyText: 'Shadow-tendrils whip across your chest (-3 HP).',
          failHpDamage: 3,
          successBonusText: 'Bullseye! The black diamond shatters into a thousand shards!',
        },
        {
          id: 'sr-12-arcana',
          title: 'Unleash the Dawn-Burst Banishment',
          description:
            'Channel every ounce of arcane power into a blinding beam of solar purification.',
          attribute: 'arcana',
          dc: 15,
          tags: ['combat', 'boss'],
          failPenaltyText: 'Abyssal backlash scorches your hands (-3 HP).',
          failHpDamage: 3,
          successBonusText: 'Solar fire consumes the Lich King’s immortal tether!',
        },
      ],
      nextNodeSuccess: 'victory',
      nextNodeFail: 'defeat',
      nextNodeCritical: 'victory',
    },
  },
}

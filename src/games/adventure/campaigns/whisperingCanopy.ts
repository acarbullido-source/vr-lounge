import type { AdventureCampaignDefinition } from '../types'

export const WHISPERING_CANOPY_CAMPAIGN: AdventureCampaignDefinition = {
  id: 'whispering-canopy',
  title: 'The Whispering Canopy',
  subtitle: 'Bioluminescent Blight of the Briar Queen',
  themeSummary:
    'Rappel into a subterranean cavern forest lit by towering azure mushrooms, survive hallucinogenic spore valleys and glass-fanged spider ambushes, and sever the parasitic blight-heart from Corrupted Dryad Queen Sylvanora.',
  accentColor: '#10B981',
  secondaryColor: '#A855F7',
  startNodeId: 'node-1',
  bossName: 'Corrupted Dryad Queen Sylvanora',
  nodes: {
    'node-1': {
      id: 'node-1',
      stageNumber: 1,
      act: 1,
      title: 'The Glow-Moss Sinkhole',
      subtitle: 'Act I · Stage 1 · Descent into the Bioluminescent Abyss',
      hazardBadge: '🍄 HYPNOTIC SPORE WHISPERS',
      prose:
        'Your party rappels down braided vine-ropes into a vast subterranean cavern forest lit by forty-foot azure mushrooms. As your boots touch the mossy floor, hypnotic chorus-whispers echo from the canopy above while razor-thorn creepers slither toward your ankles.',
      narrativeEcho: {
        fromSuccess:
          'Soft emerald and violet bioluminescence bathes your party as you touch down on the sinkhole floor.',
      },
      focalArt: 'glow-moss-sinkhole',
      choices: [
        {
          id: 'wc-1-might',
          title: 'Hack Through the Strangler Creepers',
          description:
            'Sweep your heavy blade in a wide arc to sever the encroaching thorn-vines at the root.',
          attribute: 'might',
          dc: 12,
          tags: ['combat', 'hazard'],
          failPenaltyText: 'Barbed briars tear across your forearms (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'Green sap sprays as the strangler vines recoil into the brush!',
        },
        {
          id: 'wc-1-finesse',
          title: 'Rappel Straight to the High Mushroom Caps',
          description:
            'Swing off the main rope onto the rubbery azure caps above the thorn-choked floor.',
          attribute: 'finesse',
          dc: 12,
          tags: ['chasm'],
          failPenaltyText: 'Slick fungal dew makes you slide hard against a stalk (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'You stick a silent landing atop the giant mushroom canopy!',
        },
        {
          id: 'wc-1-arcana',
          title: 'Attune to the Mycelial Song',
          description:
            'Filter out the hypnotic blight-whispers to hear the ancient forest’s true warning.',
          attribute: 'arcana',
          dc: 11,
          tags: ['riddle'],
          failPenaltyText: 'Hallucinogenic static clouds your vision (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'You attune to the ancient spores, revealing safe trails ahead!',
          grantsWorldFlag: 'mycelial_song_heard',
        },
      ],
      nextNodeSuccess: 'node-2',
      nextNodeFail: 'node-2',
      criticalGrantsFlag: 'mycelial_song_heard',
    },

    'node-2': {
      id: 'node-2',
      stageNumber: 2,
      act: 1,
      title: 'The Choking Vale',
      subtitle: 'Act I · Stage 2 · Hallucinogenic Poison Spore Hazards',
      hazardBadge: '☠️ RUPTURING VIOLET PUFFBALLS',
      prose:
        'The trail narrows through a sunken ravine carpeted with bloated violet puffball fungi. At the slightest vibration, the sacs rupture—billowing clouds of hallucinogenic purple spores that twist shadows into monsters and choke mortal lungs.',
      narrativeEcho: {
        fromSuccess:
          'Moving swiftly from the sinkhole landing, you spot the bloated puffballs before stepping on their trigger roots.',
        fromFail:
          'Torn by the sinkhole briars, you stumble into the Choking Vale as the first spore-sacs begin to swell.',
        flags: {
          mycelial_song_heard:
            'Mycelial Harmony: The forest’s rhythm shows you which violet puffballs are dormant and which are ready to burst!',
        },
      },
      focalArt: 'poison-spore-vale',
      choices: [
        {
          id: 'wc-2-arcana',
          title: 'Gust-Ward the Spore Clouds Away',
          description:
            'Conjure a swirling gale of clean cavern air (or ignite the spores from afar) to clear a safe lane.',
          attribute: 'arcana',
          dc: 12,
          tags: ['hazard', 'trap'],
          failPenaltyText: 'You inhale a lungful of violet neuro-spores (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'A crisp arcane whirlwind parts the poison fog like a curtain!',
        },
        {
          id: 'wc-2-finesse',
          title: 'Tip-Toe Along the Exposed Root-Ribs',
          description:
            'Step only on the petrified ironwood roots without vibrating a single puffball membrane.',
          attribute: 'finesse',
          dc: 12,
          tags: ['trap', 'hazard'],
          failPenaltyText: 'A hidden puffball pops beneath your heel (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'Not a single spore-sac ruptures under your feather-light stride!',
        },
        {
          id: 'wc-2-might',
          title: 'Hold Breath & Sprint the Ravine',
          description:
            'Clamp a soaked cloth over your face and power straight through the vale in one breath.',
          attribute: 'might',
          dc: 13,
          tags: ['hazard'],
          failPenaltyText: 'Caustic spores sting your eyes and throat (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'Your iron lungs carry you across the vale in record time!',
        },
      ],
      nextNodeSuccess: 'node-3a',
      nextNodeFail: 'node-3b',
      nextNodeCritical: 'node-3a',
    },

    'node-3a': {
      id: 'node-3a',
      stageNumber: 3,
      act: 1,
      title: 'The Luminous Grove',
      subtitle: 'Act I · Stage 3A · Uncorrupted Sprite Hollow',
      hazardBadge: '✨ UPPER PATH · AMBER SAP SANCTUARY',
      prose:
        'Emerging unscathed above the spore-clouds, you discover a hidden hollow of golden heart-trees tended by surviving luminescence-sprites. Golden resin drips from the bark—capable of burning away spider-silk and fungal blight alike.',
      narrativeEcho: {
        fromSuccess:
          'Because you crossed the Choking Vale without triggering a spore cascade, the sprites welcome you into the Luminous Grove!',
      },
      focalArt: 'luminous-sprite-grove',
      choices: [
        {
          id: 'wc-3a-arcana',
          title: 'Gather the Golden Amber-Sap Torches',
          description:
            'Commune with the grove sprites to receive torches dipped in sun-blessed heart-tree resin.',
          attribute: 'arcana',
          dc: 11,
          tags: ['riddle'],
          failPenaltyText: 'Hot amber sap stings your palm (-1 HP).',
          failHpDamage: 1,
          successBonusText:
            'You claim the Amber-Sap Torches—burning away spider webs and weakening the Blight (-1 Boss DC)!',
          grantsWorldFlag: 'amber_sap_torches',
          reducesBossDc: 1,
        },
        {
          id: 'wc-3a-finesse',
          title: 'Harvest Sun-Dew Nectar from the Canopy',
          description:
            'Climb the golden boughs to collect healing dew-drops (+1 HP healed & Amber-Sap Torches).',
          attribute: 'finesse',
          dc: 11,
          tags: ['chasm'],
          failPenaltyText: 'A thorny branch scratches your wrist (-1 HP).',
          failHpDamage: 1,
          successBonusText: 'Sweet sun-dew restores +1 HP and you bundle Amber-Sap Torches!',
          healOnSuccess: 1,
          grantsWorldFlag: 'amber_sap_torches',
        },
        {
          id: 'wc-3a-might',
          title: 'Clear the Fallen Blight-Branch',
          description:
            'Heave a rotting fungal log off the sprites’ root-shrine to earn their blessing.',
          attribute: 'might',
          dc: 11,
          tags: ['hazard'],
          failPenaltyText: 'Black thorns prick your shoulder (-1 HP).',
          failHpDamage: 1,
          successBonusText: 'The grateful sprites gift your party blazing Amber-Sap Torches!',
          grantsWorldFlag: 'amber_sap_torches',
          reducesBossDc: 1,
        },
      ],
      nextNodeSuccess: 'node-4',
      nextNodeFail: 'node-4',
    },

    'node-3b': {
      id: 'node-3b',
      stageNumber: 3,
      act: 1,
      title: "The Brood-Mother's Funnel",
      subtitle: 'Act I · Stage 3B · Razor-Silk Tripwire Ravine',
      hazardBadge: '⚠️ LOWER PATH · RAZOR-SILK WEB TRAP',
      prose:
        'Blinded by the violet spore clouds, your party stumbles into a sunken sinkhole lined with translucent, monofilament spider-silk! Every vibrating strand alerts the brood nests high in the dark canopy.',
      narrativeEcho: {
        fromFail:
          'Coughing out purple spores from the Choking Vale, you wander straight into the Brood-Mother’s silk funnel!',
      },
      focalArt: 'silk-funnel-trap',
      choices: [
        {
          id: 'wc-3b-finesse',
          title: 'Slice the Monofilament Tripwires',
          description:
            'Use angled dagger strokes to sever the tensioned anchor strands before the funnel constricts.',
          attribute: 'finesse',
          dc: 13,
          tags: ['trap', 'lock'],
          failPenaltyText: 'Razor-taut silk slices across your armor joints (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'The web-funnel parts cleanly around your blades!',
        },
        {
          id: 'wc-3b-might',
          title: 'Rip Free of the Adhesive Cocoon-Threads',
          description:
            'Flex every muscle and tear the sticky drag-lines out of the cavern walls.',
          attribute: 'might',
          dc: 13,
          tags: ['trap'],
          failPenaltyText: 'Acidic web-dew burns your skin (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'You rip the anchor-stones out of the rock and break free!',
        },
        {
          id: 'wc-3b-arcana',
          title: 'Singe the Webbing with Arcane Sparks',
          description:
            'Send controlled arcs of fire along the silk lattice to ash the funnel.',
          attribute: 'arcana',
          dc: 13,
          tags: ['trap'],
          failPenaltyText: 'Flaming silk droplets fall onto your cloak (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'Blue fire races up the strands, clearing the entire ravine!',
        },
      ],
      nextNodeSuccess: 'node-4',
      nextNodeFail: 'node-4',
    },

    'node-4': {
      id: 'node-4',
      stageNumber: 4,
      act: 1,
      title: 'Ambush of the Glass-Fanged Weavers',
      subtitle: 'Act I · Stage 4 · Canopy Spider Descent',
      hazardBadge: '🎯 CRUCIAL DARTBOARD CHECK · SEVER THE QUEEN-WEAVER WEB',
      prose:
        'A chorus of crystalline chittering fills the cavern as giant Glass-Fanged Weavers drop from the bioluminescent canopy on gossamer draglines! The massive Matriarch Weaver hooks a silk line onto your vanguard—threatening to hoist them into the dark!',
      narrativeEcho: {
        fromSuccess:
          'Emerging from the Luminous Grove with torches held high, you spot the descending spiders in time to aim!',
        fromFail:
          'Triggered by the vibrations in the silk funnel, the Glass-Fanged Weavers drop straight onto your party!',
        flags: {
          amber_sap_torches:
            'Amber-Sap Fire: The golden resin torches terrify the lesser spiders, leaving the Matriarch’s anchor-thread exposed!',
        },
      },
      focalArt: 'glass-fanged-weavers',
      crucialSkillCheck: {
        kind: 'darts',
        title: 'Crucial Lounge Dartboard Check: Sever the Queen-Weaver’s Anchor Thread',
        instruction:
          'Step up to the VR Lounge Dartboard and hit any scoring ring or Bullseye (or roll the Couch Fallback D20) to sever the Matriarch Weaver’s crystalline anchor-web before she drags your teammate into the canopy!',
        targetDescription: 'Hit a scoring ring / Bullseye on the Lounge Dartboard (or Roll D20 ≥ DC 14)',
        fallbackDc: 14,
        successRewardText:
          'SNAP! Your precision throw severs the crystalline dragline—sending the Matriarch Weaver crashing into the chasm below!',
        failPenaltyText:
          'The shot misses the swaying thread—venomous glass fangs sink into your party before you cut free (-2 HP)!',
        failHpPenalty: 2,
        grantsWorldFlag: 'matriarch_weaver_slain',
      },
      choices: [
        {
          id: 'wc-4-finesse',
          title: 'Pinpoint Shot to the Spinneret Crystal',
          description:
            'loose a projectile straight into the glowing spinneret organ beneath the Matriarch’s abdomen.',
          attribute: 'finesse',
          dc: 12,
          tags: ['combat'],
          failPenaltyText: 'Venom spray stings your cheek (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'The spinneret shatters and the spider brood scatters!',
        },
        {
          id: 'wc-4-might',
          title: 'Shatter the Crystalline Mandibles',
          description:
            'Meet the lunging weaver mid-air with a two-handed upward cleave.',
          attribute: 'might',
          dc: 13,
          tags: ['combat'],
          failPenaltyText: 'Glass fangs graze your shoulder plate (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'Translucent chitin explodes like shattered crystal!',
        },
        {
          id: 'wc-4-arcana',
          title: 'Shatter Chitin with Sonic Resonance',
          description:
            'Unleash a high-frequency thunderclap tuned to the resonant pitch of their glass fangs.',
          attribute: 'arcana',
          dc: 12,
          tags: ['combat'],
          failPenaltyText: 'A dying spider’s leg-spine scratches your arm (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'Every glass fang in the brood shatters at once!',
        },
      ],
      nextNodeSuccess: 'node-5',
      nextNodeFail: 'node-5',
      criticalGrantsFlag: 'matriarch_weaver_slain',
    },

    'node-5': {
      id: 'node-5',
      stageNumber: 5,
      act: 2,
      title: 'The Strangler-Root Bridge',
      subtitle: 'Act II · Stage 5 · Living Briar-Root Gorge Crossing',
      hazardBadge: '🌿 LASHING BRIAR-ROOT CHASM',
      prose:
        'Spanning a bottomless subterranean gorge is a braided bridge of colossal, living briar-roots. Infected by the Dryad Queen’s blight, the bridge writhes like a nest of vipers—buckling and lashing with six-inch thorns as you cross!',
      narrativeEcho: {
        fromSuccess:
          'With the Glass-Fanged Weavers routed, you reach the Strangler-Root Bridge at full stride.',
        fromFail:
          'Nursing venom-bites from the spider ambush, you must cross the writhing Strangler-Root Bridge.',
        flags: {
          amber_sap_torches:
            'Amber-Sap Repellent: The living briars flinch away from the golden glow of your sap-torches!',
        },
      },
      focalArt: 'strangler-root-bridge',
      choices: [
        {
          id: 'wc-5-finesse',
          title: 'Acrobatic Vault Along the Arching Tendrils',
          description:
            'Run along the bucking main root (or fire a Grappling Hook) to reach the far cavern shelf.',
          attribute: 'finesse',
          dc: 13,
          tags: ['chasm', 'hazard'],
          failPenaltyText: 'A whipping thorn-tendril lashes your calf (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'You sprint across the bucking roots without losing momentum!',
        },
        {
          id: 'wc-5-might',
          title: 'Pin the Central Root-Node with Steel',
          description:
            'Drive your weapon deep into the bridge’s central nerve-knot to paralyze its thrashing.',
          attribute: 'might',
          dc: 13,
          tags: ['combat', 'chasm'],
          failPenaltyText: 'Crushing root-coils bruise your ribs (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'Black ichor gushes from the nerve-knot and the bridge goes rigid!',
        },
        {
          id: 'wc-5-arcana',
          title: 'Lull the Roots with Druidic Slumber',
          description:
            'Project a soothing wave of winter-dormancy magic across the blighted wood.',
          attribute: 'arcana',
          dc: 13,
          tags: ['chasm', 'riddle'],
          failPenaltyText: 'Blighted sap-thorns nick your wrists (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'Frosty autumn leaves sprout as the bridge falls into deep slumber!',
        },
      ],
      nextNodeSuccess: 'node-6a',
      nextNodeFail: 'node-6b',
      nextNodeCritical: 'node-6a',
    },

    'node-6a': {
      id: 'node-6a',
      stageNumber: 6,
      act: 2,
      title: 'The Mycelial Memory Pool',
      subtitle: 'Act II · Stage 6A · Vision of the Parasitic Blight',
      hazardBadge: '✨ UPPER PATH · ANCIENT MEMORY POOL (-2 BOSS DC)',
      prose:
        'Crossing the pacified root bridge leads your party into a serene grotto cradling a mirror-still pool of bioluminescent nectar. Gazing into its depths reveals how a subterranean cordyceps parasite fused onto Queen Sylvanora’s crown—and the exact ritual to sever it!',
      narrativeEcho: {
        fromSuccess:
          'Because you mastered the Strangler-Root Bridge, you discover the hidden Mycelial Memory Pool!',
      },
      focalArt: 'mycelial-memory-pool',
      choices: [
        {
          id: 'wc-6a-arcana',
          title: 'Memorize the Purification Ritual',
          description:
            'Absorb the elder dryads’ memory-song to expose the parasitic blight-heart in the finale.',
          attribute: 'arcana',
          dc: 11,
          tags: ['riddle'],
          failPenaltyText: 'The intense vision leaves a brief ache (-1 HP).',
          failHpDamage: 1,
          successBonusText:
            'Purification Ritual Known! Sylvanora’s blight-heart weakness is exposed (-2 Boss DC)!',
          grantsWorldFlag: 'purification_ritual_known',
          reducesBossDc: 2,
        },
        {
          id: 'wc-6a-finesse',
          title: 'Bottle the Pure Memory-Phial',
          description:
            'Skim the glowing surface nectar into crystal phials (+1 HP healed & Purification Ritual Known).',
          attribute: 'finesse',
          dc: 11,
          tags: ['riddle'],
          failPenaltyText: 'Cold ripples numb your fingers (-1 HP).',
          failHpDamage: 1,
          successBonusText: 'You bottle the purifying nectar (+1 HP & -2 Boss DC)!',
          healOnSuccess: 1,
          grantsWorldFlag: 'purification_ritual_known',
          reducesBossDc: 2,
        },
        {
          id: 'wc-6a-might',
          title: 'Anoint Armor in the Elder Pool',
          description:
            'Submerge your shields in the glowing pool to ward off parasitic spores.',
          attribute: 'might',
          dc: 11,
          tags: ['sanctuary'],
          failPenaltyText: 'Chilly cave water soaks your boots (-1 HP).',
          failHpDamage: 1,
          successBonusText: 'Your gear gleams with blight-warding light (-1 Boss DC)!',
          grantsWorldFlag: 'purification_ritual_known',
          reducesBossDc: 1,
        },
      ],
      nextNodeSuccess: 'node-7',
      nextNodeFail: 'node-7',
    },

    'node-6b': {
      id: 'node-6b',
      stageNumber: 6,
      act: 2,
      title: 'The Spore-Zombie Hollow',
      subtitle: 'Act II · Stage 6B · Cordyceps Husk-Thrall Ambush',
      hazardBadge: '⚠️ LOWER PATH · CORDYCEPS THRALL HORDE',
      prose:
        'Knocked into the lower root-trench, your party lands amidst the remains of previous expeditions—now animated as shambling Husk-Thralls sprouted with glowing violet cordyceps stalks!',
      narrativeEcho: {
        fromFail:
          'Thrown from the lashing Strangler-Root Bridge, you land in the dreaded Spore-Zombie Hollow!',
      },
      focalArt: 'spore-zombie-hollow',
      choices: [
        {
          id: 'wc-6b-might',
          title: 'Cleave Through the Cordyceps Crowns',
          description:
            'Shatter the fungal stalks protruding from the thralls’ helms to sever their hive-mind.',
          attribute: 'might',
          dc: 14,
          tags: ['combat'],
          failPenaltyText: 'Rusted thrall blades scrape your armor (-3 HP).',
          failHpDamage: 3,
          successBonusText: 'You hew a path straight through the shambling horde!',
        },
        {
          id: 'wc-6b-arcana',
          title: 'Incinerate the Mycelial Hive-Network',
          description:
            'Send a wave of purifying flame through the floor roots animating the corpses.',
          attribute: 'arcana',
          dc: 13,
          tags: ['combat', 'hazard'],
          failPenaltyText: 'Bursting spore-skulls singe your cloak (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'The entire hollow erupts in cleansing azure fire!',
        },
        {
          id: 'wc-6b-finesse',
          title: 'Vault Over the Shambling Ring',
          description:
            'Use the towering mushroom stalks as springboards to leap over the encirclement.',
          attribute: 'finesse',
          dc: 13,
          tags: ['combat', 'chasm'],
          failPenaltyText: 'Grasping fungal claws tear at your boots (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'You bound across their shoulders and escape up the waterfall ledge!',
        },
      ],
      nextNodeSuccess: 'node-7',
      nextNodeFail: 'node-7',
    },

    'node-7': {
      id: 'node-7',
      stageNumber: 7,
      act: 2,
      title: 'Sanctuary Shrine — The Starlight Dew-Spring',
      subtitle: 'Act II · Stage 7 · Pure Crystal Waterfall Beneath the Great Tree',
      hazardBadge: '✨ SANCTUARY SHRINE · GHOSTS REVIVE TO 4 HP',
      prose:
        'Beneath the roots of an ancient, uncorrupted canopy giant, a waterfall of liquid starlight cascades into a crystal basin. No blight can cross its silver moss perimeter. All Spectral Ghosts in your party revive to 4 HP immediately!',
      narrativeEcho: {
        fromSuccess:
          'Carrying the wisdom of the Memory Pool, your party steps into the tranquil Starlight Dew-Spring.',
        fromFail:
          'Escaping the Spore-Zombie Hollow, you collapse across the silver moss boundary into safe starlight.',
      },
      focalArt: 'starlight-dew-shrine',
      isSanctuary: true,
      choices: [
        {
          id: 'wc-7-drink',
          title: 'Drink from the Starlight Waterfall',
          description:
            'Flush all fungal toxins from your veins and restore +3 HP immediately.',
          attribute: 'arcana',
          dc: 8,
          tags: ['sanctuary'],
          failPenaltyText: 'The starlight tingles harmlessly (0 HP lost).',
          failHpDamage: 0,
          successBonusText: 'Pure starlight purges every toxin (+3 HP restored)!',
          healOnSuccess: 3,
        },
        {
          id: 'wc-7-infuse',
          title: 'Infuse Weapons with Starlight Sap',
          description:
            'Coat your weapons in silver dew (+1 bonus on all rolls for the rest of the campaign & +2 HP).',
          attribute: 'might',
          dc: 9,
          tags: ['sanctuary'],
          failPenaltyText: 'A few drops spill, but you rest well (0 HP lost).',
          failHpDamage: 0,
          successBonusText: 'Your weapons gleam with blight-severing starlight (+1 Roll Bonus & +2 HP)!',
          healOnSuccess: 2,
          grantsWorldFlag: 'weapons_consecrated',
        },
        {
          id: 'wc-7-weave',
          title: 'Weave Silver-Moss Filter Masks',
          description:
            'Fashion breathable moss-filters for the pollen storm ahead (+2 HP restored).',
          attribute: 'finesse',
          dc: 8,
          tags: ['sanctuary'],
          failPenaltyText: 'The moss is damp, but you recover your breath (0 HP lost).',
          failHpDamage: 0,
          successBonusText: 'Your party dons silver-moss masks (+2 HP restored)!',
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
      title: 'The Pollen-Storm Gauntlet',
      subtitle: 'Act II · Stage 8 · Paralytic Golden Pollen & Snapping Flora',
      hazardBadge: '🌼 PARALYTIC POLLEN CYCLONE',
      prose:
        'Ascending the spiral bark-ramp of the Heart-Tree, your party is hit by a blinding cyclone of paralytic golden pollen! Lining the ramp are giant Venus Razor-Maws that snap at anything slowed by the narcotic dust.',
      narrativeEcho: {
        fromSuccess:
          'Restored by the Starlight Dew-Spring, your party charges up the Heart-Tree ramp into the swirling golden gale!',
      },
      focalArt: 'pollen-storm',
      choices: [
        {
          id: 'wc-8-finesse',
          title: 'Dart Between the Snapping Razor-Maws',
          description:
            'Use the wind currents to glide past the trigger-hairs of the carnivorous blooms.',
          attribute: 'finesse',
          dc: 13,
          tags: ['trap', 'hazard'],
          failPenaltyText: 'A snapping plant-jaw grazes your shoulder (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'You weave past every snapping bloom without triggering a single jaw!',
        },
        {
          id: 'wc-8-might',
          title: 'Wedge the Giant Razor-Maws Shut',
          description:
            'Jam ironwood branches between the snapping jaws and power up the bark-ramp.',
          attribute: 'might',
          dc: 13,
          tags: ['combat', 'hazard'],
          failPenaltyText: 'Paralytic pollen numbs your arms (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'You pry the monstrous blooms apart for the whole squad!',
        },
        {
          id: 'wc-8-arcana',
          title: 'Ignite a Controlled Flash-Burn',
          description:
            'Spark a precise thermal pulse to incinerate the suspended pollen without burning the tree.',
          attribute: 'arcana',
          dc: 13,
          tags: ['hazard'],
          failPenaltyText: 'The pollen flash singes your eyebrows (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'The golden haze vanishes in a harmless shimmer of warmth!',
        },
      ],
      nextNodeSuccess: 'node-9',
      nextNodeFail: 'node-9',
    },

    'node-9': {
      id: 'node-9',
      stageNumber: 9,
      act: 3,
      title: 'The Silk-Cocoon Prison',
      subtitle: 'Act III · Stage 9 · Heart-Tree Root Lock & Spider Wardens',
      hazardBadge: '⛳ CRUCIAL PUTTING CHECK · GUIDE THE SEED-ORB',
      prose:
        'Sealing the entrance to the Heart-Tree Sanctum is a petrified root-door guarded by armored Spider Wardens. To awaken the ancient door and drop the wardens’ silk barriers, a player must roll a glowing Life-Seed Orb along a curved root channel into the heartwood cradle!',
      narrativeEcho: {
        fromSuccess:
          'Breaking out of the Pollen-Storm Gauntlet at full speed, you reach the Silk-Cocoon Prison before the wardens can web the channel.',
        fromFail:
          'Half-numbed by golden pollen, you stumble into the Silk-Cocoon Prison as Spider Wardens hiss from the rafters.',
      },
      focalArt: 'silk-cocoon-prison',
      crucialSkillCheck: {
        kind: 'putting',
        title: 'Crucial Lounge Putting Check: Guide the Glowing Life-Seed Orb',
        instruction:
          'Step up to the VR Lounge Putting Strip (or roll the Couch Fallback D20) to roll the glowing Life-Seed Orb along the curved root channel into the heartwood lock!',
        targetDescription: 'Sink a putt on the Lounge Putting Strip (or Roll D20 ≥ DC 14)',
        fallbackDc: 14,
        successRewardText:
          'HEARTWOOD AWAKENED! The Life-Seed Orb settles into the cradle—golden roots blossom open and banish the Spider Wardens!',
        failPenaltyText:
          'The Seed-Orb rolls off the root edge—the Spider Wardens pounce with venomous fangs (-2 HP)!',
        failHpPenalty: 2,
        grantsWorldFlag: 'heartwood_cradle_lit',
        exposesBossWeakness: true,
      },
      choices: [
        {
          id: 'wc-9-finesse',
          title: 'Finesse the Seed-Orb Along the Root Bank',
          description:
            'Impart gentle topspin so the glowing orb hugs the mossy curve into the socket.',
          attribute: 'finesse',
          dc: 13,
          tags: ['lock', 'trap'],
          failPenaltyText: 'Acidic web-spit burns your hand (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'The Life-Seed Orb drops cleanly into the heartwood lock!',
        },
        {
          id: 'wc-9-might',
          title: 'Hold Off the Armored Spider Wardens',
          description:
            'Form a one-person wall of steel to keep the wardens off the root channel.',
          attribute: 'might',
          dc: 14,
          tags: ['combat'],
          failPenaltyText: 'Chitinous forelegs batter your shield (-3 HP).',
          failHpDamage: 3,
          successBonusText: 'You hurl both Spider Wardens back into their own cocoons!',
        },
        {
          id: 'wc-9-arcana',
          title: 'Coax the Root-Channel to Guide the Orb',
          description:
            'Whisper a growth-cantrip so the living bark banks the Seed-Orb into the lock.',
          attribute: 'arcana',
          dc: 13,
          tags: ['lock', 'riddle'],
          failPenaltyText: 'Blighted thorns prick your palms (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'Living wood cradles the Seed-Orb straight into the heart-socket!',
        },
      ],
      nextNodeSuccess: 'node-10a',
      nextNodeFail: 'node-10b',
      nextNodeCritical: 'node-10a',
      criticalGrantsFlag: 'heartwood_cradle_lit',
    },

    'node-10a': {
      id: 'node-10a',
      stageNumber: 10,
      act: 3,
      title: 'Cleansing the Heart-Sap',
      subtitle: 'Act III · Stage 10A · Purging the Black Ichor Artery',
      hazardBadge: '✨ UPPER PATH · HEART-SAP PURGED (-2 BOSS DC)',
      prose:
        'Because the Life-Seed Orb unlocked the upper root-artery, your party intercepts the main vein of black parasitic ichor feeding Queen Sylvanora’s throne! You have a clean chance to sever and purify the blight-vein before entering her chamber.',
      narrativeEcho: {
        fromSuccess:
          'The awakened heartwood door opens directly into the primary sap-artery above the throne room!',
        flags: {
          amber_sap_torches:
            'Amber-Sap Ignition: Your golden resin torches set the black ichor vein ablaze on contact!',
        },
      },
      focalArt: 'cleansing-heart-sap',
      choices: [
        {
          id: 'wc-10a-arcana',
          title: 'Purify the Sap-Vein with Starlight',
          description:
            'Channel radiant energy into the heart-tree artery to turn the black ichor back into golden sap.',
          attribute: 'arcana',
          dc: 12,
          tags: ['riddle'],
          failPenaltyText: 'Boiling ichor splatters your sleeve (-1 HP).',
          failHpDamage: 1,
          successBonusText:
            'Golden sap surges into the throne room—Sylvanora’s Boss DC drops by 2!',
          grantsWorldFlag: 'heart_sap_cleansed',
          reducesBossDc: 2,
        },
        {
          id: 'wc-10a-might',
          title: 'Chop Through the Parasitic Root-Tendon',
          description:
            'Sever the pulsing black cordyceps artery starving the Dryad Queen of regeneration.',
          attribute: 'might',
          dc: 12,
          tags: ['combat'],
          failPenaltyText: 'Thrashing root-fibers whip your arm (-1 HP).',
          failHpDamage: 1,
          successBonusText: 'The parasite’s main feeding artery is severed (-2 Boss DC)!',
          grantsWorldFlag: 'heart_sap_cleansed',
          reducesBossDc: 2,
        },
        {
          id: 'wc-10a-finesse',
          title: 'Inject Starlight Dew into the Main Vein',
          description:
            'Pierce the artery wall with a precision needle-strike to poison the parasite (+2 HP & -2 Boss DC).',
          attribute: 'finesse',
          dc: 12,
          tags: ['trap'],
          failPenaltyText: 'A thorn-valve pricks your thumb (-1 HP).',
          failHpDamage: 1,
          successBonusText: 'Golden dew floods the vein (+2 HP healed & -2 Boss DC)!',
          healOnSuccess: 2,
          grantsWorldFlag: 'heart_sap_cleansed',
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
      title: 'Blighted Thorns Enrage',
      subtitle: 'Act III · Stage 10B · Erupting Toxic Spore Vents',
      hazardBadge: '⚠️ LOWER PATH · TOXIC BRIAR TUNNEL',
      prose:
        'Forced through the lower root-crawl as the Spider Wardens sound the alarm, your party must battle through a constricting tunnel of black iron-thorns and erupting toxic spore-geysers!',
      narrativeEcho: {
        fromFail:
          'Because the heartwood lock remained sealed, you are forced through the constricting Blighted Thorns tunnel!',
      },
      focalArt: 'blighted-thorns',
      choices: [
        {
          id: 'wc-10b-might',
          title: 'Smash a Tunnel Through the Iron-Briars',
          description:
            'Batter down the wall of black thorns with your shields before the spore vents erupt.',
          attribute: 'might',
          dc: 14,
          tags: ['hazard', 'combat'],
          failPenaltyText: 'Iron-hard thorns punch through your mail (-3 HP).',
          failHpDamage: 3,
          successBonusText: 'You bull-rush straight through the briar wall into the throne room!',
        },
        {
          id: 'wc-10b-finesse',
          title: 'Contort Through the Thorn Lattice',
          description:
            'Twist between the pulsing spore vents with razor-thin timing.',
          attribute: 'finesse',
          dc: 14,
          tags: ['trap', 'hazard'],
          failPenaltyText: 'A spore-vent eruption blisters your neck (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'You thread the needle through the briar maze unscathed!',
        },
        {
          id: 'wc-10b-arcana',
          title: 'Wither the Blight-Thorns with Frost',
          description:
            'Flash-freeze the black briars so they shatter like brittle glass.',
          attribute: 'arcana',
          dc: 14,
          tags: ['hazard'],
          failPenaltyText: 'Spore-acid splashes your boots (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'Frozen thorns crumble into harmless powder before you!',
        },
      ],
      nextNodeSuccess: 'node-11',
      nextNodeFail: 'node-11',
    },

    'node-11': {
      id: 'node-11',
      stageNumber: 11,
      act: 3,
      title: 'Throne of the Briar Crown',
      subtitle: 'Act III · Stage 11 · Corrupted Dryad Queen Sylvanora',
      hazardBadge: '🕷️ BOSS PHASE I · FUNGAL SPIDER-CARAPACE',
      prose:
        'At the hollow heart of the Great Tree, Corrupted Dryad Queen Sylvanora descends from a web of glowing violet mycelium! Fused to a colossal fungal spider-carapace, she weeps tears of golden sap even as the cordyceps crown forces her to lash out with barbed briar-spears!',
      narrativeEcho: {
        fromSuccess:
          'With the black sap-artery purged, Sylvanora’s fungal carapace is already cracking and sluggish!',
        fromFail:
          'Bursting from the thorn tunnel, you face Queen Sylvanora at the height of her blighted fury!',
        flags: {
          purification_ritual_known:
            'Purification Insight: You see the exact violet nerve-stalks linking the parasite crown to Sylvanora’s brow!',
          heart_sap_cleansed:
            'Cleansed Sap: Golden light pulses through the floor roots, weakening the spider-carapace!',
        },
      },
      focalArt: 'briar-crown-throne',
      choices: [
        {
          id: 'wc-11-finesse',
          title: 'Sever the Four Fungal Carapace Tendons',
          description:
            'Dart beneath her thrashing spider-legs to slice the violet cords binding her to the beast.',
          attribute: 'finesse',
          dc: 14,
          tags: ['combat', 'boss'],
          failPenaltyText: 'A barbed briar-spear grazes your side (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'Three of the four fungal tendons snap—exposing the Blight-Heart!',
          reducesBossDc: 1,
        },
        {
          id: 'wc-11-might',
          title: 'Shatter the Foreleg Chitin Shields',
          description:
            'Parry her sweeping scythe-limbs and crack the fungal armor plating.',
          attribute: 'might',
          dc: 14,
          tags: ['combat', 'boss'],
          failPenaltyText: 'The sweeping carapace slams you into a root (-3 HP).',
          failHpDamage: 3,
          successBonusText: 'You splinter her front carapace guards wide open!',
          reducesBossDc: 1,
        },
        {
          id: 'wc-11-arcana',
          title: 'Chant the Elder Dryad Awakening',
          description:
            'Resonate with Sylvanora’s trapped spirit so she fights back against the parasite’s control.',
          attribute: 'arcana',
          dc: 14,
          tags: ['combat', 'boss', 'riddle'],
          failPenaltyText: 'Psychic spore-shrieks pierce your mind (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'Sylvanora’s eyes flash gold—she forces the carapace to halt!',
          reducesBossDc: 1,
        },
      ],
      nextNodeSuccess: 'node-12',
      nextNodeFail: 'node-12',
      nextNodeCritical: 'node-12',
      criticalGrantsFlag: 'carapace_tendons_severed',
    },

    'node-12': {
      id: 'node-12',
      stageNumber: 12,
      act: 3,
      title: 'Finale — The Corrupted Dryad Queen',
      subtitle: 'Act III · Stage 12 · Severing the Parasitic Blight-Heart',
      hazardBadge: '🎲 CRUCIAL FINALE CHECK · PURIFY OR DESTROY THE BRIAR CROWN',
      prose:
        'Shrieking in desperation, the cordyceps parasite splits open its Briar Crown above Sylvanora’s head—preparing to release a cavern-wide *Extinction Spore-Nova*! The pulsing violet Blight-Heart is exposed for one heartbeat. Strike now to sever the parasite and save the Whispering Canopy!',
      narrativeEcho: {
        fromSuccess:
          'With her fungal tendons severed and her spirit awakened, Sylvanora holds the Briar Crown still for your final strike!',
        fromFail:
          'Through a tempest of spores and lashing thorns, the pulsing Blight-Heart opens before you!',
        flags: {
          purification_ritual_known:
            'Ritual Complete: The Elder Dryads’ song guides your strike cleanly between Sylvanora’s life-threads!',
          amber_sap_torches:
            'Amber-Sap Blaze: Golden fire burns away the final veil of protective mycelium!',
        },
      },
      focalArt: 'dryad-queen-finale',
      isFinale: true,
      crucialSkillCheck: {
        kind: 'wrist-d20',
        title: 'Crucial Finale Check: Sever the Parasitic Blight-Heart!',
        instruction:
          'Roll the High-Stakes Finale D20 from your Wrist HUD, /mobile companion, or Cinema Screen (or hit the Dartboard / Putting Strip) to sever the Blight-Heart from Queen Sylvanora’s crown!',
        targetDescription: 'Roll High-Stakes D20 ≥ DC 13 (reduced by Boss Weaknesses)',
        fallbackDc: 13,
        successRewardText:
          'CANOPY REBORN! The parasitic Blight-Heart turns to golden ash—Queen Sylvanora rises healed as emerald blossoms illuminate the entire subterranean forest!',
        failPenaltyText:
          'Extinction Spore-Nova erupts across the sanctum (-3 HP), demanding one final heroic roll!',
        failHpPenalty: 3,
      },
      choices: [
        {
          id: 'wc-12-finesse',
          title: 'Surgical Strike to the Blight-Heart Stem',
          description:
            'Sever the exact millimeter where the parasite joins the Dryad Queen’s crown.',
          attribute: 'finesse',
          dc: 15,
          tags: ['combat', 'boss'],
          failPenaltyText: 'Whipping crown-thorns slice your cheek (-3 HP).',
          failHpDamage: 3,
          successBonusText: 'You sever the Blight-Heart cleanly—saving Queen Sylvanora’s life!',
        },
        {
          id: 'wc-12-arcana',
          title: 'Complete the Starlight Purification Rite',
          description:
            'Pour radiant starlight into the Briar Crown to dissolve the cordyceps parasite from within.',
          attribute: 'arcana',
          dc: 15,
          tags: ['combat', 'boss', 'riddle'],
          failPenaltyText: 'Spore-psychic backlash scorches your aura (-3 HP).',
          failHpDamage: 3,
          successBonusText: 'Pure starlight incinerates the parasite and restores the Queen!',
        },
        {
          id: 'wc-12-might',
          title: 'Shatter the Briar Crown in One Blow',
          description:
            'Leap onto the fungal carapace and smash the corrupted crown off her brow.',
          attribute: 'might',
          dc: 15,
          tags: ['combat', 'boss'],
          failPenaltyText: 'Exploding spore-spines batter your chest (-3 HP).',
          failHpDamage: 3,
          successBonusText: 'The corrupted crown shatters into dust and the forest blooms anew!',
        },
      ],
      nextNodeSuccess: 'victory',
      nextNodeFail: 'defeat',
      nextNodeCritical: 'victory',
    },
  },
}

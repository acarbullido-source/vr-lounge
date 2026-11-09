import type { AdventureCampaignDefinition } from '../types'

export const VOIDSPIRE_BASTION_CAMPAIGN: AdventureCampaignDefinition = {
  id: 'voidspire-bastion',
  title: 'Voidspire Bastion',
  subtitle: "Astral Citadel of Xal'Vorith",
  themeSummary:
    "Ascend floating marble ruins suspended in a purple nebula vortex, master 90-degree shifting gravity portals and crystalline Sphinx riddles, and banish the Eldritch Mind-Tyrant Xal'Vorith before reality collapses.",
  accentColor: '#A855F7',
  secondaryColor: '#38BDF8',
  startNodeId: 'node-1',
  bossName: "Xal'Vorith, the Eldritch Mind-Tyrant",
  nodes: {
    'node-1': {
      id: 'node-1',
      stageNumber: 1,
      act: 1,
      title: 'The Shattered Star-Dock',
      subtitle: 'Act I · Stage 1 · Zero-Gravity Astral Pier',
      hazardBadge: '🌌 ZERO-G TETHER DRIFT',
      prose:
        'Floating white-marble ruins drift inside a swirling violet nebula vortex. Ahead of your party, the ancient Tether-Bridge rotates ninety degrees sideways in zero gravity while crackling void-lightning arcs between broken astral moorings.',
      narrativeEcho: {
        fromSuccess:
          'Starlight glints off your armor as your party steps onto the shattered astral dock above the cosmic abyss.',
      },
      focalArt: 'shattered-star-dock',
      choices: [
        {
          id: 'vb-1-arcana',
          title: 'Re-Anchor the Astral Mooring Runes',
          description:
            'Channel arcane energy into the dock’s obelisk to lock the rotating tether-bridge upright.',
          attribute: 'arcana',
          dc: 11,
          tags: ['riddle', 'hazard'],
          failPenaltyText: 'Void-static jolts your fingertips (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'Golden ley-lines snap taut, locking the marble bridge into alignment!',
          grantsWorldFlag: 'star_dock_aligned',
        },
        {
          id: 'vb-1-finesse',
          title: 'Zero-G Vault Across the Rotating Pier',
          description:
            'Kick off a drifting monolith and run along the vertical side of the rotating bridge.',
          attribute: 'finesse',
          dc: 12,
          tags: ['chasm'],
          failPenaltyText: 'A drifting marble shard clips your shoulder (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'You glide effortlessly through the zero-gravity pocket!',
        },
        {
          id: 'vb-1-might',
          title: 'Haul the Tether-Chain by Brute Force',
          description:
            'Seize the glowing astral anchor chain and pull the drifting bridge pier back to the dock.',
          attribute: 'might',
          dc: 12,
          tags: ['chasm', 'hazard'],
          failPenaltyText: 'The surging chain wrenches your arms (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'With a titanic heave, you slam the bridge pier into its socket!',
        },
      ],
      nextNodeSuccess: 'node-2',
      nextNodeFail: 'node-2',
      criticalGrantsFlag: 'star_dock_aligned',
    },

    'node-2': {
      id: 'node-2',
      stageNumber: 2,
      act: 1,
      title: 'The Escher Causeway',
      subtitle: 'Act I · Stage 2 · 90-Degree Shifting Gravity Portals',
      hazardBadge: '⛳ CRUCIAL PUTTING CHECK · SINGULARITY SPHERE VECTOR',
      prose:
        'A labyrinth of impossible inverted stairways hangs in the void, where gravity flips ninety degrees every ten seconds! To lock the causeway’s gravity vector, a player must launch a Stabilization Singularity Sphere straight across the shifting plane into the central anchor ring!',
      narrativeEcho: {
        fromSuccess:
          'Crossing the aligned Star-Dock, you reach the Escher Causeway with a clear view of its gravity vectors.',
        fromFail:
          'Tumbling out of the zero-G dock, your boots slam onto the Escher Causeway just as gravity lurches sideways!',
        flags: {
          star_dock_aligned:
            'Ley-Line Sight: The mooring runes you activated trace a glowing trajectory line toward the anchor ring!',
        },
      },
      focalArt: 'escher-causeway',
      crucialSkillCheck: {
        kind: 'putting',
        title: 'Crucial Lounge Putting Check: Launch the Singularity Sphere',
        instruction:
          'Step up to the VR Lounge Putting Strip (or roll the Couch Fallback D20) to roll the Stabilization Singularity Sphere straight through the shifting gravity vector into the anchor ring!',
        targetDescription: 'Sink a putt on the Lounge Putting Strip (or Roll D20 ≥ DC 14)',
        fallbackDc: 14,
        successRewardText:
          'GRAVITY LOCKED! The Singularity Sphere drops into the anchor ring—aligning every stairway toward the Astrolabe Observatory!',
        failPenaltyText:
          'Gravity flips mid-roll! The sphere curves into the void and your party falls sideways onto a lower arch (-2 HP)!',
        failHpPenalty: 2,
        grantsWorldFlag: 'void_compass_attuned',
      },
      choices: [
        {
          id: 'vb-2-finesse',
          title: 'Time the 10-Second Gravity Flip',
          description:
            'Release the singularity sphere at the exact inflection point between vertical and horizontal gravity.',
          attribute: 'finesse',
          dc: 12,
          tags: ['trap', 'chasm'],
          failPenaltyText: 'A sudden gravity inversion slams you against a balustrade (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'You ride the gravity shift like a wave straight to the upper arch!',
        },
        {
          id: 'vb-2-arcana',
          title: 'Calculate the Non-Euclidean Trajectory',
          description:
            'Bend the local space-time curvature so the sphere rolls straight into the ring.',
          attribute: 'arcana',
          dc: 12,
          tags: ['riddle', 'chasm'],
          failPenaltyText: 'Spatial vertigo sears your temples (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'Your warp-vector guides the sphere dead-center!',
        },
        {
          id: 'vb-2-might',
          title: 'Anchor Boots & Hurl Across the Rift',
          description:
            'Lock your gauntlets onto a gravity-pillar and power-throw your allies to the upper stair.',
          attribute: 'might',
          dc: 13,
          tags: ['chasm'],
          failPenaltyText: 'Crushing G-forces strain your shoulders (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'You muscle through triple gravity and secure the upper causeway!',
        },
      ],
      nextNodeSuccess: 'node-3a',
      nextNodeFail: 'node-3b',
      nextNodeCritical: 'node-3a',
      criticalGrantsFlag: 'void_compass_attuned',
    },

    'node-3a': {
      id: 'node-3a',
      stageNumber: 3,
      act: 1,
      title: 'The Astrolabe Observatory',
      subtitle: 'Act I · Stage 3A · Celestial Ley-Line Alignment',
      hazardBadge: '✨ UPPER PATH · ASTROLABE VAULT (-1 BOSS DC)',
      prose:
        'With the Escher Causeway stabilized, your party ascends into a domed observatory of spinning brass rings and star-charts. At its center floats the Void Compass—capable of anchoring reality against Xal’Vorith’s dimension-warping powers.',
      narrativeEcho: {
        fromSuccess:
          'Because you stabilized the Singularity Sphere, the Escher stairs carried you straight into the Astrolabe Observatory!',
      },
      focalArt: 'astrolabe-observatory',
      choices: [
        {
          id: 'vb-3a-arcana',
          title: 'Attune the Astral Void-Compass',
          description:
            'Align the three celestial brass rings to lock onto Xal’Vorith’s true dimensional signature.',
          attribute: 'arcana',
          dc: 11,
          tags: ['riddle'],
          failPenaltyText: 'A stray star-beam singes your sleeve (-1 HP).',
          failHpDamage: 1,
          successBonusText:
            'Void Compass Attuned! Xal’Vorith’s dimensional illusions weaken (-1 Boss DC)!',
          grantsWorldFlag: 'void_compass_attuned',
          reducesBossDc: 1,
        },
        {
          id: 'vb-3a-finesse',
          title: 'Unlock the Star-Chart Reliquary',
          description:
            'Pick the constellation dial-lock to claim astral starlight phials (+1 HP & Void Compass).',
          attribute: 'finesse',
          dc: 11,
          tags: ['lock'],
          failPenaltyText: 'A brass gear pinches your thumb (-1 HP).',
          failHpDamage: 1,
          successBonusText: 'You unlock the star-phials (+1 HP healed & Void Compass Attuned)!',
          healOnSuccess: 1,
          grantsWorldFlag: 'void_compass_attuned',
        },
        {
          id: 'vb-3a-might',
          title: 'Rotate the Jammed Solstice Ring',
          description:
            'Shoulder the massive outer bronze ring of the astrolabe into alignment.',
          attribute: 'might',
          dc: 11,
          tags: ['hazard'],
          failPenaltyText: 'Heavy bronze grinds against your pauldron (-1 HP).',
          failHpDamage: 1,
          successBonusText: 'The astrolabe locks into solstice alignment (-1 Boss DC)!',
          grantsWorldFlag: 'void_compass_attuned',
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
      title: 'The Entropy Drift',
      subtitle: 'Act I · Stage 3B · Colliding Asteroid Debris Field',
      hazardBadge: '⚠️ LOWER PATH · COLLIDING METEORITES',
      prose:
        'Flung off the Escher Causeway by the gravity inversion, your party tumbles into the Entropy Drift—a chaotic belt of colliding marble ruins and void-meteorites hurtling around the base of the spire!',
      narrativeEcho: {
        fromFail:
          'Because the gravity vector flipped out of control, your party was cast into the colliding debris of the Entropy Drift!',
      },
      focalArt: 'entropy-asteroid-drift',
      choices: [
        {
          id: 'vb-3b-finesse',
          title: 'Leap Across the Tumbling Meteorites',
          description:
            'Use a Grappling Hook or precision zero-G leaps to hop from spinning rock to rock.',
          attribute: 'finesse',
          dc: 13,
          tags: ['chasm', 'hazard'],
          failPenaltyText: 'Colliding marble shrapnel bruises your ribs (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'You thread the asteroid belt and land on the Sphinx terrace!',
        },
        {
          id: 'vb-3b-might',
          title: 'Shatter Incoming Debris Boulders',
          description:
            'Stand at the prow of a drifting ruin-slab and smash every boulder hurtling toward the party.',
          attribute: 'might',
          dc: 13,
          tags: ['combat', 'hazard'],
          failPenaltyText: 'A dense iron meteorite numbs your arms (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'You pulverize a path straight through the debris storm!',
        },
        {
          id: 'vb-3b-arcana',
          title: 'Project a Repulsion Vector-Shield',
          description:
            'Surround your drifting slab in a kinetic bubble to deflect tumbling rocks.',
          attribute: 'arcana',
          dc: 13,
          tags: ['hazard'],
          failPenaltyText: 'Kinetic impact rattles your teeth (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'Meteorites bounce harmlessly off your glowing vector-shield!',
        },
      ],
      nextNodeSuccess: 'node-4',
      nextNodeFail: 'node-4',
    },

    'node-4': {
      id: 'node-4',
      stageNumber: 4,
      act: 1,
      title: 'The Sphinx Automaton',
      subtitle: 'Act I · Stage 4 · Four-Faced Crystalline Construct & Paradox Riddle',
      hazardBadge: '🔮 ARCANE PARADOX RIDDLE',
      prose:
        'Guarding the inner spire gate sits a towering, four-faced Crystalline Sphinx Automaton. Its facets blaze with psychic lasers as its resonant voice echoes: *"I devour stars yet weigh nothing; I slow time yet speed all falling things. Name my heart or be unmade!"*',
      narrativeEcho: {
        fromSuccess:
          'Stepping down from the Astrolabe Observatory, you recognize the celestial symbols etched on the Sphinx’s brow.',
        fromFail:
          'Bruised by the Entropy Drift, you scramble onto the gate plaza as the Sphinx Automaton charges its eye-beams.',
        flags: {
          void_compass_attuned:
            'Void Compass Resonance: The compass needle points directly to the Singularity Glyph on the Sphinx’s pedestal!',
        },
      },
      focalArt: 'sphinx-automaton',
      choices: [
        {
          id: 'vb-4-arcana',
          title: 'Intone the Answer: "A Singularity"',
          description:
            'Speak the true cosmic answer in High Astral while tracing the event-horizon rune.',
          attribute: 'arcana',
          dc: 12,
          tags: ['riddle'],
          failPenaltyText: 'A psychic correction beam singes your brow (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'The Sphinx bows its four crystal heads and slides the gate open!',
        },
        {
          id: 'vb-4-finesse',
          title: 'Align the Mirror Prisms to Reflect Its Beam',
          description:
            'Angle bucklers and crystal shards to bounce the Sphinx’s psychic laser back into its own lock-core.',
          attribute: 'finesse',
          dc: 13,
          tags: ['trap', 'riddle'],
          failPenaltyText: 'A refracted laser ray grazes your shoulder (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'The reflected beam unlocks the spire gate automatically!',
        },
        {
          id: 'vb-4-might',
          title: 'Crack the Construct’s Logic-Pedestal',
          description:
            'Cut the Gordian knot by smashing the quartz logic-crystal beneath the Sphinx’s paws.',
          attribute: 'might',
          dc: 13,
          tags: ['combat'],
          failPenaltyText: 'Crystalline shockwaves sting your hands (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'The logic-crystal shatters and the Sphinx powers down in mid-riddle!',
        },
      ],
      nextNodeSuccess: 'node-5',
      nextNodeFail: 'node-5',
    },

    'node-5': {
      id: 'node-5',
      stageNumber: 5,
      act: 2,
      title: 'The Hall of Fractured Mirrors',
      subtitle: 'Act II · Stage 5 · Dimensional Doppelganger Ambush',
      hazardBadge: '🪞 SHADOW DOPPELGANGERS',
      prose:
        'Inside the spire’s central gallery, towering obsidian mirrors ripple like liquid mercury. Out of the reflections step void-spun Doppelgangers wearing your exact armor, wielding your exact weapons, and mirroring every move you make!',
      narrativeEcho: {
        fromSuccess:
          'Passing the Sphinx Gate with minds sharp, you spot the ripples in the obsidian mirrors before the reflections strike.',
        fromFail:
          'Scorched by the Sphinx’s psychic beams, you stumble into the mirror gallery as your own reflections draw steel!',
      },
      focalArt: 'fractured-mirrors',
      choices: [
        {
          id: 'vb-5-arcana',
          title: 'Dispel the Dimensional Reflection Matrix',
          description:
            'Shatter the illusion wavelength binding the doppelgangers to the material plane.',
          attribute: 'arcana',
          dc: 13,
          tags: ['combat', 'riddle'],
          failPenaltyText: 'Your reflection’s counter-spell singes your chest (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'The doppelgangers dissolve into harmless violet glass!',
        },
        {
          id: 'vb-5-might',
          title: 'Shatter the Source Obsidian Mirrors',
          description:
            'Ignore the clones and drive your weapon straight into the seven-foot mirror frames.',
          attribute: 'might',
          dc: 13,
          tags: ['combat'],
          failPenaltyText: 'Your doppelganger matches your blow, bruising your ribs (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'Seven mirrors explode at once—banishing every clone in the hall!',
        },
        {
          id: 'vb-5-finesse',
          title: 'Cross-Target Each Other’s Reflections',
          description:
            'Swap targets mid-lunge so no doppelganger can predict its opponent’s strike pattern.',
          attribute: 'finesse',
          dc: 13,
          tags: ['combat'],
          failPenaltyText: 'A mirrored blade nicks your vambrace (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'Your unpredictable cross-strikes shatter the clones in seconds!',
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
      title: 'The Chronos Archive',
      subtitle: 'Act II · Stage 6A · Forbidden Psychic Shielding Vault',
      hazardBadge: '✨ UPPER PATH · NEURAL WARD ARCHIVE (-2 BOSS DC)',
      prose:
        'Shattering the Hall of Mirrors unlocks a hidden stair into the Chronos Archive. Floating crystal scrolls detail how to weave an impenetrable **Neural Ward**—protecting mortal minds from Xal’Vorith’s DC-scrambling illusions in the apex!',
      narrativeEcho: {
        fromSuccess:
          'Your triumph over the mirror doppelgangers revealed the secret archway into the Chronos Archive!',
      },
      focalArt: 'chronos-archive',
      choices: [
        {
          id: 'vb-6a-arcana',
          title: 'Inscribe the Neural Ward onto the Party',
          description:
            'Bind the psychic-shielding glyphs to every party member (blocks Xal’Vorith’s DC scramble & -2 Boss DC).',
          attribute: 'arcana',
          dc: 12,
          tags: ['riddle'],
          failPenaltyText: 'Chronos static tingles across your brow (-1 HP).',
          failHpDamage: 1,
          successBonusText:
            'Neural Ward Active! Your minds are immune to Xal’Vorith’s illusions (-2 Boss DC)!',
          grantsWorldFlag: 'neural_ward_active',
          reducesBossDc: 2,
        },
        {
          id: 'vb-6a-finesse',
          title: 'Extract the Psychic Crown-Circlets',
          description:
            'Disarm the time-locked display case to equip everyone with mind-shielding circlets.',
          attribute: 'finesse',
          dc: 12,
          tags: ['lock'],
          failPenaltyText: 'A temporal spark nips your fingers (-1 HP).',
          failHpDamage: 1,
          successBonusText: 'Everyone equips a Neural Ward circlet (+1 HP & -2 Boss DC)!',
          healOnSuccess: 1,
          grantsWorldFlag: 'neural_ward_active',
          reducesBossDc: 2,
        },
        {
          id: 'vb-6a-might',
          title: 'Shatter the Mind-Tyrant’s Memory Obelisk',
          description:
            'Topple the archive’s dark psychic relay pillar to weaken Xal’Vorith’s telepathy.',
          attribute: 'might',
          dc: 12,
          tags: ['combat'],
          failPenaltyText: 'Falling quartz chips graze your knuckles (-1 HP).',
          failHpDamage: 1,
          successBonusText: 'The telepathic relay crumbles—Neural Ward Active (-2 Boss DC)!',
          grantsWorldFlag: 'neural_ward_active',
          reducesBossDc: 2,
        },
      ],
      nextNodeSuccess: 'node-7',
      nextNodeFail: 'node-7',
    },

    'node-6b': {
      id: 'node-6b',
      stageNumber: 6,
      act: 2,
      title: 'The Mind-Flayer Conclave',
      subtitle: 'Act II · Stage 6B · Psychic Ambush in the Lower Crypt',
      hazardBadge: '⚠️ LOWER PATH · PSIONIC THRALL AMBUSH',
      prose:
        'Driven through the shattered floor of the mirror gallery, your party drops into a subterranean astral crypt where three Star-Spawn Mind-Weavers unleash a crossfire of psionic lances!',
      narrativeEcho: {
        fromFail:
          'Because the mirror clones held the upper gallery, you dropped straight into the Mind-Flayer Conclave!',
      },
      focalArt: 'mind-flayer-conclave',
      choices: [
        {
          id: 'vb-6b-arcana',
          title: 'Reflect the Psionic Mind-Blast',
          description:
            'Erect a prismatic mental mirror to bounce their telepathic assault back into the conclave.',
          attribute: 'arcana',
          dc: 14,
          tags: ['combat', 'hazard'],
          failPenaltyText: 'Psionic lances sear your synapses (-3 HP).',
          failHpDamage: 3,
          successBonusText: 'Their own mind-blast stuns all three Star-Spawn weavers!',
        },
        {
          id: 'vb-6b-might',
          title: 'Charge & Cleave the Lead Mind-Weaver',
          description:
            'Power through the gravity-well aura to break the leader’s concentration.',
          attribute: 'might',
          dc: 14,
          tags: ['combat'],
          failPenaltyText: 'Telekinetic shockwaves batter your chest (-3 HP).',
          failHpDamage: 3,
          successBonusText: 'One decisive strike scatters the entire conclave!',
        },
        {
          id: 'vb-6b-finesse',
          title: 'Blind-Side Blitz from the Astral Shadows',
          description:
            'Blink between pillar shadows to sever their floating psychic focuses.',
          attribute: 'finesse',
          dc: 13,
          tags: ['combat'],
          failPenaltyText: 'A void-tentacle whips across your arm (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'You shatter their floating crystal focuses in a blur of steel!',
        },
      ],
      nextNodeSuccess: 'node-7',
      nextNodeFail: 'node-7',
    },

    'node-7': {
      id: 'node-7',
      stageNumber: 7,
      act: 2,
      title: 'Sanctuary Shrine — The Event-Horizon Anchor',
      subtitle: 'Act II · Stage 7 · Bubble of Frozen Golden Time',
      hazardBadge: '✨ SANCTUARY SHRINE · GHOSTS REVIVE TO 4 HP',
      prose:
        'Suspended midway up the Voidspire floats a tranquil sphere of frozen golden time anchored by an ancient Chronos Sundial. Inside this bubble, entropy cannot touch you. All Spectral Ghosts in your party are rewound into living flesh at 4 HP!',
      narrativeEcho: {
        fromSuccess:
          'Protected by the Chronos Archive’s Neural Ward, your party steps peacefully into the golden time-bubble.',
        fromFail:
          'Escaping the Mind-Flayer Conclave, you dive through the golden membrane where time and pain stand still.',
      },
      focalArt: 'event-horizon-shrine',
      isSanctuary: true,
      choices: [
        {
          id: 'vb-7-rewind',
          title: 'Rewind Your Wounds at the Sundial',
          description:
            'Turn the golden sundial needle backward to reverse recent injuries (+3 HP restored).',
          attribute: 'arcana',
          dc: 8,
          tags: ['sanctuary'],
          failPenaltyText: 'Time ripples gently around you (0 HP lost).',
          failHpDamage: 0,
          successBonusText: 'Golden chronos-light rewinds your wounds (+3 HP restored)!',
          healOnSuccess: 3,
        },
        {
          id: 'vb-7-phase',
          title: 'Imbue Weapons with Astral Phase-Edge',
          description:
            'Dip your weapons into the event-horizon halo (+1 bonus on all rolls for the rest of the run & +2 HP).',
          attribute: 'might',
          dc: 9,
          tags: ['sanctuary'],
          failPenaltyText: 'Your blade hums softly without harm (0 HP lost).',
          failHpDamage: 0,
          successBonusText: 'Your weapons gleam with reality-cutting astral light (+1 Roll Bonus & +2 HP)!',
          healOnSuccess: 2,
          grantsWorldFlag: 'weapons_consecrated',
        },
        {
          id: 'vb-7-chart',
          title: 'Chart the Inverted Spire Currents',
          description:
            'Observe the frozen lightning patterns outside the bubble to lower Threat Level and heal +2 HP.',
          attribute: 'finesse',
          dc: 8,
          tags: ['sanctuary'],
          failPenaltyText: 'The nebula shifts, but you rest safely (0 HP lost).',
          failHpDamage: 0,
          successBonusText: 'You map the safest gravity rings ahead (+2 HP restored)!',
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
      title: 'The Inverted Spire Ascent',
      subtitle: 'Act II · Stage 8 · Vertical Debris Rings & Void-Lightning',
      hazardBadge: '⚡ VOID-LIGHTNING GRAVITY RINGS',
      prose:
        'Above the time-bubble, the central tower of Voidspire Bastion has shattered into a vertical vortex of spinning stone rings. Your party must leap upward from ring to ring through shifting gravity portals while purple void-lightning arcs across the chasm!',
      narrativeEcho: {
        fromSuccess:
          'Refreshed by the Event-Horizon Anchor, your party launches upward into the spinning gravity rings!',
      },
      focalArt: 'inverted-spire',
      choices: [
        {
          id: 'vb-8-finesse',
          title: 'Chain-Leap Through the Gravity Portals',
          description:
            'Dive through the glowing blue portal rings to slingshot past the lightning arcs.',
          attribute: 'finesse',
          dc: 13,
          tags: ['chasm', 'hazard'],
          failPenaltyText: 'A forked bolt of void-lightning singes your cloak (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'You slingshot through three portals in a single aerial arc!',
        },
        {
          id: 'vb-8-arcana',
          title: 'Ground the Void-Lightning into Your Staff',
          description:
            'Absorb the purple lightning discharge and redirect it to propel the party upward.',
          attribute: 'arcana',
          dc: 13,
          tags: ['hazard'],
          failPenaltyText: 'Overloaded astral current numbs your fingers (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'You ride the lightning current straight to the apex platform!',
        },
        {
          id: 'vb-8-might',
          title: 'Hurl Debris Anchors to Bridge the Rings',
          description:
            'Drive tethered iron spears into the spinning stone rings to haul everyone up.',
          attribute: 'might',
          dc: 14,
          tags: ['chasm'],
          failPenaltyText: 'Centrifugal pull strains your shoulders (-3 HP).',
          failHpDamage: 3,
          successBonusText: 'You anchor the spinning rings into a stable climbing ladder!',
        },
      ],
      nextNodeSuccess: 'node-9',
      nextNodeFail: 'node-9',
    },

    'node-9': {
      id: 'node-9',
      stageNumber: 9,
      act: 3,
      title: 'The Glyph-Lock Singularity',
      subtitle: 'Act III · Stage 9 · Rotating Star-Rune Seal of the Apex',
      hazardBadge: '🎯 CRUCIAL DARTBOARD CHECK · CONSTELLATION SEQUENCE',
      prose:
        'Sealing the Apex of Xal’Vorith is a spinning wheel oftwenty glowing star-runes orbiting a miniature black hole. To unlock the seal and sever the Mind-Tyrant’s outer monoliths, a player must hit the constellation target on the Dartboard!',
      narrativeEcho: {
        fromSuccess:
          'Landing on the apex ring in perfect sync, you confront the Glyph-Lock Singularity before its rotation speeds up.',
        fromFail:
          'Singed by void-lightning on the ascent, you scramble onto the apex ring before the rotating star-seal.',
      },
      focalArt: 'glyph-singularity',
      crucialSkillCheck: {
        kind: 'darts',
        title: 'Crucial Lounge Dartboard Check: Strike the Constellation Rune Seal',
        instruction:
          'Step up to the VR Lounge Dartboard and hit any scoring sector or Bullseye (or roll the Couch Fallback D20) to strike the rotating star-rune constellation in sequence!',
        targetDescription: 'Hit a scoring sector / Bullseye on the Lounge Dartboard (or Roll D20 ≥ DC 14)',
        fallbackDc: 14,
        successRewardText:
          'CONSTELLATION ALIGNED! Your dart strikes the exact star-rune—the Glyph-Lock Singularity parts and exposes the Astral Tether!',
        failPenaltyText:
          'The rune wheel misfires—a gravitational shockwave lashes across the platform (-2 HP)!',
        failHpPenalty: 2,
        grantsWorldFlag: 'constellation_seal_broken',
        exposesBossWeakness: true,
      },
      choices: [
        {
          id: 'vb-9-finesse',
          title: 'Snipe the Spinning Zenith Rune',
          description:
            'Time the wheel’s orbit and strike the twentieth star-glyph at its zenith.',
          attribute: 'finesse',
          dc: 13,
          tags: ['lock', 'riddle'],
          failPenaltyText: 'Gravitational shear grazes your arm (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'Bullseye! The star-rune flares gold and unseals the apex!',
        },
        {
          id: 'vb-9-arcana',
          title: 'Decode the Constellation Harmonic',
          description:
            'Project twin beams of starlight to lock the rotating rune-wheel in place.',
          attribute: 'arcana',
          dc: 13,
          tags: ['lock', 'riddle'],
          failPenaltyText: 'Singularity radiation stings your eyes (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'The twenty star-runes chime in unison and the seal dissolves!',
        },
        {
          id: 'vb-9-might',
          title: 'Wedge the Outer Orichalcum Ring',
          description:
            'Jam your weapon into the wheel’s outer gear-track to halt its rotation by force.',
          attribute: 'might',
          dc: 14,
          tags: ['lock'],
          failPenaltyText: 'Crushing torque wrenches your wrists (-3 HP).',
          failHpDamage: 3,
          successBonusText: 'You muscle the rune-wheel to a dead stop on the open glyph!',
        },
      ],
      nextNodeSuccess: 'node-10a',
      nextNodeFail: 'node-10b',
      nextNodeCritical: 'node-10a',
      criticalGrantsFlag: 'constellation_seal_broken',
    },

    'node-10a': {
      id: 'node-10a',
      stageNumber: 10,
      act: 3,
      title: 'Severing the Astral Tether',
      subtitle: 'Act III · Stage 10A · Shattering the Psychic Monoliths',
      hazardBadge: '✨ UPPER PATH · TETHER SEVERED (-2 BOSS DC)',
      prose:
        'Because the Constellation Seal opened cleanly, your party reaches the upper ring of three Psychic Monoliths feeding Xal’Vorith’s barrier! Destroying them now will strip the Mind-Tyrant’s shields before the final clash.',
      narrativeEcho: {
        fromSuccess:
          'Unlocking the constellation seal granted you direct access to Xal’Vorith’s unguarded Psychic Monoliths!',
        flags: {
          void_compass_attuned:
            'Void Compass Lock: The compass reveals which monolith holds the primary dimensional anchor!',
        },
      },
      focalArt: 'astral-tether',
      choices: [
        {
          id: 'vb-10a-might',
          title: 'Shatter the Central Psychic Monolith',
          description:
            'Cleave the floating black-crystal obelisk in two to sever Xal’Vorith’s power conduit.',
          attribute: 'might',
          dc: 12,
          tags: ['combat'],
          failPenaltyText: 'Psionic crystal shards nick your hands (-1 HP).',
          failHpDamage: 1,
          successBonusText:
            'The central monolith explodes—Xal’Vorith’s Boss DC drops by 2!',
          grantsWorldFlag: 'astral_tether_severed',
          reducesBossDc: 2,
        },
        {
          id: 'vb-10a-arcana',
          title: 'Invert the Monolith Siphon',
          description:
            'Turn the psychic conduit backward to heal your party (+2 HP) and drain the boss (-2 Boss DC).',
          attribute: 'arcana',
          dc: 12,
          tags: ['riddle'],
          failPenaltyText: 'Astral feedback tingles (-1 HP).',
          failHpDamage: 1,
          successBonusText: 'You siphon the monolith’s energy (+2 HP healed & -2 Boss DC)!',
          healOnSuccess: 2,
          grantsWorldFlag: 'astral_tether_severed',
          reducesBossDc: 2,
        },
        {
          id: 'vb-10a-finesse',
          title: 'Detonate the Tether Anchor-Pins',
          description:
            'Precision-strike the three levitation crystals holding the monoliths over the spire.',
          attribute: 'finesse',
          dc: 12,
          tags: ['trap'],
          failPenaltyText: 'A snapping tether-beam grazes your cloak (-1 HP).',
          failHpDamage: 1,
          successBonusText: 'All three monoliths tumble into the void (-2 Boss DC)!',
          grantsWorldFlag: 'astral_tether_severed',
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
      title: 'Reality Collapse',
      subtitle: 'Act III · Stage 10B · Warping Spatial Rift Gauntlet',
      hazardBadge: '⚠️ LOWER PATH · TEARING SPACE-TIME RIFTS',
      prose:
        'Triggered by the glyph misfire, space-time fractures across the lower approach! Jagged purple rifts open in mid-air while gravity waves threaten to pull your party into the howling void between stars.',
      narrativeEcho: {
        fromFail:
          'Because the Glyph-Lock Singularity misfired, the approach to the apex twists into a collapsing reality rift!',
      },
      focalArt: 'reality-collapse',
      choices: [
        {
          id: 'vb-10b-arcana',
          title: 'Stitch the Spatial Tear with Runes',
          description:
            'Project a lattice of Euclidean geometry to hold the crumbling causeway together.',
          attribute: 'arcana',
          dc: 14,
          tags: ['hazard', 'trap'],
          failPenaltyText: 'Void-shear slices across your aura (-3 HP).',
          failHpDamage: 3,
          successBonusText: 'Your geometric runes stabilizes a bridge across the rift!',
        },
        {
          id: 'vb-10b-finesse',
          title: 'Blink-Dash Between the Closing Rifts',
          description:
            'Sprint across the vanishing marble tiles before they phase out of existence.',
          attribute: 'finesse',
          dc: 14,
          tags: ['chasm', 'hazard'],
          failPenaltyText: 'A closing dimensional seam clips your heel (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'You clear the collapsing tiles with a half-second to spare!',
        },
        {
          id: 'vb-10b-might',
          title: 'Chain the Party Together & Power Through',
          description:
            'Lash the squad to your waist-chain and haul everyone through the gravity gale.',
          attribute: 'might',
          dc: 14,
          tags: ['chasm', 'hazard'],
          failPenaltyText: 'Crushing tidal gravity bruises your torso (-3 HP).',
          failHpDamage: 3,
          successBonusText: 'No one is lost to the void as you drag the party onto the apex!',
        },
      ],
      nextNodeSuccess: 'node-11',
      nextNodeFail: 'node-11',
    },

    'node-11': {
      id: 'node-11',
      stageNumber: 11,
      act: 3,
      title: "Apex of Xal'Vorith",
      subtitle: 'Act III · Stage 11 · The Eldritch Mind-Tyrant Descends',
      hazardBadge: '👁️ BOSS PHASE I · ILLUSORY DC SCRAMBLE',
      prose:
        'From a jagged tear in the cosmos descends Xal’Vorith, the Eldritch Mind-Tyrant—a crowned entity of starlit tentacles and three orbiting eyes. Its telepathic voice whispers false numbers into your minds, scrambling the apparent DCs on your cards unless countered by **Arcane Sight** or the **Neural Ward**!',
      narrativeEcho: {
        fromSuccess:
          'With its Psychic Monoliths shattered, Xal’Vorith descends in fury—its outer shield already gone!',
        fromFail:
          'Scrambling out of the collapsing rift, you confront Xal’Vorith as its psychic illusions warp the arena!',
        flags: {
          neural_ward_active:
            'Neural Ward Shielding: The Chronos Archive ward blocks Xal’Vorith’s telepathic scramble—all true DCs remain crystal clear!',
          astral_tether_severed:
            'Severed Tether: Without its monoliths, Xal’Vorith’s levitation ring flickers and falters!',
        },
      },
      focalArt: 'apex-xalvorith',
      scramblesDisplayedDc: true,
      choices: [
        {
          id: 'vb-11-arcana',
          title: 'Shatter the Mind-Tyrant’s Psychic Crown',
          description:
            'Fire a concentrated lance of counter-psionic light straight into Xal’Vorith’s central eye.',
          attribute: 'arcana',
          dc: 14,
          tags: ['combat', 'boss', 'riddle'],
          failPenaltyText: 'Mind-shattering whispers sear your cortex (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'Xal’Vorith’s psychic crown cracks wide open!',
          reducesBossDc: 1,
        },
        {
          id: 'vb-11-finesse',
          title: 'Sever the Orbiting Eye-Tendrils',
          description:
            'Use zero-G acrobatics to slice the two flanking ocular tentacles projecting its illusions.',
          attribute: 'finesse',
          dc: 14,
          tags: ['combat', 'boss'],
          failPenaltyText: 'A gravity-whip tentacle slams your flank (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'Both flanking eye-tendrils are severed—ending its illusions!',
          reducesBossDc: 1,
        },
        {
          id: 'vb-11-might',
          title: 'Pin the Tyrant with Astral Anchor-Chains',
          description:
            'Hurl the broken dock mooring chains around Xal’Vorith’s mantle and haul it down to the stone.',
          attribute: 'might',
          dc: 14,
          tags: ['combat', 'boss'],
          failPenaltyText: ' Crushing telekinetic waves drive you back (-3 HP).',
          failHpDamage: 3,
          successBonusText: 'You drag the floating Mind-Tyrant down onto the marble altar!',
          reducesBossDc: 1,
        },
      ],
      nextNodeSuccess: 'node-12',
      nextNodeFail: 'node-12',
      nextNodeCritical: 'node-12',
      criticalGrantsFlag: 'xalvorith_grounded',
    },

    'node-12': {
      id: 'node-12',
      stageNumber: 12,
      act: 3,
      title: 'Finale — The Eldritch Mind-Tyrant',
      subtitle: "Act III · Stage 12 · Banishing Xal'Vorith Through the Singularity",
      hazardBadge: '🎲 CRUCIAL FINALE CHECK · BANISH THE MIND-TYRANT',
      prose:
        'Pinned before the collapsing cosmic tear, Xal’Vorith opens its abyssal maw to cast *Reality Unmaking*! Behind the entity spins the unstable Singularity Core. One final, unified strike will drive Xal’Vorith back through the dimensional rift and seal Voidspire Bastion forever!',
      narrativeEcho: {
        fromSuccess:
          'Grounded and stripped of its psychic illusions, Xal’Vorith teeters on the brink of the singularity!',
        fromFail:
          'As stars fracture overhead, your party rallies for one final all-or-nothing strike against the Mind-Tyrant!',
        flags: {
          void_compass_attuned:
            'Void Compass Lock: The compass projects a golden banishment vector straight into the singularity!',
          neural_ward_active:
            'Unclouded Minds: Protected by the Neural Ward, your party strikes in flawless telepathic unison!',
        },
      },
      focalArt: 'mind-tyrant-finale',
      isFinale: true,
      crucialSkillCheck: {
        kind: 'wrist-d20',
        title: "Crucial Finale Check: Banish Xal'Vorith into the Singularity!",
        instruction:
          "Roll the High-Stakes Finale D20 from your Wrist HUD, /mobile companion, or Cinema Screen (or hit the Dartboard / Putting Strip) to banish Xal'Vorith through the collapsing singularity!",
        targetDescription: 'Roll High-Stakes D20 ≥ DC 13 (reduced by Boss Weaknesses)',
        fallbackDc: 13,
        successRewardText:
          "COSMIC TRIUMPH! Your strike hurls Xal'Vorith into the collapsing singularity—the dimensional tear seals in a aurora of golden starlight!",
        failPenaltyText:
          'Reality Unmaking ripples across the apex (-3 HP), forcing a desperate final stand!',
        failHpPenalty: 3,
      },
      choices: [
        {
          id: 'vb-12-arcana',
          title: 'Seal the Dimensional Singularity',
          description:
            'Collapse the astral portal behind Xal’Vorith with an unbreakable cosmic binding glyph.',
          attribute: 'arcana',
          dc: 15,
          tags: ['combat', 'boss', 'riddle'],
          failPenaltyText: 'Eldritch void-fire scorches your soul (-3 HP).',
          failHpDamage: 3,
          successBonusText: 'The singularity implodes—banishing Xal’Vorith from our universe!',
        },
        {
          id: 'vb-12-might',
          title: 'Titan-Slam the Entity into the Rift',
          description:
            'Charge across the floating altar and drive Xal’Vorith bodily into the black hole.',
          attribute: 'might',
          dc: 15,
          tags: ['combat', 'boss'],
          failPenaltyText: 'Gravitational shear tears at your armor (-3 HP).',
          failHpDamage: 3,
          successBonusText: 'Your earth-shattering charge hurls the Mind-Tyrant into the void!',
        },
        {
          id: 'vb-12-finesse',
          title: 'Pierce the Core of the Third Eye',
          description:
            'Deliver a pinpoint strike through the entity’s dimensional anchor-gem.',
          attribute: 'finesse',
          dc: 15,
          tags: ['combat', 'boss'],
          failPenaltyText: 'Lashing void-tendrils strike your chest (-3 HP).',
          failHpDamage: 3,
          successBonusText: 'The anchor-gem shatters and Xal’Vorith is sucked into the rift!',
        },
      ],
      nextNodeSuccess: 'victory',
      nextNodeFail: 'defeat',
      nextNodeCritical: 'victory',
    },
  },
}

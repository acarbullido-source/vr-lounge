import type { AdventureCampaignDefinition } from '../types'

export const FORGE_OF_THE_IRON_TITAN_CAMPAIGN: AdventureCampaignDefinition = {
  id: 'forge-of-the-iron-titan',
  title: 'Forge of the Iron Titan',
  subtitle: 'Subterranean Caldera of Ignis-Prime',
  themeSummary:
    'Plunge into a volcanic dwarf-foundry of fractured obsidian bridges, scalding steam-valve labyrinths, and relentless clockwork automata to cool and shatter the 100-foot Molten Colossus, Ignis-Prime.',
  accentColor: '#F97316',
  secondaryColor: '#DC2626',
  startNodeId: 'node-1',
  bossName: 'Ignis-Prime, the Iron Titan',
  nodes: {
    'node-1': {
      id: 'node-1',
      stageNumber: 1,
      act: 1,
      title: 'The Basalt Lift Descent',
      subtitle: 'Act I · Stage 1 · Runaway Foundry Chain-Elevator',
      hazardBadge: '🔥 RUNAWAY MAGMA LIFT',
      prose:
        'Your iron cage-elevator plummets down a vertical volcanic shaft toward a churning sea of magma! Overhead, brass clockwork saw-drones cling to the anchor chains, showering white-hot sparks as they sever the main brake cables one by one.',
      narrativeEcho: {
        fromSuccess:
          'Heat roars up from the caldera below as your party braces on the plunging basalt lift platform.',
      },
      focalArt: 'basalt-lift',
      choices: [
        {
          id: 'it-1-might',
          title: 'Engage the Emergency Iron Brake-Levers',
          description:
            'Throw your full weight against the red-hot manual caliper levers to clamp the guide rails.',
          attribute: 'might',
          dc: 12,
          tags: ['hazard'],
          failPenaltyText: 'Searing friction sparks burn your forearms (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'Iron shoes bite into the basalt rail, slowing the lift to a controlled glide!',
        },
        {
          id: 'it-1-finesse',
          title: 'Snipe the Clockwork Saw-Drones',
          description:
            'Pick off the brass drones chewing through the suspension links before the last cable snaps.',
          attribute: 'finesse',
          dc: 12,
          tags: ['combat', 'trap'],
          failPenaltyText: 'A falling brass rotor clips your shoulder (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'Two saw-drones explode in mid-air, saving the main lift chain!',
        },
        {
          id: 'it-1-arcana',
          title: 'Cast Feather-Levitation on the Platform',
          description:
            'Inscribe an anti-gravity sigil across the iron floor grates to cushion the landing.',
          attribute: 'arcana',
          dc: 11,
          tags: ['hazard'],
          failPenaltyText: 'Volcanic sulfur fumes disrupt your incantation (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'Violet runes flare beneath the lift, arresting its fall inches above the lava dock!',
          grantsWorldFlag: 'drone_core_salvaged',
        },
      ],
      nextNodeSuccess: 'node-2',
      nextNodeFail: 'node-2',
      criticalGrantsFlag: 'drone_core_salvaged',
    },

    'node-2': {
      id: 'node-2',
      stageNumber: 2,
      act: 1,
      title: 'The Obsidian Span',
      subtitle: 'Act I · Stage 2 · Fracturing Lava Bridge Hazard',
      hazardBadge: '🌋 TECTONIC LAVA BRIDGE',
      prose:
        'A razor-thin bridge of black volcanic glass arches over a bubbling river of white-hot magma. As your party reaches mid-span, a violent tectonic tremor cracks the central keystone, opening a fifteen-foot gap over the inferno!',
      narrativeEcho: {
        fromSuccess:
          'Stepping off the stabilized lift platform, you sprint onto the Obsidian Span before the tremors peak.',
        fromFail:
          'After a bone-jarring crash landing at the dock, you scramble onto the shaking Obsidian Span.',
        flags: {
          drone_core_salvaged:
            'Salvaged Drone Core: The clockwork gyro-compass warns you three seconds before the keystone fractures!',
        },
      },
      focalArt: 'obsidian-span',
      choices: [
        {
          id: 'it-2-finesse',
          title: 'Vault the Cracking Keystone Gap',
          description:
            'Sprint up the tilting obsidian arch (or use a Grappling Hook / Blink Crystal) to clear the magma chasm.',
          attribute: 'finesse',
          dc: 12,
          tags: ['chasm', 'hazard'],
          failPenaltyText: 'Blistering magma updrafts scorch your cloak (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'You clear the widening fissure and land on the Artificer’s terrace!',
        },
        {
          id: 'it-2-might',
          title: 'Hurl a Basalt Pillar Across the Breach',
          description:
            'Topple a carved dwarf-statue across the gap to improvise a bridge for the squad.',
          attribute: 'might',
          dc: 13,
          tags: ['chasm'],
          failPenaltyText: 'Sharp volcanic glass slices your gauntlets (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'The basalt statue slams across the gap, forming a solid walkway!',
        },
        {
          id: 'it-2-arcana',
          title: 'Cool a Magma Stepping-Crust',
          description:
            'Project a cone of frost downward to solidify floating crust-islands across the lava.',
          attribute: 'arcana',
          dc: 12,
          tags: ['chasm', 'hazard'],
          failPenaltyText: 'Radiant heat flare singes your brows (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'Black basalt crust hardens instantly beneath your boots!',
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
      title: "The Master Artificer's Armory",
      subtitle: 'Act I · Stage 3A · High Vault of Cryo-Engineering',
      hazardBadge: '✨ UPPER PATH · ARTIFICER VAULT',
      prose:
        'Crossing the intact upper arch brings you into the Master Artificer’s sealed workshop. Racks of pressurized frost-steel canisters gleam beside schematics showing how to flash-freeze Ignis-Prime’s molten breastplate.',
      narrativeEcho: {
        fromSuccess:
          'Because your party cleared the Obsidian Span before it collapsed, you reach the upper Artificer’s Armory!',
      },
      focalArt: 'artificer-armory',
      choices: [
        {
          id: 'it-3a-finesse',
          title: 'Unlock the Cryo-Coolant Rack',
          description:
            'Pick the brass combination lock securing the pressurized liquid-nitrogen canisters.',
          attribute: 'finesse',
          dc: 11,
          tags: ['lock'],
          failPenaltyText: 'Frost-vapor nips your fingers (-1 HP).',
          failHpDamage: 1,
          successBonusText:
            'You secure the Cryo-Coolant Canister—weakening Ignis-Prime’s armor in the finale!',
          grantsWorldFlag: 'cryo_coolant_canister',
          reducesBossDc: 1,
        },
        {
          id: 'it-3a-arcana',
          title: 'Attune the Thermal Ward-Lenses',
          description:
            'Infuse the artificer’s goggles and shields with heat-absorption runes (+1 HP healed).',
          attribute: 'arcana',
          dc: 11,
          tags: ['riddle'],
          failPenaltyText: 'A static spark snaps from the workbench (-1 HP).',
          failHpDamage: 1,
          successBonusText: 'Cooling runes hum across your armor (+1 HP & Cryo Canister secured)!',
          healOnSuccess: 1,
          grantsWorldFlag: 'cryo_coolant_canister',
        },
        {
          id: 'it-3a-might',
          title: 'Shoulder the Heavy Frost-Mortar',
          description:
            'Pry the mounted cryo-Repeating canister off its bolted iron tripod.',
          attribute: 'might',
          dc: 12,
          tags: ['lock'],
          failPenaltyText: 'The heavy tripod bruised your forearm (-1 HP).',
          failHpDamage: 1,
          successBonusText: 'You rip the entire Cryo-Coolant assembly free for the boss fight!',
          grantsWorldFlag: 'cryo_coolant_canister',
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
      title: 'The Slag-Pit Conveyor',
      subtitle: 'Act I · Stage 3B · Crushing Smelter Pistons',
      hazardBadge: '⚠️ LOWER PATH · SMELTING CONVEYOR',
      prose:
        'Sliding down the fractured bridge abutment, your party lands on a clanking iron ore-conveyor belt! Ahead, rhythmic fifty-ton stamping pistons slam down onto glowing slag heaps every three seconds.',
      narrativeEcho: {
        fromFail:
          'When the Obsidian Span gave way, you dropped onto the roaring lower Slag-Pit Conveyor!',
      },
      focalArt: 'slag-conveyor',
      choices: [
        {
          id: 'it-3b-finesse',
          title: 'Dive Through the Piston Timing Window',
          description:
            'Roll across the iron belt in the split-second gap as the stamping hammers rise.',
          attribute: 'finesse',
          dc: 13,
          tags: ['trap', 'hazard'],
          failPenaltyText: 'Shockwaves and flying slag sear your legs (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'You somersault clear of the stamping hammers onto the catwalk!',
        },
        {
          id: 'it-3b-might',
          title: 'Jam an Ore-Cart into the Drive Chain',
          description:
            'Tip a loaded iron crucible-cart into the conveyor’s master sprocket to halt the belt.',
          attribute: 'might',
          dc: 13,
          tags: ['hazard'],
          failPenaltyText: 'Shattering gear teeth ricochet across your chest (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'The master sprocket shears in half and the conveyor grinds to a halt!',
        },
        {
          id: 'it-3b-arcana',
          title: 'Warp the Piston Hydraulic Lines',
          description:
            'Blast the copper oil-pipes feeding the overhead stamping hammers.',
          attribute: 'arcana',
          dc: 13,
          tags: ['trap'],
          failPenaltyText: 'Hot hydraulic mist sprays your gauntlets (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'The stamping pistons freeze mid-stroke in a cloud of smoke!',
        },
      ],
      nextNodeSuccess: 'node-4',
      nextNodeFail: 'node-4',
    },

    'node-4': {
      id: 'node-4',
      stageNumber: 4,
      act: 1,
      title: 'The Scalding Labyrinth',
      subtitle: 'Act I · Stage 4 · Superheated Steam-Valve Traps',
      hazardBadge: '🎯 CRUCIAL DARTBOARD CHECK · SHOOT THE STEAM VALVES',
      prose:
        'A maze of ruptured copper manifolds fills the corridor with blinding, superheated steam. Across the grating, three red-hot release valves spin out of control—only a dead-eye ranged strike can knock their latches shut before the corridor cooks!',
      narrativeEcho: {
        fromSuccess:
          'Advancing from the Artificer’s Armory with frost-warded gear, you enter the Scalding Labyrinth.',
        fromFail:
          'Scrambling off the Slag-Pit Conveyor, you are immediately enveloped by the labyrinth’s roaring steam vents.',
        flags: {
          cryo_coolant_canister:
            'Cryo-Coolant Ready: Your frost canister condenses the nearest steam cloud, clearing your line of sight!',
        },
      },
      focalArt: 'steam-labyrinth',
      crucialSkillCheck: {
        kind: 'darts',
        title: 'Crucial Lounge Dartboard Check: Shoot the High-Pressure Valves',
        instruction:
          'Throw a dart on the VR Lounge Dartboard and hit any scoring segment (or roll the Couch Fallback D20) to knock the distant high-pressure release valves shut!',
        targetDescription: 'Hit a scoring segment on the Lounge Dartboard (or Roll D20 ≥ DC 14)',
        fallbackDc: 14,
        successRewardText:
          'CLANG! Your shot rings off the brass latch, slamming the main steam manifold shut!',
        failPenaltyText:
          'The shot ricochets wide—scalding steam erupts through the floor grates (-2 HP)!',
        failHpPenalty: 2,
        grantsWorldFlag: 'steam_pressure_vented',
      },
      choices: [
        {
          id: 'it-4-finesse',
          title: 'Ricochet a Shot off the Brass Elbow',
          description:
            'Bank a projectile off the curved boiler pipe to trip the recessed cutoff lever.',
          attribute: 'finesse',
          dc: 12,
          tags: ['trap', 'hazard'],
          failPenaltyText: 'A jet of white steam blisters your arms (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'The cutoff lever snaps down and the steam vents hiss silent!',
        },
        {
          id: 'it-4-might',
          title: 'Crimp the Ruptured Copper Pipe by Hand',
          description:
            'Wrap your cloak around the split manifold and hammer the copper seam flat.',
          attribute: 'might',
          dc: 13,
          tags: ['hazard'],
          failPenaltyText: 'Boiling condensation scalds your shoulders (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'You bend the heavy copper pipe shut through sheer brute force!',
        },
        {
          id: 'it-4-arcana',
          title: 'Condense the Steam into Cool Rain',
          description:
            'Weave an endothermic vortex down the corridor to drop the temperature by two hundred degrees.',
          attribute: 'arcana',
          dc: 12,
          tags: ['trap', 'hazard'],
          failPenaltyText: 'Thermal backlash singes your collar (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'The scalding fog precipitates into a refreshing cool drizzle!',
        },
      ],
      nextNodeSuccess: 'node-5',
      nextNodeFail: 'node-5',
      criticalGrantsFlag: 'steam_pressure_vented',
    },

    'node-5': {
      id: 'node-5',
      stageNumber: 5,
      act: 2,
      title: 'March of the Clockwork Golems',
      subtitle: 'Act II · Stage 5 · Turbine Hall Automaton Phalanx',
      hazardBadge: '⚙️ SPINNING SAW-ARM AUTOMATA',
      prose:
        'In the cavernous Turbine Hall, a squad of brass-and-iron Clockwork Golems detaches from the overhead charging rails. Their chest furnaces roar orange as whirling buzz-saw arms spin up to three thousand RPM, locking down the bridge to the Cryo-Deck.',
      narrativeEcho: {
        fromSuccess:
          'With the steam vents shut off behind you, you spot the Clockwork Golems before their turbines reach full speed.',
        fromFail:
          'Stumbling out of the scalding steam, you come face-to-face with a spinning wall of brass saw-blades!',
      },
      focalArt: 'clockwork-golems',
      choices: [
        {
          id: 'it-5-might',
          title: 'Smash Their Mainspring Chest-Cores',
          description:
            'Drive heavy blows straight into their glass furnace viewports to shatter their clockwork gears.',
          attribute: 'might',
          dc: 13,
          tags: ['combat'],
          failPenaltyText: 'A whirling buzz-saw grazes your vambrace (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'Coiled mainsprings burst out of their chests in a shower of brass gears!',
        },
        {
          id: 'it-5-finesse',
          title: 'Jam Iron Spikes into Their Knee Ratchets',
          description:
            'Slide beneath their horizontal saw sweeps to lock their leg actuators.',
          attribute: 'finesse',
          dc: 13,
          tags: ['combat', 'trap'],
          failPenaltyText: 'A piston-kick sends you skidding across the iron floor (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'The lead golems topple domino-style into the turbine pit!',
        },
        {
          id: 'it-5-arcana',
          title: 'Magnetize the Turbine Floor Plates',
          description:
            'Reverse the electromagnetic polarity of the hall floor to weld the iron golems in place.',
          attribute: 'arcana',
          dc: 13,
          tags: ['combat'],
          failPenaltyText: 'Arc-lightning jumps from a golem’s chassis (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'All four Clockwork Golems slam flat against the magnetized floor!',
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
      title: 'The Cryo-Conduit Control Deck',
      subtitle: 'Act II · Stage 6A · Rerouting the Nitrogen Flood-Pipes',
      hazardBadge: '✨ UPPER PATH · CRYO-DECK CONTROL (-1 BOSS DC)',
      prose:
        'Having dismantled the Clockwork Golems cleanly, your party captures the elevated Cryo-Conduit Control Deck! Frost-covered brass levers overlook the central caldera where Ignis-Prime slumbers in molten rock.',
      narrativeEcho: {
        fromSuccess:
          'Your decisive victory in the Turbine Hall gave you full control of the Cryo-Conduit Control Deck!',
      },
      focalArt: 'cryo-conduit',
      choices: [
        {
          id: 'it-6a-arcana',
          title: 'Reroute Liquid Nitrogen to the Boss Caldera',
          description:
            'Align the rune-valves to flood the Titan’s awakening chamber with sub-zero coolant.',
          attribute: 'arcana',
          dc: 12,
          tags: ['riddle'],
          failPenaltyText: 'Sub-zero frostbite stings your hands (-1 HP).',
          failHpDamage: 1,
          successBonusText:
            'White frost coats the central caldera—Ignis-Prime’s arena is cooled (-1 Boss DC)!',
          grantsWorldFlag: 'arena_cooled',
          reducesBossDc: 1,
        },
        {
          id: 'it-6a-finesse',
          title: 'Splice the Coolant Override Wires',
          description:
            'Hot-wire the master console so the cryo-jets fire continuously during the final battle.',
          attribute: 'finesse',
          dc: 12,
          tags: ['lock'],
          failPenaltyText: 'A console fuse pops in your face (-1 HP).',
          failHpDamage: 1,
          successBonusText: 'Cryo-jets lock online—arena cooled (-1 Boss DC)!',
          grantsWorldFlag: 'arena_cooled',
          reducesBossDc: 1,
        },
        {
          id: 'it-6a-might',
          title: 'Force the Master Cryo-Floodgate Wheel',
          description:
            'Break the iron padlock and spin the main coolant floodgate to maximum flow.',
          attribute: 'might',
          dc: 12,
          tags: ['lock'],
          failPenaltyText: 'Rime-ice scrapes your knuckles (-1 HP).',
          failHpDamage: 1,
          successBonusText: 'Tons of coolant roar toward the caldera—arena cooled!',
          grantsWorldFlag: 'arena_cooled',
        },
      ],
      nextNodeSuccess: 'node-7',
      nextNodeFail: 'node-7',
    },

    'node-6b': {
      id: 'node-6b',
      stageNumber: 6,
      act: 2,
      title: 'The Molten Spillway',
      subtitle: 'Act II · Stage 6B · Sinking Crust Plates Over Lava',
      hazardBadge: '⚠️ LOWER PATH · SINKING MAGMA CRUST',
      prose:
        'Driven off the Turbine Hall catwalk by the golems, your party must sprint across the Molten Spillway—a treacherous expanse of floating black rock slabs that slowly sink into white-hot magma under your weight!',
      narrativeEcho: {
        fromFail:
          'Because the Clockwork Golems held the upper deck, you are forced across the sinking crust of the Molten Spillway!',
      },
      focalArt: 'molten-spillway',
      choices: [
        {
          id: 'it-6b-finesse',
          title: 'Sprint Across the Bobbing Basalt Slabs',
          description:
            'Leap from crust-plate to crust-plate before any slab submerges beneath the lava.',
          attribute: 'finesse',
          dc: 14,
          tags: ['chasm', 'hazard'],
          failPenaltyText: 'Lava splatter sears your greaves as a slab tilts (-3 HP).',
          failHpDamage: 3,
          successBonusText: 'You bound across the sinking stones with acrobatic grace!',
        },
        {
          id: 'it-6b-might',
          title: 'Pole-Vault Using an Iron Crucible Rod',
          description:
            'Plant a twenty-foot smelting rod into the spillway bed to vault the widest lava channel.',
          attribute: 'might',
          dc: 13,
          tags: ['chasm'],
          failPenaltyText: 'The glowing rod scorches your palms (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'You pole-vault over a roaring lava cascade onto solid rock!',
        },
        {
          id: 'it-6b-arcana',
          title: 'Bind the Crust Slabs with Telekinesis',
          description:
            'Hold the sinking basalt islands afloat with raw telekinetic willpower.',
          attribute: 'arcana',
          dc: 13,
          tags: ['chasm', 'hazard'],
          failPenaltyText: 'The intense heat taxes your concentration (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'Purple telekinetic chains hold the rock slabs steady!',
        },
      ],
      nextNodeSuccess: 'node-7',
      nextNodeFail: 'node-7',
    },

    'node-7': {
      id: 'node-7',
      stageNumber: 7,
      act: 2,
      title: "Sanctuary Shrine — The Hearth-Smith's Alcove",
      subtitle: 'Act II · Stage 7 · Cooled Obsidian Forge-Shrine',
      hazardBadge: '✨ SANCTUARY SHRINE · GHOSTS REVIVE TO 4 HP',
      prose:
        'Tucked inside a cooled obsidian cavern stands the sacred anvil of the First Artificer, fed by an underground glacier stream. All Spectral Ghosts in your party are reforged into living flesh at 4 HP, while living heroes can quench their burns and temper their steel!',
      narrativeEcho: {
        fromSuccess:
          'Descending from the Cryo-Deck as frost plumes fill the foundry, your party rests at the Hearth-Smith’s Alcove.',
        fromFail:
          'Scorched by the Molten Spillway, you collapse into the cool, healing mist of the Hearth-Smith’s Alcove.',
      },
      focalArt: 'hearth-shrine',
      isSanctuary: true,
      choices: [
        {
          id: 'it-7-quench',
          title: 'Bathe in the Glacier Quench-Trough',
          description:
            'Submerge your burns in the mineral-rich glacial spring to restore +3 HP.',
          attribute: 'arcana',
          dc: 8,
          tags: ['sanctuary'],
          failPenaltyText: 'The icy water takes your breath away (0 HP lost).',
          failHpDamage: 0,
          successBonusText: 'Soothing glacial mist heals your burns (+3 HP restored)!',
          healOnSuccess: 3,
        },
        {
          id: 'it-7-temper',
          title: 'Temper Weapons on the Sacred Anvil',
          description:
            'Hammer rune-fold edges onto your gear (+1 bonus on all rolls for the rest of the campaign & +2 HP).',
          attribute: 'might',
          dc: 9,
          tags: ['sanctuary'],
          failPenaltyText: 'The anvil rings loudly, leaving you unharmed (0 HP lost).',
          failHpDamage: 0,
          successBonusText: 'Your tempered weapons hum with titan-slaying resonance (+1 Roll Bonus & +2 HP)!',
          healOnSuccess: 2,
          grantsWorldFlag: 'weapons_consecrated',
        },
        {
          id: 'it-7-tune',
          title: 'Calibrate Clockwork Ward-Charms',
          description:
            'Assemble heat-shielding charms from the smithy bench to lower Threat Level and heal +2 HP.',
          attribute: 'finesse',
          dc: 8,
          tags: ['sanctuary'],
          failPenaltyText: 'A spring slips, but you rest safely (0 HP lost).',
          failHpDamage: 0,
          successBonusText: 'You craft heat-deflecting ward charms (+2 HP restored)!',
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
      title: 'The Gear-Grinder Pendulums',
      subtitle: 'Act II · Stage 8 · Interlocking 40-Foot Clockwork Gears',
      hazardBadge: '⚙️ CRUSHING GEAR GAUNTLET',
      prose:
        'To reach the Foundry Core Gate, you must traverse the interior of the Great Clockwork Drive—a narrow catwalk flanked by interlocking forty-foot brass gears and swinging axe-pendulums powered by roaring geothermal pistons.',
      narrativeEcho: {
        fromSuccess:
          'With freshly tempered gear from the Hearth-Smith’s Alcove, you step onto the trembling clockwork catwalk.',
      },
      focalArt: 'gear-pendulums',
      choices: [
        {
          id: 'it-8-finesse',
          title: 'Acrobatic Dash Through the Pendulum Arcs',
          description:
            'Time the six-beat cadence of the swinging blades and sprint through the teeth of the master gear.',
          attribute: 'finesse',
          dc: 13,
          tags: ['trap', 'chasm'],
          failPenaltyText: 'A pendulum flat slams into your hip (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'You thread all three pendulum arcs without a scratch!',
        },
        {
          id: 'it-8-arcana',
          title: 'Slow the Escapement with Chronomancy',
          description:
            'Project a temporal dilation field around the central balance-wheel to halve the pendulum speed.',
          attribute: 'arcana',
          dc: 13,
          tags: ['trap', 'riddle'],
          failPenaltyText: 'Temporal strain gives you asplitting migraine (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'Time slows to a crawl as the pendulums drift harmlessly overhead!',
        },
        {
          id: 'it-8-might',
          title: 'Parry and Wedge the Pinion Gear',
          description:
            'Jam an iron anvil-bar into the secondary pinion to stall the swinging blades.',
          attribute: 'might',
          dc: 14,
          tags: ['trap', 'hazard'],
          failPenaltyText: 'The jarring torque wrenches your wrists (-3 HP).',
          failHpDamage: 3,
          successBonusText: 'Sparks shower as the pinion gear locks solid!',
        },
      ],
      nextNodeSuccess: 'node-9',
      nextNodeFail: 'node-9',
    },

    'node-9': {
      id: 'node-9',
      stageNumber: 9,
      act: 3,
      title: 'The Foundry Core Gate',
      subtitle: 'Act III · Stage 9 · Adamantine Blast Door & Twin-Core Siege Golem',
      hazardBadge: '⛳ CRUCIAL PUTTING CHECK · RESONATOR CHUTE',
      prose:
        'Before the triple-locked adamantine blast door stands a hulking Twin-Core Siege Golem. To drop its impenetrable energy barrier and unseal the blast door, a player must roll an Arcane Resonator Sphere down the narrow calibration chute into the floor socket!',
      narrativeEcho: {
        fromSuccess:
          'Clearing the Gear-Grinder Pendulums in stride, you reach the Foundry Core Gate before the Siege Golem can charge its cannon.',
        fromFail:
          'Clipped by the clockwork pendulums, you stumble onto the Core Gate platform as the Siege Golem locks onto you.',
      },
      focalArt: 'foundry-core-gate',
      crucialSkillCheck: {
        kind: 'putting',
        title: 'Crucial Lounge Putting Check: Socket the Arcane Resonator',
        instruction:
          'Step up to the VR Lounge Putting Strip (or roll the Couch Fallback D20) to roll the Arcane Resonator Sphere down the calibration chute into the blast-door socket!',
        targetDescription: 'Sink a putt on the Lounge Putting Strip (or Roll D20 ≥ DC 14)',
        fallbackDc: 14,
        successRewardText:
          'BULLSEYE ROLL! The Resonator Sphere locks into the socket—short-circuiting the Siege Golem’s shield and unsealing the upper gantry!',
        failPenaltyText:
          'The Resonator Sphere lips out of the chute—the Siege Golem unleashes a point-blank slag cannon blast (-2 HP)!',
        failHpPenalty: 2,
        grantsWorldFlag: 'siege_golem_shorted',
        exposesBossWeakness: true,
      },
      choices: [
        {
          id: 'it-9-finesse',
          title: 'Bank the Resonator Sphere into the Socket',
          description:
            'Guide the glowing core along the brass calibration rails while dodging cannon fire.',
          attribute: 'finesse',
          dc: 13,
          tags: ['lock', 'combat'],
          failPenaltyText: 'Shrapnel from a slag shell grazes your leg (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'The resonator clicks home and the adamantine doors part!',
        },
        {
          id: 'it-9-might',
          title: 'Grapple the Siege Golem’s Cannon Arm',
          description:
            'Wrestle the golem’s barrel skyward so its blast blows open the overhead gantry.',
          attribute: 'might',
          dc: 14,
          tags: ['combat'],
          failPenaltyText: 'The superheated barrel burns your gauntlets (-3 HP).',
          failHpDamage: 3,
          successBonusText: 'You redirect the cannon shot straight into the gate lock!',
        },
        {
          id: 'it-9-arcana',
          title: 'Hack the Adamantine Rune-Lock',
          description:
            'Overload the triple-seal glyphs on the blast door while shorting the golem’s twin cores.',
          attribute: 'arcana',
          dc: 13,
          tags: ['lock', 'combat'],
          failPenaltyText: 'Arcane feedback singes your cloak (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'Both golem cores short out as the blast doors slide wide!',
        },
      ],
      nextNodeSuccess: 'node-10a',
      nextNodeFail: 'node-10b',
      nextNodeCritical: 'node-10a',
      criticalGrantsFlag: 'siege_golem_shorted',
    },

    'node-10a': {
      id: 'node-10a',
      stageNumber: 10,
      act: 3,
      title: 'Overloading the Crucible',
      subtitle: 'Act III · Stage 10A · Overhead Slag-Ladle Sabotage',
      hazardBadge: '✨ UPPER PATH · CRUCIBLE SABOTAGE (-2 BOSS DC)',
      prose:
        'Taking the upper gantry unlocked by the resonator, your party reaches the crane control cab directly above the awakening Molten Colossus! A hundred-ton ladle of cold iron flux hangs suspended over Ignis-Prime’s head.',
      narrativeEcho: {
        fromSuccess:
          'Because you socketed the Arcane Resonator cleanly, you gained the upper crane gantry above the caldera!',
        flags: {
          arena_cooled:
            'Cooled Caldera: The liquid nitrogen you rerouted in Act II has already chilled the overhead flux ladle to sub-zero temperatures!',
        },
      },
      focalArt: 'slag-crucible',
      choices: [
        {
          id: 'it-10a-might',
          title: 'Shatter the Crane Holding-Pin',
          description:
            'Sledgehammer the master kingpin to dump the hundred-ton flux ladle straight onto Ignis-Prime.',
          attribute: 'might',
          dc: 12,
          tags: ['hazard'],
          failPenaltyText: 'The snapping chain whips across the cab (-1 HP).',
          failHpDamage: 1,
          successBonusText:
            'BOOM! The giant ladle dumps onto the Titan—cracking its carapace (-2 Boss DC)!',
          grantsWorldFlag: 'boss_hp_reduced',
          reducesBossDc: 2,
        },
        {
          id: 'it-10a-finesse',
          title: 'Align the Crane Crosshairs on the Titan’s Neck',
          description:
            'Precision-steer the overhead trolley to drop the payload directly onto its dorsal exhaust vents.',
          attribute: 'finesse',
          dc: 12,
          tags: ['trap'],
          failPenaltyText: 'Hot gears nip your sleeve (-1 HP).',
          failHpDamage: 1,
          successBonusText: 'Direct hit on the dorsal vents—Ignis-Prime is severely weakened (-2 Boss DC)!',
          grantsWorldFlag: 'boss_hp_reduced',
          reducesBossDc: 2,
        },
        {
          id: 'it-10a-arcana',
          title: 'Enchant the Flux Payload with Frost-Runes',
          description:
            'Imbue the falling slag ladle with thermal-shock magic to crack the Titan’s core housing.',
          attribute: 'arcana',
          dc: 12,
          tags: ['riddle'],
          failPenaltyText: 'Frost-burn numbs your hands (-1 HP).',
          failHpDamage: 1,
          successBonusText: 'Thermal shock fractures the Titan’s chest armor (-2 Boss DC)!',
          grantsWorldFlag: 'boss_hp_reduced',
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
      title: 'Magma Surge Ambush',
      subtitle: 'Act III · Stage 10B · Erupting Caldera Geysers',
      hazardBadge: '⚠️ LOWER PATH · ERUPTING LAVA GEYSERS',
      prose:
        'Forced through the lower blast tunnel as the Siege Golem explodes, your party steps onto the caldera floor just as Ignis-Prime’s awakening roar triggers a ring of violent lava geysers and magma-hound constructs!',
      narrativeEcho: {
        fromFail:
          'Because the resonator check failed, you are forced onto the lower caldera floor amidst erupting lava geysers!',
      },
      focalArt: 'magma-geyser',
      choices: [
        {
          id: 'it-10b-finesse',
          title: 'Weave Through the Erupting Geyser Plumes',
          description:
            'Read the bubbling crust fissures and dodge between forty-foot columns of liquid fire.',
          attribute: 'finesse',
          dc: 14,
          tags: ['hazard', 'trap'],
          failPenaltyText: 'Falling magma droplets sear your shoulders (-3 HP).',
          failHpDamage: 3,
          successBonusText: 'You dart through the geyser curtain without a burn!',
        },
        {
          id: 'it-10b-might',
          title: 'Smash the Magma-Hound Pack',
          description:
            'Shatter the lunging volcanic constructs before they can pin you near a geyser.',
          attribute: 'might',
          dc: 14,
          tags: ['combat', 'hazard'],
          failPenaltyText: 'Molten jaws clamp onto your boot (-3 HP).',
          failHpDamage: 3,
          successBonusText: 'You cleave the magma-hounds into cooling cinders!',
        },
        {
          id: 'it-10b-arcana',
          title: 'Erect an Obsidian Deflection Dome',
          description:
            'Raise a hemisphere of vitrified stone overhead to shed the raining lava.',
          attribute: 'arcana',
          dc: 14,
          tags: ['hazard'],
          failPenaltyText: 'The intense pressure cracks your dome (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'Lava sheets harmlessly off your obsidian shield!',
        },
      ],
      nextNodeSuccess: 'node-11',
      nextNodeFail: 'node-11',
    },

    'node-11': {
      id: 'node-11',
      stageNumber: 11,
      act: 3,
      title: 'Awakening of Ignis-Prime',
      subtitle: 'Act III · Stage 11 · The 100-Foot Molten Colossus',
      hazardBadge: '🔥 BOSS PHASE I · VOLCANIC GLASS WARHAMMER',
      prose:
        'With a roar that shakes the mountain roots, the 100-foot Molten Colossus Ignis-Prime hauls itself out of the central caldera! Rivers of lava cascade from its iron ribs as it swings a titanic warhammer of black volcanic glass across the arena.',
      narrativeEcho: {
        fromSuccess:
          'Dropping from the crane gantry as the flux ladle cracks its shoulders, you engage Ignis-Prime with the upper hand!',
        fromFail:
          'Emerging from the geyser storm, you brace as Ignis-Prime’s volcanic warhammer comes hurtling down!',
        flags: {
          cryo_coolant_canister:
            'Cryo-Canister Deployed: You hurl the Artificer’s frost canister onto the Titan’s chest—spiderweb cracks spread across its breastplate!',
          arena_cooled:
            'Nitrogen Flood: Sub-zero mist pours from the ceiling pipes, chilling the Colossus’s magma joints!',
          boss_hp_reduced:
            'Cracked Carapace: The hundred-ton ladle drop has already exposed the glowing grating over its heart!',
        },
      },
      focalArt: 'ignis-awakening',
      choices: [
        {
          id: 'it-11-finesse',
          title: 'Dive Under the Warhammer Shockwave',
          description:
            'Leap over the expanding ring of molten glass and scale the Titan’s knee-chains.',
          attribute: 'finesse',
          dc: 14,
          tags: ['combat', 'boss', 'chasm'],
          failPenaltyText: 'Volcanic glass shrapnel slices your flank (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'You vault the shockwave and latch onto the Colossus’s chest!',
          reducesBossDc: 1,
        },
        {
          id: 'it-11-might',
          title: 'Sunder the Titan’s Ankle Stabilizer',
          description:
            'Hammer the glowing piston-joint behind its heel to bring the Colossus crashing to one knee.',
          attribute: 'might',
          dc: 14,
          tags: ['combat', 'boss'],
          failPenaltyText: 'A stomp-tremor knocks you off balance (-3 HP).',
          failHpDamage: 3,
          successBonusText: 'The ankle piston ruptures—Ignis-Prime crashes to one knee!',
          reducesBossDc: 1,
        },
        {
          id: 'it-11-arcana',
          title: 'Thermal-Shock the Chest Grating',
          description:
            'Blast its red-hot sternum with concentrated frost-lightning to shatter the outer armor.',
          attribute: 'arcana',
          dc: 14,
          tags: ['combat', 'boss'],
          failPenaltyText: 'A furnace flare-back scorches your face (-2 HP).',
          failHpDamage: 2,
          successBonusText: 'The iron chest-grating cracks wide open, revealing the Furnace Core!',
          reducesBossDc: 1,
        },
      ],
      nextNodeSuccess: 'node-12',
      nextNodeFail: 'node-12',
      nextNodeCritical: 'node-12',
      criticalGrantsFlag: 'furnace_grating_shattered',
    },

    'node-12': {
      id: 'node-12',
      stageNumber: 12,
      act: 3,
      title: 'Finale — Heart of the Iron Titan',
      subtitle: 'Act III · Stage 12 · Climax of the Subterranean Forge',
      hazardBadge: '🎲 CRUCIAL FINALE CHECK · STRIKE THE FURNACE CORE',
      prose:
        'Kneeling amidst the roaring caldera, Ignis-Prime opens its chest plates to charge a cataclysmic *Solar Eruption*! Inside its ribcage spins the blinding white-hot Furnace Core. Strike the exposed core now before the entire mountain detonates!',
      narrativeEcho: {
        fromSuccess:
          'With its armor plates cracked by thermal shock, the Titan’s Furnace Core spins completely exposed before you!',
        fromFail:
          'Through blinding ash and fire, you spot the narrow opening in the Titan’s ribs for one final strike!',
        flags: {
          cryo_coolant_canister:
            'Cryo-Brittle Core: The Artificer’s coolant has made the core casing brittle as glass!',
          arena_cooled:
            'Cooled Arena: The nitrogen flood suppresses the Titan’s flame aura (-1 Finale DC)!',
        },
      },
      focalArt: 'iron-titan-finale',
      isFinale: true,
      crucialSkillCheck: {
        kind: 'wrist-d20',
        title: 'Crucial Finale Check: Shatter the Exposed Furnace Core!',
        instruction:
          'Roll the High-Stakes Finale D20 from your Wrist HUD, /mobile companion, or Cinema Screen (or hit the Dartboard / Putting Strip) to pierce Ignis-Prime’s exposed Furnace Core!',
        targetDescription: 'Roll High-Stakes D20 ≥ DC 13 (reduced by Boss Weaknesses)',
        fallbackDc: 13,
        successRewardText:
          'TITAN FELLED! Your strike pierces the white-hot Furnace Core—Ignis-Prime freezes into a towering statue of cooled obsidian and silent brass!',
        failPenaltyText:
          'Solar Eruption blasts across the caldera (-3 HP), forcing a desperate last-second blow!',
        failHpPenalty: 3,
      },
      choices: [
        {
          id: 'it-12-might',
          title: 'Drive Your Blade Straight Through the Core',
          description:
            'Charge up the fallen warhammer shaft and plunge your weapon into the spinning heart.',
          attribute: 'might',
          dc: 15,
          tags: ['combat', 'boss'],
          failPenaltyText: 'Molten plasma splashes across your pauldrons (-3 HP).',
          failHpDamage: 3,
          successBonusText: 'You impale the Furnace Core to the hilt—shattering the Iron Titan!',
        },
        {
          id: 'it-12-finesse',
          title: 'Snipe the Core’s Central Containment Pin',
          description:
            'Thread a shot between the whirling turbine blades to sever the core’s gyroscopic stabilizer.',
          attribute: 'finesse',
          dc: 15,
          tags: ['combat', 'boss'],
          failPenaltyText: 'Superheated shrapnel grazes your cheek (-3 HP).',
          failHpDamage: 3,
          successBonusText: 'The containment pin snaps and the Furnace Core implodes inward!',
        },
        {
          id: 'it-12-arcana',
          title: 'Collapse the Core with Absolute Zero',
          description:
            'Unleash an absolute-zero singularity directly inside the Titan’s furnace chamber.',
          attribute: 'arcana',
          dc: 15,
          tags: ['combat', 'boss'],
          failPenaltyText: 'Thermal shockwave rattles your bones (-3 HP).',
          failHpDamage: 3,
          successBonusText: 'Ice crystals encase the Furnace Core, silencing Ignis-Prime forever!',
        },
      ],
      nextNodeSuccess: 'victory',
      nextNodeFail: 'defeat',
      nextNodeCritical: 'victory',
    },
  },
}

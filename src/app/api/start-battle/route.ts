import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToMongo } from '@/lib/mongodb';
import { verifyJWT } from '@/utils/jwt';
import { getRandomMonsterTemplateForBiome, getRandomClicksRequired, getScaledAttackDamage } from '@/lib/monster-table';
import { BiomeId, Tier, formatBiomeTierKey, isBiomeTierAvailable } from '@/lib/biome-config';
import { generateMonsterBuffs } from '@/utils/monsterBuffs';
import { getCorruptionRateForStreak } from '@/utils/playerProgression';
import { getStreakForZone } from '@/utils/streakHelpers';
import { MonsterBuffType } from '@/lib/types';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    // Get cookies using next/headers
    const cookieStore = await cookies();
    const token = cookieStore.get('verified')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const payload = await verifyJWT(token);
    const userId = payload.userId;

    // Get biome/tier from request body (optional)
    const body = await request.json().catch(() => ({}));
    let requestedBiome = body.biome as BiomeId | undefined;
    let requestedTier = body.tier as Tier | undefined;

    // Connect to MongoDB and get collections
    const { battleSessionsCollection, monstersCollection, playerStatsCollection } = await connectToMongo();

    // Check if user already has an active battle session
    const activeSession = await battleSessionsCollection.findOne({
      userId,
      isDefeated: false,
      completedAt: { $exists: false }
    });

    if (activeSession) {
      // Return existing active session with monster details
      const monster = await monstersCollection.findOne({
        _id: activeSession.monsterId
      });

      return NextResponse.json({
        session: {
          ...activeSession,
          _id: activeSession._id?.toString(),
          monsterId: activeSession.monsterId.toString()
        },
        monster: monster ? {
          ...monster,
          _id: monster._id?.toString()
        } : null,
        isNewSession: false
      });
    }

    // No active session found - need to create new battle
    // Get player stats to determine biome/tier
    const playerStats = await playerStatsCollection.findOne({ userId });

    if (!playerStats) {
      return NextResponse.json(
        { error: 'Player stats not found. Please refresh the page.' },
        { status: 404 }
      );
    }

    // Determine which biome/tier to use
    let biome: BiomeId;
    let tier: Tier;

    if (requestedBiome && requestedTier) {
      // Validate requested biome/tier is unlocked
      const biomeTierKey = formatBiomeTierKey(requestedBiome, requestedTier);
      if (!playerStats.unlockedZones.includes(biomeTierKey)) {
        return NextResponse.json(
          { error: `Biome/tier ${biomeTierKey} is not unlocked yet` },
          { status: 403 }
        );
      }

      // Validate biome/tier is implemented
      if (!isBiomeTierAvailable(requestedBiome, requestedTier)) {
        return NextResponse.json(
          { error: `Biome/tier ${biomeTierKey} is not available yet` },
          { status: 400 }
        );
      }

      biome = requestedBiome;
      tier = requestedTier;
    } else {
      // Default to first unlocked zone (should be forest-1 for new players)
      const firstUnlocked = playerStats.unlockedZones[0] || 'forest-1';
      const parts = firstUnlocked.split('-');
      biome = parts[0] as BiomeId;
      tier = parseInt(parts[1], 10) as Tier;
    }

    // Load challenge config to check for forced buffs (before monster generation)
    const challengeConfig = playerStats.battleChallengeConfig || {
      forceShield: false,
      forceSpeed: false,
      damageMultiplier: 1.0,
      hpMultiplier: 1.0,
      dotIntensity: 1.0,
      corruptionRate: 0,
      escapeTimerSpeed: 1.0,
      buffStrength: 1.0,
      bossAttackSpeed: 1.0,
      bossSpawnRate: 1.0
    };

    // Create monster for this biome/tier (pass bossSpawnRate for 5x boss spawns)
    const monsterTemplate = getRandomMonsterTemplateForBiome(biome, tier, challengeConfig.bossSpawnRate);
    const clicksRequired = getRandomClicksRequired(monsterTemplate.baseClicksRange, tier);
    const attackDamage = getScaledAttackDamage(monsterTemplate.baseAttackDamage, tier);

    // Determine which buff types to exclude from random generation
    const excludeBuffTypes: MonsterBuffType[] = [];
    if (challengeConfig.forceSpeed) {
      excludeBuffTypes.push('fast'); // Don't generate random fast buff if challenge forces it
      console.log(`⚔️ [CHALLENGE] Speed buff forced by config - excluding 'fast' from random buff generation`);
    }

    // Generate random buffs based on tier (Tier 2+, no buffs for bosses except Tier 5)
    const randomBuffs = generateMonsterBuffs(tier, clicksRequired, monsterTemplate.isBoss || false, excludeBuffTypes);

    // Apply initial buffs from template (these stack with random buffs)
    const initialBuffs = monsterTemplate.initialBuffs || [];
    const processedInitialBuffs = initialBuffs.map(buff => {
      if (buff.type === 'shield') {
        // Calculate shield HP as percentage of monster HP
        const shieldHP = Math.floor(clicksRequired * (buff.value / 100));
        return { type: buff.type, value: shieldHP };
      }
      return buff;
    });

    // Combine initial buffs and random buffs (they stack!)
    const buffs = [...processedInitialBuffs, ...randomBuffs];

    // Corruption system: Spawn rate scales with streak (10% base → 30% at streak 100+)
    // Get current streak for this zone
    const currentStreak = getStreakForZone(playerStats.stats.battlesWonStreaks, biome, tier);

    console.log(`🎯 [STREAK DEBUG - START BATTLE] Biome: ${biome}, Tier: ${tier}, Current Streak: ${currentStreak}`);
    console.log(`🎯 [STREAK DEBUG - START BATTLE] battlesWonStreaks:`, JSON.stringify(playerStats.stats.battlesWonStreaks));

    // Calculate corruption rate based on streak (higher streak = more corrupted spawns)
    const corruptionRate = getCorruptionRateForStreak(currentStreak);
    const isCorrupted = Math.random() < corruptionRate;

    console.log(`🎯 [STREAK DEBUG - START BATTLE] Corruption Rate: ${(corruptionRate * 100).toFixed(1)}% (streak ${currentStreak}), isCorrupted: ${isCorrupted}`);

    // Apply corruption multipliers if corrupted
    let finalClicksRequired = isCorrupted ? Math.round(clicksRequired * 1.5) : clicksRequired; // +50% HP
    let finalAttackDamage = isCorrupted ? Math.round(attackDamage * 1.25) : attackDamage; // +25% damage

    if (isCorrupted) {
      console.log(`🎯 [STREAK DEBUG - START BATTLE] Corrupted multipliers applied: HP ${clicksRequired} → ${finalClicksRequired} (+50%), DMG ${attackDamage} → ${finalAttackDamage} (+25%)`);
    }

    // Apply Challenge Mode multipliers (Phase 3.3)
    // (challengeConfig already loaded above for buff exclusion)

    // Apply HP multiplier
    if (challengeConfig.hpMultiplier > 1.0) {
      const hpBefore = finalClicksRequired;
      finalClicksRequired = Math.round(finalClicksRequired * challengeConfig.hpMultiplier);
      console.log(`⚔️ [CHALLENGE] HP multiplier applied: ${hpBefore} → ${finalClicksRequired} (${challengeConfig.hpMultiplier}x)`);
    }

    // Apply damage multiplier
    if (challengeConfig.damageMultiplier > 1.0) {
      const dmgBefore = finalAttackDamage;
      finalAttackDamage = Math.round(finalAttackDamage * challengeConfig.damageMultiplier);
      console.log(`⚔️ [CHALLENGE] Damage multiplier applied: ${dmgBefore} → ${finalAttackDamage} (${challengeConfig.damageMultiplier}x)`);
    }

    // Apply boss spawn rate bonus (+10% HP/DMG for bosses when enabled)
    if (challengeConfig.bossSpawnRate === 5.0 && monsterTemplate.isBoss) {
      const hpBefore = finalClicksRequired;
      const dmgBefore = finalAttackDamage;
      finalClicksRequired = Math.round(finalClicksRequired * 1.1);
      finalAttackDamage = Math.round(finalAttackDamage * 1.1);
      console.log(`👹 [CHALLENGE] Boss Spawn Rate 5x: Boss HP/DMG +10%: ${hpBefore} HP → ${finalClicksRequired} HP, ${dmgBefore} DMG → ${finalAttackDamage} DMG`);
    }

    // Apply forced buffs from challenge config (with buff strength multiplier)
    if (challengeConfig.forceShield) {
      const baseShieldHP = Math.floor(finalClicksRequired * 0.3); // 30% of monster HP
      const shieldHP = Math.floor(baseShieldHP * challengeConfig.buffStrength);
      buffs.push({ type: 'shield', value: shieldHP });
      console.log(`⚔️ [CHALLENGE] Force Shield applied: ${shieldHP} HP (${challengeConfig.buffStrength}x strength)`);
    }

    if (challengeConfig.forceSpeed) {
      const baseTimer = 30; // 30 second base timer (will be modified by escapeTimerSpeed later)
      buffs.push({ type: 'fast', value: baseTimer });
      console.log(`⚔️ [CHALLENGE] Force Speed applied: ${baseTimer}s base timer`);
    }

    // Apply buff strength multiplier to existing shield buffs
    if (challengeConfig.buffStrength > 1.0) {
      buffs.forEach(buff => {
        if (buff.type === 'shield') {
          const oldValue = buff.value;
          buff.value = Math.floor(buff.value * challengeConfig.buffStrength);
          console.log(`⚔️ [CHALLENGE] Shield buff strength: ${oldValue} → ${buff.value} HP (${challengeConfig.buffStrength}x)`);
        }
      });
    }

    // Apply escape timer speed to existing fast buffs (with 10 second minimum)
    if (challengeConfig.escapeTimerSpeed > 1.0) {
      buffs.forEach(buff => {
        if (buff.type === 'fast') {
          const oldValue = buff.value;
          const calculatedTimer = Math.floor(buff.value / challengeConfig.escapeTimerSpeed);
          buff.value = Math.max(10, calculatedTimer); // Minimum 10 seconds
          console.log(`⚔️ [CHALLENGE] Escape timer speed: ${oldValue}s → ${buff.value}s (${challengeConfig.escapeTimerSpeed}x, min 10s)`);
        }
      });
    }

    // Apply DoT intensity multiplier to monster DoT effects
    let modifiedDotEffect = monsterTemplate.dotEffect;
    if (modifiedDotEffect && challengeConfig.dotIntensity > 1.0) {
      modifiedDotEffect = {
        ...modifiedDotEffect,
        damageAmount: modifiedDotEffect.damageAmount * challengeConfig.dotIntensity
      };
      console.log(`⚔️ [CHALLENGE] DoT intensity: ${monsterTemplate.dotEffect?.damageAmount}% → ${modifiedDotEffect.damageAmount}% (${challengeConfig.dotIntensity}x)`);
    }

    // Override corruption rate if challenge config forces it
    let finalIsCorrupted = isCorrupted;
    let hasEnrageBuff = false;
    if (challengeConfig.corruptionRate > 0) {
      const forcedCorruption = Math.random() < challengeConfig.corruptionRate;
      if (forcedCorruption && !isCorrupted) {
        // Force corruption via challenge mode
        finalIsCorrupted = true;
        finalClicksRequired = Math.round(finalClicksRequired * 1.5); // +50% HP
        finalAttackDamage = Math.round(finalAttackDamage * 1.25); // +25% damage
        // Add enrage buff (+20% damage) for forced corruption
        hasEnrageBuff = true;
        finalAttackDamage = Math.round(finalAttackDamage * 1.2); // +20% enrage
        console.log(`⚔️ [CHALLENGE] Forced corruption: HP +50%, DMG +25%, Enrage +20% (total DMG: ${finalAttackDamage})`);
      }
    }

    // Apply boss attack speed multiplier to special attacks
    let modifiedSpecialAttacks = monsterTemplate.specialAttacks?.filter(
      attack => !attack.minTier || tier >= attack.minTier
    );
    if (modifiedSpecialAttacks && challengeConfig.bossAttackSpeed < 1.0) {
      modifiedSpecialAttacks = modifiedSpecialAttacks.map(attack => ({
        ...attack,
        cooldown: Math.round(attack.cooldown * challengeConfig.bossAttackSpeed)
      }));
      console.log(`⚔️ [CHALLENGE] Boss attack speed: Cooldowns multiplied by ${challengeConfig.bossAttackSpeed}x`);
    }

    const newMonster = {
      name: monsterTemplate.name,
      imageUrl: monsterTemplate.imageUrl,
      clicksRequired: finalClicksRequired,
      attackDamage: finalAttackDamage,
      rarity: monsterTemplate.rarity,
      biome,
      tier,
      moveInterval: monsterTemplate.moveInterval, // Monster movement speed (700-3000ms)
      isBoss: monsterTemplate.isBoss, // Mark boss monsters (enables phase system)
      isCorrupted: finalIsCorrupted, // Mark corrupted monsters (drops empowered items) - includes forced corruption
      dotEffect: modifiedDotEffect, // Pass DoT effect to frontend (with challenge intensity applied)
      buffs, // Add monster buffs (initial + random, they stack!)
      specialAttacks: modifiedSpecialAttacks, // Boss special attacks (with challenge cooldown applied)
      bossPhases: monsterTemplate.bossPhases, // Boss phase system
      createdAt: new Date()
    };

    const monsterResult = await monstersCollection.insertOne(newMonster);
    const monsterId = monsterResult.insertedId;

    // Create new battle session with biome/tier tracking
    const newSession = {
      userId,
      monsterId,
      biome,
      tier,
      clickCount: 0,
      isDefeated: false,
      usedItems: [], // Initialize empty array for tracking used items
      startedAt: new Date()
    };

    const sessionResult = await battleSessionsCollection.insertOne(newSession);

    console.log(`New battle session created for user ${userId} in ${biome} T${tier}: ${sessionResult.insertedId.toString()}`);

    return NextResponse.json({
      session: {
        ...newSession,
        _id: sessionResult.insertedId.toString(),
        monsterId: monsterId.toString()
      },
      monster: {
        ...newMonster,
        _id: monsterId.toString()
      },
      isNewSession: true
    });

  } catch (error) {
    console.error('Start battle error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

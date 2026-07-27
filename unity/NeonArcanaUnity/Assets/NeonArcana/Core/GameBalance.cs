using System;
using UnityEngine;

namespace NeonArcana
{
    public static class GameBalance
    {
        public const float StartingHp = 30f;
        public const float StartingSpeed = 5f;
        public const float StartingDamage = 2.4f;
        public const float StartingAttackInterval = 0.54f;
        public const float StartingCritChance = 0.07f;
        public const float StartingCritMultiplier = 1.75f;
        public const int StartingMultishot = 1;
        public const float PlayerHitRadius = 0.28f;
        public const float BaseMagnetRadius = 2.2f;
        public const int EnemyCap = 210;

        public static int XpForNextLevel(int level)
        {
            // JavaScript Math.round rounds .5 upward; Unity's RoundToInt uses banker's rounding.
            return Mathf.FloorToInt(7f + 1.55f * level + 0.17f * level * level + 0.5f);
        }

        public static float DifficultyScale(float time)
        {
            var lateGame = time <= 600f ? 1f : Mathf.Pow(1f + (time - 600f) / 480f, 1.18f);
            return (1f + time / 170f + Mathf.Pow(time / 420f, 1.35f)) * lateGame;
        }

        public static float EnemyDamageScale(float time, int bossFailures = 0)
        {
            return 1f + time / 145f + Mathf.Floor(time / 300f) * 0.55f + Mathf.Pow(time / 900f, 1.2f) + bossFailures * 0.15f;
        }

        public static int Score(int kills, int level, float survivalSeconds, int bosses = 0, bool firstClear = false)
        {
            return kills * 10 + level * 120 + Mathf.FloorToInt(survivalSeconds) * 4 + bosses * 1000 + (firstClear ? 2500 : 0);
        }

        public static void Validate()
        {
            if (XpForNextLevel(1) != 9) throw new InvalidOperationException("Level 1 XP curve changed.");
            if (XpForNextLevel(30) != 207) throw new InvalidOperationException("Level 30 XP curve changed.");
            if (Mathf.Abs(DifficultyScale(0f) - 1f) > 0.0001f) throw new InvalidOperationException("Opening difficulty must be 1.");
            if (Mathf.Abs(EnemyDamageScale(0f) - 1f) > 0.0001f) throw new InvalidOperationException("Opening enemy damage must be 1.");
            if (Score(10, 2, 30f) != 460) throw new InvalidOperationException("Score formula changed.");
        }
    }
}

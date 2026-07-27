using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeonArcana
{
    public static class SaveProgress
    {
        private const string HighScoreKey = "NeonArcana.HighScore";
        private const string ClassesKey = "NeonArcana.Classes";
        private const string LastRunKey = "NeonArcana.LastRun";

        public static int HighScore => PlayerPrefs.GetInt(HighScoreKey, 0);
        public static int ClassCount => PlayerPrefs.GetString(ClassesKey, "").Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries).Length;
        public static string LastRun => PlayerPrefs.GetString(LastRunKey, "아직 완료한 런이 없습니다.");
        public static bool HasClass(ArcanaClass classId)
        {
            var classes = PlayerPrefs.GetString(ClassesKey, "").Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries);
            return Array.Exists(classes, item => item == classId.ToString());
        }

        public static void RecordClass(ArcanaClass classId)
        {
            var classes = new HashSet<string>(PlayerPrefs.GetString(ClassesKey, "").Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries));
            classes.Add(classId.ToString());
            PlayerPrefs.SetString(ClassesKey, string.Join(",", classes));
            PlayerPrefs.Save();
        }

        public static void RecordRun(int score, int kills, int bosses, int level, float elapsed, ArcanaClass classId, IReadOnlyList<RelicInstance> relics)
        {
            if (score > HighScore) PlayerPrefs.SetInt(HighScoreKey, score);
            PlayerPrefs.SetString(LastRunKey, $"{Mathf.FloorToInt(elapsed / 60f):00}:{Mathf.FloorToInt(elapsed % 60f):00} · LV.{level} · 처치 {kills} · 보스 {bosses} · {classId} · 유물 {relics.Count}");
            PlayerPrefs.Save();
        }
    }

    public static class PhaseTwoSimulation
    {
        public static void ValidateCatalog()
        {
            var catalog = ContentDatabase.Catalog;
            if (catalog.upgrades.Count != 34) throw new InvalidOperationException($"Upgrade catalog count changed: {catalog.upgrades.Count}");
            if (catalog.relics.Count != 21) throw new InvalidOperationException($"Relic catalog count changed: {catalog.relics.Count}");
            if (catalog.enemies.Count != 6) throw new InvalidOperationException("Six enemy archetypes are required.");
            if (catalog.bosses.Count != 4) throw new InvalidOperationException("Four boss types are required.");
            if (catalog.bossOptions.Count != 9) throw new InvalidOperationException("Nine boss options are required.");
            if (catalog.classes.Count != 5) throw new InvalidOperationException("Five class choices are required.");
        }

        public static SimulationReport RunFifteenMinutes(int seed = 61061)
        {
            ValidateCatalog();
            var random = new System.Random(seed);
            var archetypes = new int[6];
            var bossRarities = new int[5];
            var bossOptions = new List<BossOptionContent>();
            var enemyPeak = 0;
            var bossCount = 0;
            for (var second = 0; second <= 900; second++)
            {
                var density = Mathf.Min(190, Mathf.RoundToInt((36f + Mathf.Floor(second * 0.24f)) * Mathf.Lerp(0.7f, 1f, Mathf.Clamp01(second / 60f))));
                enemyPeak = Mathf.Max(enemyPeak, density);
                for (var i = 0; i < density; i++)
                    archetypes[(int)EnemyController.ChooseArchetype(second, (float)random.NextDouble())]++;
                if (second == 48 || second > 48 && (second - 48) % 68 == 0)
                {
                    bossCount++;
                    EnemyController.RollBossOptions(second, bossOptions, random);
                    foreach (var option in bossOptions) bossRarities[option.rarity]++;
                }
            }
            if (archetypes[(int)EnemyArchetype.Gunner] == 0 || archetypes[(int)EnemyArchetype.Splitter] == 0)
                throw new InvalidOperationException("Timed archetype unlock simulation failed.");
            if (bossOptions.Count != 5) throw new InvalidOperationException("Late-game boss must roll five unique options.");
            if (enemyPeak != 190) throw new InvalidOperationException("Enemy density must cap at 190.");
            return new SimulationReport(archetypes, bossRarities, bossCount, enemyPeak);
        }
    }

    public readonly struct SimulationReport
    {
        public readonly int[] Archetypes;
        public readonly int[] BossOptionRarities;
        public readonly int BossCount;
        public readonly int EnemyPeak;
        public SimulationReport(int[] archetypes, int[] bossOptionRarities, int bossCount, int enemyPeak)
        {
            Archetypes = archetypes;
            BossOptionRarities = bossOptionRarities;
            BossCount = bossCount;
            EnemyPeak = enemyPeak;
        }
    }
}

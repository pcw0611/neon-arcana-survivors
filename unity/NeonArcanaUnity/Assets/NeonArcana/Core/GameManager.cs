using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeonArcana
{
    public sealed class GameManager : MonoBehaviour
    {
        public static GameManager Instance { get; private set; }

        public PlayerController Player { get; private set; }
        public int Level { get; private set; } = 1;
        public int Xp { get; private set; }
        public int XpToNext { get; private set; } = GameBalance.XpForNextLevel(1);
        public int Kills { get; private set; }
        public float Elapsed { get; private set; }
        public bool IsChoosingUpgrade { get; private set; }
        public bool IsGameOver { get; private set; }
        public int Score => GameBalance.Score(Kills, Level, Elapsed);

        private GameHud hud;
        private readonly List<UpgradeDefinition> upgradePool = new();
        private readonly System.Random random = new();

        private void Awake()
        {
            Instance = this;
            GameBalance.Validate();
            BuildUpgradePool();
        }

        public void Initialize(PlayerController player)
        {
            Player = player;
            player.Died += HandleGameOver;
        }

        public void AttachHud(GameHud gameHud)
        {
            hud = gameHud;
            hud.Refresh();
        }

        private void Update()
        {
            if (IsGameOver || IsChoosingUpgrade) return;
            Elapsed += Time.deltaTime;
            hud?.Refresh();
        }

        public void RegisterKill(Vector3 position, int xpValue)
        {
            Kills++;
            ExperienceGem.Spawn(position, xpValue);
            hud?.Refresh();
        }

        public void AddExperience(int amount)
        {
            if (IsGameOver) return;
            Xp += amount;
            while (Xp >= XpToNext)
            {
                Xp -= XpToNext;
                Level++;
                XpToNext = GameBalance.XpForNextLevel(Level);
                OpenUpgradeChoice();
                break;
            }
            hud?.Refresh();
        }

        private void OpenUpgradeChoice()
        {
            IsChoosingUpgrade = true;
            Time.timeScale = 0f;
            var choices = WeightedChoices(3);
            hud.ShowUpgradeChoices(choices, ApplyUpgrade);
        }

        private List<UpgradeDefinition> WeightedChoices(int count)
        {
            var available = new List<UpgradeDefinition>(upgradePool);
            var choices = new List<UpgradeDefinition>();
            while (choices.Count < count && available.Count > 0)
            {
                var total = 0;
                foreach (var upgrade in available) total += upgrade.Weight;
                var roll = random.Next(total);
                var cursor = 0;
                for (var i = 0; i < available.Count; i++)
                {
                    cursor += available[i].Weight;
                    if (roll >= cursor) continue;
                    choices.Add(available[i]);
                    available.RemoveAt(i);
                    break;
                }
            }
            return choices;
        }

        private void ApplyUpgrade(UpgradeDefinition upgrade)
        {
            upgrade.Apply(Player);
            IsChoosingUpgrade = false;
            Time.timeScale = 1f;
            hud.HideUpgradeChoices();
            hud.Refresh();
        }

        private void HandleGameOver()
        {
            IsGameOver = true;
            Time.timeScale = 0f;
            hud.ShowGameOver();
        }

        public void Restart()
        {
            Time.timeScale = 1f;
            EnemyController.ClearAll();
            Projectile.ClearAll();
            ExperienceGem.ClearAll();
            Level = 1;
            Xp = 0;
            XpToNext = GameBalance.XpForNextLevel(1);
            Kills = 0;
            Elapsed = 0f;
            IsChoosingUpgrade = false;
            IsGameOver = false;
            foreach (var upgrade in upgradePool) upgrade.ResetRank();
            Player.ResetForRun();
            hud.HideGameOver();
            hud.Refresh();
        }

        private void BuildUpgradePool()
        {
            upgradePool.Add(new UpgradeDefinition("룬 증폭", "모든 투사체 피해 +12%", 10, 16, p => p.Damage *= 1.12f));
            upgradePool.Add(new UpgradeDefinition("영창 가속", "공격 간격 -13%", 7, 14, p => p.AttackInterval = Mathf.Max(0.1f, p.AttackInterval * 0.87f)));
            upgradePool.Add(new UpgradeDefinition("쌍성 궤도", "동시 발사 수 +1", 7, 10, p => p.Multishot++));
            upgradePool.Add(new UpgradeDefinition("공간 도약", "이동 속도 +11%", 6, 12, p => p.MoveSpeed *= 1.11f));
            upgradePool.Add(new UpgradeDefinition("생명 결계", "최대 체력 +8, 체력 10 회복", 7, 13, p => p.IncreaseVitality(8f, 10f)));
            upgradePool.Add(new UpgradeDefinition("중력 우물", "경험치 흡수 범위 +0.8", 6, 11, p => p.MagnetRadius += 0.8f));
        }
    }

    public sealed class UpgradeDefinition
    {
        public string Name { get; }
        public string Description { get; }
        public int MaxRank { get; }
        public int Weight { get; }
        public int Rank { get; private set; }
        private readonly Action<PlayerController> action;

        public UpgradeDefinition(string name, string description, int maxRank, int weight, Action<PlayerController> apply)
        {
            Name = name;
            Description = description;
            MaxRank = maxRank;
            Weight = weight;
            action = apply;
        }

        public void Apply(PlayerController player)
        {
            if (Rank >= MaxRank) return;
            Rank++;
            action(player);
        }

        public void ResetRank() => Rank = 0;
    }
}

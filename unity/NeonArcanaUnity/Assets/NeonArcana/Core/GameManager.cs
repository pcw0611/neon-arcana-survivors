using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeonArcana
{
    public sealed class GameManager : MonoBehaviour
    {
        private enum RewardType
        {
            Upgrade,
            Class,
            Relic
        }

        public static GameManager Instance { get; private set; }

        public PlayerController Player { get; private set; }
        public int Level { get; private set; } = 1;
        public int Xp { get; private set; }
        public int XpToNext { get; private set; } = GameBalance.XpForNextLevel(1);
        public int Kills { get; private set; }
        public int BossKills { get; private set; }
        public int BossFailures { get; private set; }
        public float Elapsed { get; private set; }
        public bool IsChoosingUpgrade { get; private set; }
        public bool IsGameOver { get; private set; }
        public bool WasAbandoned { get; private set; }
        public bool IsAwaitingStart { get; private set; } = true;
        public int Score => GameBalance.Score(Kills, Level, Elapsed, BossKills);
        public EnemyController ActiveBoss { get; private set; }
        public IReadOnlyList<RelicInstance> Relics => relics;
        public IReadOnlyDictionary<string, int> UpgradeRanks => upgradeRanks;
        public int PendingRewardCount => rewardQueue.Count;
        public string ActiveRewardType => activeReward?.ToString() ?? "None";

        private GameHud hud;
        private readonly List<UpgradeDefinition> upgradePool = new();
        private readonly List<RelicInstance> relics = new();
        private readonly Dictionary<string, int> upgradeRanks = new();
        private readonly Dictionary<string, int> relicKillCounters = new();
        private readonly HashSet<string> discoveredRelics = new();
        private readonly Queue<RewardType> rewardQueue = new();
        private readonly System.Random random = new(61061);
        private bool phoenixUsed;
        private RewardType? activeReward;

        private void Awake()
        {
            Instance = this;
            GameBalance.Validate();
            PhaseTwoSimulation.ValidateCatalog();
            BuildUpgradePool();
            LoadCodex();
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
            hud.ShowTitle();
        }

        private void Update()
        {
            if (IsGameOver || IsChoosingUpgrade || IsAwaitingStart) return;
            Elapsed += Time.deltaTime;
            hud?.Refresh();
        }

        public void StartRun()
        {
            if (!IsAwaitingStart) return;
            IsAwaitingStart = false;
            hud?.HideTitle();
            hud?.Refresh();
        }

        public void RegisterKill(Vector3 position, int xpValue)
        {
            Kills++;
            ExperienceGem.Spawn(position, xpValue);
            ProcessRelicKillHooks();
            hud?.Refresh();
        }

        public void RegisterBossSpawn(EnemyController boss)
        {
            ActiveBoss = boss;
            hud?.ShowBoss(boss);
        }

        public void RegisterBossKill(EnemyController boss)
        {
            BossKills++;
            Kills += boss.IsBoss ? 15 : 0;
            AddExperience(Mathf.CeilToInt(XpToNext * 1.53f));
            Player.Heal(8f);
            ActiveBoss = null;
            hud?.HideBoss();
            EnqueueReward(RewardType.Relic);
        }

        public void RegisterBossTimeout(EnemyController boss)
        {
            if (ActiveBoss != boss) return;
            BossFailures++;
            ActiveBoss = null;
            Player.TakeDamage(Mathf.Max(8f, Player.MaxHp * 0.18f));
            hud?.HideBoss();
            hud?.ShowToast("TIME OVER · 균열 과부하");
        }

        public void AddExperience(int amount)
        {
            if (IsGameOver) return;
            Xp += Mathf.Max(1, Mathf.RoundToInt(amount * Player.XpMultiplier));
            while (Xp >= XpToNext)
            {
                Xp -= XpToNext;
                Level++;
                XpToNext = GameBalance.XpForNextLevel(Level);
                EnqueueReward(Level == 30 && Player.Class == ArcanaClass.None ? RewardType.Class : RewardType.Upgrade);
            }
            hud?.Refresh();
        }

        private void EnqueueReward(RewardType reward)
        {
            rewardQueue.Enqueue(reward);
            ProcessNextReward();
        }

        private void ProcessNextReward()
        {
            if (IsGameOver || IsAwaitingStart || activeReward.HasValue || rewardQueue.Count == 0) return;
            activeReward = rewardQueue.Dequeue();
            IsChoosingUpgrade = true;
            Time.timeScale = 0f;
            switch (activeReward.Value)
            {
                case RewardType.Upgrade:
                    var choices = WeightedChoices(3);
                    if (choices.Count == 0)
                    {
                        CompleteReward();
                        return;
                    }
                    hud.ShowUpgradeChoices(choices, ApplyUpgrade);
                    break;
                case RewardType.Class:
                    hud.ShowClassChoices(ContentDatabase.Catalog.classes, ApplyClass);
                    break;
                case RewardType.Relic:
                    hud.ShowRelicChoices(RollRelics(3), SelectRelic);
                    break;
            }
        }

        private List<UpgradeDefinition> WeightedChoices(int count)
        {
            if (Level == 2 && upgradeRanks.Count == 0)
            {
                var openingChoices = new List<UpgradeDefinition>();
                foreach (var id in new[] { "multishot", "orbit", "saber" })
                {
                    var definition = upgradePool.Find(upgrade => upgrade.Id == id);
                    if (definition != null) openingChoices.Add(definition);
                }
                if (openingChoices.Count == count) return openingChoices;
            }

            var available = new List<UpgradeDefinition>();
            foreach (var upgrade in upgradePool)
                if (upgrade.Rank < upgrade.MaxRank && IsUpgradeEligible(upgrade)) available.Add(upgrade);

            var choices = new List<UpgradeDefinition>();
            while (choices.Count < count && available.Count > 0)
            {
                var total = 0f;
                foreach (var upgrade in available) total += upgrade.Weight;
                var roll = (float)random.NextDouble() * total;
                for (var i = 0; i < available.Count; i++)
                {
                    roll -= available[i].Weight;
                    if (roll > 0f) continue;
                    choices.Add(available[i]);
                    available.RemoveAt(i);
                    break;
                }
            }
            return choices;
        }

        private bool IsUpgradeEligible(UpgradeDefinition definition)
        {
            if (Level < definition.UnlockLevel) return false;
            return definition.Prerequisite switch
            {
                "orbit" => Player.Orbitals > 0,
                "saber" => Player.SaberLevel > 0,
                "projectile" => upgradeRanks.GetValueOrDefault("power") >= 10 && upgradeRanks.GetValueOrDefault("multishot") >= 7,
                _ => definition.Id != "relic_slot" || Player.RelicSlots < 7 && relics.Count >= Player.RelicSlots
            };
        }

        private void ApplyUpgrade(UpgradeDefinition upgrade)
        {
            upgrade.IncreaseRank();
            upgradeRanks[upgrade.Id] = upgrade.Rank;
            ApplyUpgradeEffect(upgrade.Id);
            CompleteReward();
        }

        private void ApplyUpgradeEffect(string id)
        {
            switch (id)
            {
                case "power": Player.Damage *= 1.12f; break;
                case "haste": Player.AttackInterval = Mathf.Max(0.1f, Player.AttackInterval * 0.87f); break;
                case "multishot": Player.Multishot++; break;
                case "pierce": Player.Pierce++; break;
                case "critical": Player.CritChance += 0.08f; Player.CritMultiplier += 0.18f; break;
                case "blast": Player.BlastRadius += 22f; break;
                case "chain": Player.ChainCount++; break;
                case "size": Player.ProjectileScale *= 1.18f; Player.ProjectileMultiplier *= 1.1f; break;
                case "orbit": Player.Orbitals++; break;
                case "orbit_speed": Player.OrbitSpeed *= 1.24f; break;
                case "orbit_size": Player.OrbitSize *= 1.2f; Player.OrbitDamage *= 1.16f; break;
                case "orbit_range": Player.OrbitRadius += 0.16f; Player.OrbitDamage *= 1.1f; break;
                case "orbit_shock": Player.OrbitShock += 0.12f; break;
                case "orbit_guard": Player.OrbitGuard += 0.06f; break;
                case "orbit_pulse": Player.OrbitPulse++; break;
                case "saber": Player.SaberLevel++; Player.SaberDamage *= 1.25f; break;
                case "saber_reach": Player.SaberRange += 20f; Player.SaberArc += 0.14f; break;
                case "saber_haste": Player.SaberInterval = Mathf.Max(0.22f, Player.SaberInterval * 0.83f); break;
                case "saber_echo": Player.SaberEcho++; break;
                case "saber_guard": Player.SaberGuard += 0.07f; break;
                case "speed": Player.MoveSpeed *= 1.11f; break;
                case "magnet": Player.MagnetRadius += 0.85f; break;
                case "vital": Player.IncreaseVitality(8f, 10f); break;
                case "regen": Player.Regen += 0.35f; break;
                case "guard": Player.GuardChance += 0.06f; break;
                case "fortune": Player.XpMultiplier *= 1.22f; break;
                case "relic_slot": Player.RelicSlots = Mathf.Min(7, Player.RelicSlots + 1); break;
                case "limit_power": Player.DamageMultiplier *= 1.02f; break;
                case "limit_vital": Player.IncreaseVitality(5f, 5f); break;
                case "limit_growth": Player.XpMultiplier = Mathf.Min(4f, Player.XpMultiplier * 1.07f); Player.MagnetRadius += 0.2f; break;
                default:
                    if (id.StartsWith("limit_master_", StringComparison.Ordinal)) Player.DamageMultiplier *= 1.04f;
                    break;
            }
        }

        private void ApplyClass(ClassContent definition)
        {
            Player.SetClass(definition.classId);
            SaveProgress.RecordClass(definition.classId);
            CompleteReward();
            hud.ShowToast($"전직 완료 · {definition.koreanName}");
        }

        private List<RelicContent> RollRelics(int count)
        {
            var available = new List<RelicContent>(ContentDatabase.Catalog.relics);
            // The companion runtime belongs to the deferred release-content phase. Keep its catalog entry for
            // parity, but never offer a relic whose effect is not active yet.
            available.RemoveAll(item => item.id == "tamer_core");
            var choices = new List<RelicContent>();
            while (choices.Count < count && available.Count > 0)
            {
                var rarityRoll = Mathf.Clamp(Mathf.FloorToInt((float)random.NextDouble() * 3f + Elapsed / 360f), 0, 4);
                var candidates = available.FindAll(item => item.rarity == rarityRoll);
                if (candidates.Count == 0) candidates = available;
                var selected = candidates[random.Next(candidates.Count)];
                choices.Add(selected);
                available.Remove(selected);
            }
            return choices;
        }

        private void SelectRelic(RelicContent relic)
        {
            var existing = relics.Find(item => item.Definition.id == relic.id);
            if (existing != null)
            {
                existing.Level++;
                ApplyRelicEffect(relic, true, false);
                Discover(relic.id);
                CompleteReward();
                hud.ShowToast($"{relic.name} · LV.{existing.Level}");
                return;
            }
            if (relics.Count < Player.RelicSlots)
            {
                EquipRelic(relic);
                CompleteReward();
                return;
            }
            var weakest = 0;
            for (var i = 1; i < relics.Count; i++)
                if (relics[i].Definition.rarity < relics[weakest].Definition.rarity || relics[i].Level < relics[weakest].Level) weakest = i;
            hud.ShowRelicDecision(relic, relics[weakest], () => ReplaceRelic(weakest, relic), () => SalvageRelic(relic));
        }

        private void EquipRelic(RelicContent definition)
        {
            relics.Add(new RelicInstance(definition));
            ApplyRelicEffect(definition, true, true);
            Discover(definition.id);
            hud.ShowToast($"{ContentDatabase.RarityName(definition.rarity)} 유물 · {definition.name}");
        }

        private void ReplaceRelic(int index, RelicContent definition)
        {
            var old = relics[index];
            for (var level = 0; level < old.Level; level++) ApplyRelicEffect(old.Definition, false, false);
            relics[index] = new RelicInstance(definition);
            ApplyRelicEffect(definition, true, true);
            Discover(definition.id);
            CompleteReward();
            hud.ShowToast($"{old.Definition.name} → {definition.name}");
        }

        private void SalvageRelic(RelicContent definition)
        {
            Xp += Mathf.RoundToInt(XpToNext * ContentDatabase.RelicSalvageRatio(definition.rarity));
            Player.Heal(new[] { 2f, 3f, 5f, 9f, Player.MaxHp }[definition.rarity]);
            CompleteReward();
            hud.ShowToast($"{definition.name} 분해 · 공명 에너지 회수");
        }

        private void ApplyRelicEffect(RelicContent relic, bool equip, bool first)
        {
            var factor = equip ? 1f : -1f;
            switch (relic.id)
            {
                case "arc_cell": Player.DamageMultiplier *= equip ? 1.1f : 1f / 1.1f; break;
                case "blood_cap": Player.IncreaseVitality(12f * factor, equip && first ? 12f : 0f); break;
                case "magnet_prism": Player.MagnetRadius *= equip ? 1.3f : 1f / 1.3f; Player.XpMultiplier *= equip ? 1.1f : 1f / 1.1f; break;
                case "hunter_lens": Player.CritChance += 0.08f * factor; Player.CritMultiplier += 0.2f * factor; break;
                case "orbit_gear": Player.Orbitals += equip ? 1 : -1; Player.OrbitSpeed *= equip ? 1.3f : 1f / 1.3f; Player.OrbitDamage *= equip ? 1.3f : 1f / 1.3f; break;
                case "edge_lens": Player.SaberDamage *= equip ? 1.45f : 1f / 1.45f; Player.SaberRange += 18f * factor; break;
                case "nano_shunt": Player.Regen += 0.45f * factor; break;
                case "soul_battery": Player.DamageMultiplier *= equip ? 1.08f : 1f / 1.08f; break;
                case "event_horizon": Player.Orbitals += equip ? 2 : -2; Player.OrbitSize *= equip ? 1.45f : 1f / 1.45f; Player.OrbitDamage *= equip ? 1.4f : 1f / 1.4f; Player.OrbitPulse += equip ? 1 : -1; break;
                case "zero_edge": Player.SaberDamage *= equip ? 1.5f : 1f / 1.5f; Player.SaberInterval *= equip ? 0.75f : 1f / 0.75f; Player.SaberEcho += equip ? 1 : -1; break;
                case "phoenix": Player.IncreaseVitality(10f * factor, equip && first ? 10f : 0f); break;
                case "rift_crown": Player.DamageMultiplier *= equip ? 1.22f : 1f / 1.22f; Player.XpMultiplier *= equip ? 1.25f : 1f / 1.25f; break;
                case "tamer_core": break;
                case "singularity": Player.DamageMultiplier *= equip ? 1.35f : 1f / 1.35f; Player.ProjectileMultiplier *= equip ? 1.15f : 1f / 1.15f; Player.SaberDamage *= equip ? 1.15f : 1f / 1.15f; Player.OrbitDamage *= equip ? 1.15f : 1f / 1.15f; break;
                case "immortal": Player.IncreaseVitality(30f * factor, equip && first ? 30f : 0f); Player.Regen += factor; break;
                case "godspeed": Player.MoveSpeed *= equip ? 1.25f : 1f / 1.25f; Player.AttackInterval *= equip ? 0.8f : 1f / 0.8f; Player.SaberInterval *= equip ? 0.8f : 1f / 0.8f; Player.OrbitSpeed *= equip ? 1.5f : 1f / 1.5f; break;
            }
        }

        private void ProcessRelicKillHooks()
        {
            TickHealingRelic("nano_shunt", 20, 3f);
            TickHealingRelic("soul_battery", 12, 2f);
            TickHealingRelic("immortal", 8, 2f);
        }

        private void TickHealingRelic(string id, int interval, float heal)
        {
            if (!HasRelic(id)) return;
            relicKillCounters[id] = relicKillCounters.GetValueOrDefault(id) + 1;
            if (relicKillCounters[id] < interval) return;
            relicKillCounters[id] = 0;
            Player.Heal(heal);
        }

        public bool HasRelic(string id) => relics.Exists(item => item.Definition.id == id);

        public bool TryPhoenixRevive()
        {
            if (phoenixUsed || !HasRelic("phoenix")) return false;
            phoenixUsed = true;
            hud?.ShowToast("PHOENIX KERNEL · REBOOT");
            return true;
        }

        private void Discover(string relicId)
        {
            if (!discoveredRelics.Add(relicId)) return;
            SaveCodex();
        }

        private void CompleteReward()
        {
            activeReward = null;
            hud.HideAllChoices();
            hud.Refresh();
            if (rewardQueue.Count > 0)
            {
                ProcessNextReward();
                return;
            }
            IsChoosingUpgrade = false;
            Time.timeScale = 1f;
        }

        private void HandleGameOver()
        {
            WasAbandoned = false;
            FinishGameOver();
        }

        private void FinishGameOver()
        {
            if (IsGameOver) return;
            IsGameOver = true;
            Time.timeScale = 0f;
            activeReward = null;
            rewardQueue.Clear();
            IsChoosingUpgrade = false;
            hud.HideAllChoices();
            SaveProgress.RecordRun(Score, Kills, BossKills, Level, Elapsed, Player.Class, relics);
            hud.ShowGameOver();
        }

        public void AbandonRun()
        {
            if (IsAwaitingStart || IsGameOver) return;
            WasAbandoned = true;
            FinishGameOver();
        }

        public void Restart()
        {
            Time.timeScale = 1f;
            EnemyController.ClearAll();
            EnemyProjectile.ClearAll();
            Projectile.ClearAll();
            ExperienceGem.ClearAll();
            Level = 1;
            Xp = 0;
            XpToNext = GameBalance.XpForNextLevel(1);
            Kills = BossKills = BossFailures = 0;
            Elapsed = 0f;
            ActiveBoss = null;
            IsChoosingUpgrade = IsGameOver = false;
            WasAbandoned = false;
            activeReward = null;
            rewardQueue.Clear();
            IsAwaitingStart = false;
            upgradeRanks.Clear();
            relics.Clear();
            relicKillCounters.Clear();
            phoenixUsed = false;
            foreach (var upgrade in upgradePool) upgrade.ResetRank();
            Player.ResetForRun();
            hud.HideAllChoices();
            hud.HideGameOver();
            hud.HideBoss();
            hud.Refresh();
        }

        public void ReturnToTitle()
        {
            Restart();
            IsAwaitingStart = true;
            hud.ShowTitle();
        }

        public void EnableRewardQueueSmoke()
        {
            activeReward = null;
            rewardQueue.Clear();
            IsChoosingUpgrade = false;
            hud.HideAllChoices();
            EnqueueReward(RewardType.Upgrade);
            EnqueueReward(RewardType.Relic);
            EnqueueReward(RewardType.Class);
        }

        private void BuildUpgradePool()
        {
            foreach (var content in ContentDatabase.Catalog.upgrades)
                upgradePool.Add(new UpgradeDefinition(content));
        }

        private void LoadCodex()
        {
            var saved = PlayerPrefs.GetString("NeonArcana.DiscoveredRelics", "");
            foreach (var id in saved.Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries)) discoveredRelics.Add(id);
        }

        private void SaveCodex() => PlayerPrefs.SetString("NeonArcana.DiscoveredRelics", string.Join(",", discoveredRelics));

        public bool IsRelicDiscovered(string relicId) => discoveredRelics.Contains(relicId);

        public string CodexSummary()
        {
            var completedClasses = SaveProgress.ClassCount;
            return $"유물 도감 {discoveredRelics.Count}/{ContentDatabase.Catalog.relics.Count}\n전직 기록 {completedClasses}/{ContentDatabase.Catalog.classes.Count}\n최고 점수 {SaveProgress.HighScore:N0}";
        }

        public void EnablePhaseTwoShowcase()
        {
            EnableShowcase("PHASE 2 · CONTENT SHOWCASE");
        }

        public void EnablePhaseThreeShowcase()
        {
            EnableShowcase("PHASE 3 · FIDELITY SHOWCASE");
        }

        private void EnableShowcase(string toast)
        {
            StartRun();
            Elapsed = 620f;
            ApplyUpgradeEffect("orbit");
            ApplyUpgradeEffect("orbit");
            ApplyUpgradeEffect("saber");
            ApplyUpgradeEffect("saber");
            ApplyUpgradeEffect("blast");
            ApplyUpgradeEffect("chain");
            EquipRelic(ContentDatabase.Catalog.relics.Find(item => item.id == "rift_crown"));
            Player.SetClass(ArcanaClass.Thor);
            foreach (EnemyArchetype type in Enum.GetValues(typeof(EnemyArchetype)))
                EnemyController.Spawn(Player.transform.position + (Vector3)UnityEngine.Random.insideUnitCircle * 4f, GameBalance.DifficultyScale(Elapsed), type);
            EnemyController.SpawnBoss(Player.transform.position + Vector3.right * 4.5f, 2, Elapsed);
            hud?.ShowToast(toast);
        }
    }

    public sealed class UpgradeDefinition
    {
        public string Id { get; }
        public string Icon { get; }
        public string Name { get; }
        public string Description { get; }
        public int MaxRank { get; }
        public float Weight { get; }
        public string Prerequisite { get; }
        public int UnlockLevel { get; }
        public int Rank { get; private set; }

        public UpgradeDefinition(UpgradeContent content)
        {
            Id = content.id;
            Icon = content.icon;
            Name = content.name;
            Description = content.description;
            MaxRank = content.maxRank;
            Weight = content.weight;
            Prerequisite = content.prerequisite;
            UnlockLevel = content.unlockLevel;
        }

        public void IncreaseRank() => Rank++;
        public void ResetRank() => Rank = 0;
    }

    public sealed class RelicInstance
    {
        public RelicContent Definition { get; }
        public int Level { get; set; } = 1;
        public RelicInstance(RelicContent definition) => Definition = definition;
    }
}

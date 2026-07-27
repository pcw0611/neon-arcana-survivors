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

        private readonly struct RewardRequest
        {
            public readonly RewardType Type;
            public readonly string Source;
            public readonly int Tier;
            public RewardRequest(RewardType type, string source = "", int tier = 0)
            {
                Type = type;
                Source = source;
                Tier = tier;
            }
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
        public string ActiveRewardType => activeReward?.Type.ToString() ?? "None";
        public int LastRelicAwardRarity { get; private set; } = -1;

        private GameHud hud;
        private readonly List<UpgradeDefinition> upgradePool = new();
        private readonly List<RelicInstance> relics = new();
        private readonly Dictionary<string, int> upgradeRanks = new();
        private readonly Dictionary<string, int> relicKillCounters = new();
        private readonly HashSet<string> discoveredRelics = new();
        private readonly Queue<RewardRequest> rewardQueue = new();
        private readonly System.Random random = new(61061);
        private bool phoenixUsed;
        private int slotPity;
        private RewardRequest? activeReward;

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
            EnqueueReward(RewardType.Relic, "boss", boss.BossTier);
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

        private void EnqueueReward(RewardType reward, string source = "", int tier = 0)
        {
            rewardQueue.Enqueue(new RewardRequest(reward, source, tier));
            ProcessNextReward();
        }

        private void ProcessNextReward()
        {
            if (IsGameOver || IsAwaitingStart || activeReward.HasValue || rewardQueue.Count == 0) return;
            activeReward = rewardQueue.Dequeue();
            IsChoosingUpgrade = true;
            Time.timeScale = 0f;
            switch (activeReward.Value.Type)
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
                    var request = activeReward.Value;
                    var relic = RollRelicAward(request.Source, request.Tier);
                    hud.ShowRelicRoulette(relic, () => AwardRelic(relic));
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
                if (upgrade.Rank < EffectiveMaxRank(upgrade) && IsUpgradeEligible(upgrade)) available.Add(upgrade);

            var choices = new List<UpgradeDefinition>();
            var affinity = BuildAffinityScores();
            while (choices.Count < Mathf.Min(2, count) && available.Count > 0)
            {
                var total = 0f;
                foreach (var upgrade in available) total += UpgradeWeight(upgrade, affinity);
                var roll = (float)random.NextDouble() * total;
                for (var i = 0; i < available.Count; i++)
                {
                    roll -= UpgradeWeight(available[i], affinity);
                    if (roll > 0f) continue;
                    choices.Add(available[i]);
                    available.RemoveAt(i);
                    break;
                }
            }

            if (choices.Count < count && available.Count > 0)
            {
                var uniform = random.Next(available.Count);
                choices.Add(available[uniform]);
                available.RemoveAt(uniform);
            }

            var slot = upgradePool.Find(item => item.Id == "relic_slot");
            var slotEligible = slot != null && slot.Rank < EffectiveMaxRank(slot) && IsUpgradeEligible(slot);
            if (slotEligible && !choices.Contains(slot))
            {
                slotPity++;
                if (slotPity >= 2 && choices.Count > 0)
                {
                    choices[choices.Count - 1] = slot;
                    slotPity = 0;
                }
            }
            else if (slot != null && choices.Contains(slot))
            {
                slotPity = 0;
            }
            return choices;
        }

        private bool IsUpgradeEligible(UpgradeDefinition definition)
        {
            if (!definition.Id.StartsWith("limit_master_", StringComparison.Ordinal)
                && Level < definition.UnlockLevel) return false;
            return definition.Id switch
            {
                "relic_slot" => Player.RelicSlots < 7
                    && relics.Count >= Player.RelicSlots
                    && Level >= RelicSlotUnlockLevel(definition.Rank),
                "limit_master_projectile" or "limit_master_saber" or "limit_master_orbit" or "limit_master_thor"
                    => MasteryRequirementSatisfied(definition.Id, upgradeRanks, Player.Class),
                _ => definition.Prerequisite switch
                {
                    "orbit" => Player.Orbitals > 0,
                    "saber" => Player.SaberLevel > 0,
                    _ => true
                }
            };
        }

        private static int RelicSlotUnlockLevel(int rank) => 8 + rank * 7;

        private static bool MasteryRequirementSatisfied(
            string limitId,
            IReadOnlyDictionary<string, int> ranks,
            ArcanaClass playerClass)
        {
            return limitId switch
            {
                "limit_master_projectile" => ranks.GetValueOrDefault("multishot") >= 7,
                "limit_master_saber" => ranks.GetValueOrDefault("saber") >= 7,
                "limit_master_orbit" => ranks.GetValueOrDefault("orbit") >= 7,
                "limit_master_thor" => playerClass == ArcanaClass.Thor && ranks.GetValueOrDefault("chain") >= 7,
                _ => false
            };
        }

        public int EffectiveMaxRank(UpgradeDefinition definition)
        {
            return definition.Id == "chain" && Player != null && Player.Class == ArcanaClass.Thor
                ? 7
                : definition.MaxRank;
        }

        private Dictionary<string, float> BuildAffinityScores()
        {
            var result = new Dictionary<string, float>();
            foreach (var upgrade in upgradePool)
            {
                if (upgrade.Rank <= 0) continue;
                foreach (var tag in upgrade.Tags)
                    result[tag] = result.GetValueOrDefault(tag) + upgrade.Rank;
            }
            foreach (var relic in relics)
            {
                var score = (1.5f + relic.Definition.rarity * 0.5f) * relic.Level;
                foreach (var tag in relic.Tags)
                    result[tag] = result.GetValueOrDefault(tag) + score;
            }
            return result;
        }

        private static float UpgradeWeight(UpgradeDefinition upgrade, IReadOnlyDictionary<string, float> affinity)
        {
            var highest = 0f;
            var secondary = 0f;
            foreach (var tag in upgrade.Tags)
            {
                var value = affinity.GetValueOrDefault(tag);
                if (value > highest)
                {
                    secondary += highest;
                    highest = value;
                }
                else
                {
                    secondary += value;
                }
            }
            highest = Mathf.Min(8f, highest);
            secondary = Mathf.Min(3f, secondary);
            var owned = upgrade.Rank > 0 ? 1.28f : 1f;
            return Mathf.Max(0.001f, upgrade.Weight * owned * (1f + highest * 0.24f + secondary * 0.08f));
        }

        public string ValidateUpgradeParityRules()
        {
            var ranks = new Dictionary<string, int>
            {
                ["multishot"] = 7,
                ["saber"] = 7,
                ["orbit"] = 7,
                ["chain"] = 7
            };
            if (!MasteryRequirementSatisfied("limit_master_projectile", ranks, ArcanaClass.None)
                || !MasteryRequirementSatisfied("limit_master_saber", ranks, ArcanaClass.None)
                || !MasteryRequirementSatisfied("limit_master_orbit", ranks, ArcanaClass.None)
                || MasteryRequirementSatisfied("limit_master_thor", ranks, ArcanaClass.None)
                || !MasteryRequirementSatisfied("limit_master_thor", ranks, ArcanaClass.Thor))
                throw new InvalidOperationException("Mastery prerequisite parity failed.");
            if (RelicSlotUnlockLevel(0) != 8 || RelicSlotUnlockLevel(1) != 15
                || RelicSlotUnlockLevel(2) != 22 || RelicSlotUnlockLevel(3) != 29)
                throw new InvalidOperationException("Relic slot level gates changed.");

            var power = upgradePool.Find(item => item.Id == "power");
            var critical = upgradePool.Find(item => item.Id == "critical");
            var slot = upgradePool.Find(item => item.Id == "relic_slot");
            if (power == null || critical == null || slot == null
                || power.Tags.Count != 3 || critical.Tags.Count != 2 || Mathf.Abs(slot.Weight - 2.4f) > 0.001f)
                throw new InvalidOperationException("Upgrade tag or base weight parity failed.");
            var affinity = new Dictionary<string, float>
            {
                ["projectile"] = 8f,
                ["saber"] = 3f,
                ["orbit"] = 2f
            };
            if (UpgradeWeight(power, affinity) <= power.Weight)
                throw new InvalidOperationException("Build affinity did not increase the weighted choice score.");
            return "affinity=tagWeighted mastery=exact slotPity=2";
        }

        public string UpgradeChoiceDescription(UpgradeDefinition upgrade)
        {
            var rank = upgrade.Rank;
            if (upgrade.Id == "orbit")
                return rank == 0 ? "공격 위성 +1 · 위성 빌드 개방" : "공격 위성 +1";
            if (upgrade.Id == "saber")
                return rank == 0 ? "초근접 광검 개방 · 아크 실드에 2.4배 피해" : "광검 피해 +25%";
            if (upgrade.Id == "multishot")
                return rank == 0 ? "성좌탄 +1 · 투사체 집중 빌드 개방" : "동시에 발사하는 성좌탄 +1";
            if (upgrade.Id == "orbit_pulse" && rank > 0)
            {
                var current = Mathf.Max(1.8f, 5.3f - rank * 0.8f);
                var next = Mathf.Max(1.8f, 5.3f - (rank + 1) * 0.8f);
                return $"충격파 발동 간격 0.8초 감소 · {current:0.0}초 → {next:0.0}초";
            }
            if (upgrade.Id == "chain" && Player != null && Player.Class == ArcanaClass.Thor)
                return "모든 공격 명중 시 240 이내 낙뢰 대상 +1/LV (최대 7) · 쉴드 대상 추가 피해";
            if (upgrade.Id.StartsWith("limit_master_", StringComparison.Ordinal))
                return $"마스터 특수기 피해 +4%p (무한) · 범위 +2%p / 공격 주기 -1%p (각 LV.20까지) · 현재 LV.{rank}";
            if (upgrade.Id == "limit_power")
            {
                var current = Mathf.Min(20, rank) * 2f + Mathf.Max(0, rank - 20) * 0.5f;
                return $"모든 공격 피해 +{(rank < 20 ? 2f : 0.5f):0.#}%p · 현재 +{current:0.#}%";
            }
            return upgrade.Description;
        }

        public string UpgradeChoiceRank(UpgradeDefinition upgrade, int shortcut)
        {
            var next = upgrade.Rank + 1;
            if (upgrade.Id.StartsWith("limit_", StringComparison.Ordinal))
                return $"한계돌파 LV.{upgrade.Rank} → LV.{next} · [{shortcut}]";
            var mastery = upgrade.Id == "multishot" || upgrade.Id == "saber" || upgrade.Id == "orbit"
                || upgrade.Id == "chain" && Player != null && Player.Class == ArcanaClass.Thor;
            return mastery && next >= EffectiveMaxRank(upgrade)
                ? $"MAX LV · MASTERY · [{shortcut}]"
                : $"RANK {upgrade.Rank} → {next} · [{shortcut}]";
        }

        private void ApplyUpgrade(UpgradeDefinition upgrade)
        {
            upgrade.IncreaseRank();
            upgradeRanks[upgrade.Id] = upgrade.Rank;
            ApplyUpgradeEffect(upgrade.Id);
            CompleteReward();
            if ((upgrade.Id == "multishot" || upgrade.Id == "saber" || upgrade.Id == "orbit"
                 || upgrade.Id == "chain" && Player.Class == ArcanaClass.Thor)
                && upgrade.Rank >= EffectiveMaxRank(upgrade))
                hud.ShowToast($"{upgrade.Name} · MAX MASTERY");
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

        private RelicContent RollRelicAward(string source, int tier)
        {
            var available = new List<RelicContent>(ContentDatabase.Catalog.relics);
            available.RemoveAll(item => item.id == "tamer_core");
            var rarity = RollRelicRarity(source, tier);
            var candidates = new List<RelicContent>();
            for (var distance = 0; distance < 5 && candidates.Count == 0; distance++)
            {
                var high = rarity + distance;
                var low = rarity - distance;
                if (high <= 4) candidates = available.FindAll(item => item.rarity == high);
                if (candidates.Count == 0 && low >= 0) candidates = available.FindAll(item => item.rarity == low);
            }
            if (candidates.Count == 0) candidates = available;

            var affinity = BuildAffinityScores();
            var total = 0f;
            foreach (var candidate in candidates) total += RelicAwardWeight(candidate, affinity);
            var roll = (float)random.NextDouble() * total;
            foreach (var candidate in candidates)
            {
                roll -= RelicAwardWeight(candidate, affinity);
                if (roll <= 0f)
                {
                    LastRelicAwardRarity = candidate.rarity;
                    return candidate;
                }
            }
            LastRelicAwardRarity = candidates[candidates.Count - 1].rarity;
            return candidates[candidates.Count - 1];
        }

        private int RollRelicRarity(string source, int tier)
        {
            float[] weights = Elapsed < 60f ? new[] { 62f, 27f, 9f, 2f, 0f }
                : Elapsed < 120f ? new[] { 48f, 29f, 17f, 5.5f, 0.5f }
                : Elapsed < 180f ? new[] { 35f, 30f, 23f, 10f, 2f }
                : Elapsed < 300f ? new[] { 23f, 28f, 29f, 16f, 4f }
                : Elapsed < 480f ? new[] { 13f, 23f, 31f, 25f, 8f }
                : Elapsed < 720f ? new[] { 6f, 17f, 30f, 32f, 15f }
                : new[] { 2f, 9f, 24f, 39f, 26f };
            var total = 0f;
            foreach (var weight in weights) total += weight;
            var roll = (float)random.NextDouble() * total;
            var rarity = 0;
            for (var i = 0; i < weights.Length; i++)
            {
                roll -= weights[i];
                if (roll <= 0f) { rarity = i; break; }
            }
            if (source == "boss") rarity = Mathf.Max(rarity, Mathf.Min(3, tier));
            var promotion = source == "boss" ? 0.18f + tier * 0.12f : source == "treasure" ? 0.26f : 0f;
            if (random.NextDouble() < promotion) rarity++;
            return Mathf.Clamp(rarity, 0, 4);
        }

        private float RelicAwardWeight(RelicContent relic, IReadOnlyDictionary<string, float> affinity)
        {
            var best = 0f;
            foreach (var tag in RelicInstance.TagsFor(relic.id))
                best = Mathf.Max(best, affinity.GetValueOrDefault(tag));
            var owned = relics.Exists(item => item.Definition.id == relic.id) ? 1.18f : 1.35f;
            return owned * Mathf.Min(1.8f, 1f + best * 0.12f);
        }

        private void AwardRelic(RelicContent relic)
        {
            var existing = relics.Find(item => item.Definition.id == relic.id);
            if (existing != null)
            {
                existing.Level++;
                ApplyRelicEffect(relic, true, false);
                Discover(relic.id);
                hud.ShowRelicResult(existing, $"유물 레벨 업 · LV.{existing.Level}", CompleteReward);
                return;
            }
            if (relics.Count < Player.RelicSlots)
            {
                EquipRelic(relic);
                var equipped = relics.Find(item => item.Definition.id == relic.id);
                hud.ShowRelicResult(equipped, "새 유물 획득", CompleteReward);
                return;
            }
            var weakest = 0;
            for (var i = 1; i < relics.Count; i++)
                if (relics[i].Level < relics[weakest].Level
                    || relics[i].Level == relics[weakest].Level && relics[i].Definition.rarity < relics[weakest].Definition.rarity)
                    weakest = i;
            var oldName = relics[weakest].Definition.name;
            ReplaceRelic(weakest, relic);
            hud.ShowRelicResult(relics[weakest], $"{oldName} → {relic.name}", CompleteReward);
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
            hud.ShowToast($"{old.Definition.name} → {definition.name}");
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
            slotPity = 0;
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

        public void EnableRelicFlowSmoke()
        {
            EnqueueReward(RewardType.Relic, "boss", 3);
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
            ApplyShowcaseUpgrade("orbit");
            ApplyShowcaseUpgrade("orbit");
            ApplyShowcaseUpgrade("saber");
            ApplyShowcaseUpgrade("saber");
            ApplyShowcaseUpgrade("blast");
            ApplyShowcaseUpgrade("chain");
            EquipRelic(ContentDatabase.Catalog.relics.Find(item => item.id == "rift_crown"));
            Player.SetClass(ArcanaClass.Thor);
            foreach (EnemyArchetype type in Enum.GetValues(typeof(EnemyArchetype)))
                EnemyController.Spawn(Player.transform.position + (Vector3)UnityEngine.Random.insideUnitCircle * 4f, GameBalance.DifficultyScale(Elapsed), type);
            EnemyController.SpawnBoss(Player.transform.position + Vector3.right * 4.5f, 2, Elapsed);
            hud?.ShowToast(toast);
        }

        private void ApplyShowcaseUpgrade(string id)
        {
            var definition = upgradePool.Find(item => item.Id == id);
            if (definition == null || definition.Rank >= EffectiveMaxRank(definition)) return;
            definition.IncreaseRank();
            upgradeRanks[id] = definition.Rank;
            ApplyUpgradeEffect(id);
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
        public IReadOnlyList<string> Tags { get; }

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
            Tags = UpgradeTags(content.id);
        }

        public void IncreaseRank() => Rank++;
        public void ResetRank() => Rank = 0;

        private static string[] UpgradeTags(string id)
        {
            return id switch
            {
                "power" => new[] { "projectile", "saber", "orbit" },
                "critical" => new[] { "projectile", "saber" },
                "haste" or "multishot" or "pierce" or "size" => new[] { "projectile" },
                "blast" or "chain" => new[] { "projectile", "area" },
                "orbit" or "orbit_speed" or "orbit_size" or "orbit_range" => new[] { "orbit" },
                "orbit_shock" or "orbit_pulse" => new[] { "orbit", "area" },
                "orbit_guard" => new[] { "orbit", "survival" },
                "saber" or "saber_reach" or "saber_haste" or "saber_echo" => new[] { "saber" },
                "saber_guard" => new[] { "saber", "survival" },
                "speed" => new[] { "mobility" },
                "magnet" or "fortune" or "limit_growth" => new[] { "growth" },
                "vital" or "regen" or "guard" or "limit_vital" => new[] { "survival" },
                "relic_slot" => new[] { "utility" },
                "limit_master_projectile" => new[] { "projectile" },
                "limit_master_saber" => new[] { "saber" },
                "limit_master_orbit" => new[] { "orbit" },
                "limit_master_thor" => new[] { "projectile", "area" },
                "limit_power" => new[] { "projectile", "saber", "orbit" },
                _ => Array.Empty<string>()
            };
        }
    }

    public sealed class RelicInstance
    {
        public RelicContent Definition { get; }
        public int Level { get; set; } = 1;
        public IReadOnlyList<string> Tags { get; }
        public RelicInstance(RelicContent definition)
        {
            Definition = definition;
            Tags = TagsFor(definition.id);
        }

        public static string[] TagsFor(string id)
        {
            return id switch
            {
                "arc_cell" or "singularity" => new[] { "projectile", "saber", "orbit" },
                "rift_crown" => new[] { "projectile", "saber", "orbit", "growth" },
                "blood_cap" or "nano_shunt" or "phoenix" or "immortal" => new[] { "survival" },
                "magnet_prism" => new[] { "growth" },
                "hunter_lens" or "execution" => new[] { "projectile", "saber" },
                "split_core" or "echo_chamber" => new[] { "projectile" },
                "orbit_gear" => new[] { "orbit" },
                "edge_lens" or "zero_edge" => new[] { "saber" },
                "gravity_halo" or "tamer_core" => new[] { "area", "survival" },
                "soul_battery" => new[] { "survival", "projectile", "saber", "orbit" },
                "event_horizon" => new[] { "orbit", "area" },
                "chain_detonator" => new[] { "area" },
                "godspeed" => new[] { "mobility", "projectile", "saber", "orbit" },
                _ => Array.Empty<string>()
            };
        }
    }
}

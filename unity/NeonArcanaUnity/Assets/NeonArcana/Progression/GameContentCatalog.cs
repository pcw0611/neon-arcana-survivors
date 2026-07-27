using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeonArcana
{
    public enum EnemyArchetype
    {
        Stalker,
        Gunner,
        Charger,
        Warder,
        Bomber,
        Splitter
    }

    public enum BossKind
    {
        Oni,
        Seraph,
        Witch,
        Dragon
    }

    public enum ArcanaClass
    {
        None,
        SilverBullet,
        ShadowMaster,
        Mechanic,
        Thor,
        Wanderer
    }

    [Serializable]
    public sealed class UpgradeContent
    {
        public string id;
        public string icon;
        public string name;
        [TextArea] public string description;
        public int maxRank;
        public float weight = 1f;
        public string prerequisite;
        public int unlockLevel;
    }

    [Serializable]
    public sealed class RelicContent
    {
        public string id;
        public string icon;
        public string name;
        [TextArea] public string description;
        [Range(0, 4)] public int rarity;
    }

    [Serializable]
    public sealed class EnemyContent
    {
        public EnemyArchetype archetype;
        public string koreanName;
        public float unlockTime;
        public float maximumChance;
        public float hpMultiplier;
        public float speedMultiplier;
        public Color color;
    }

    [Serializable]
    public sealed class BossContent
    {
        public BossKind kind;
        public string koreanName;
        public int spriteColumn;
        public int spriteRow;
        public Color color;
    }

    [Serializable]
    public sealed class BossOptionContent
    {
        public string id;
        public string koreanName;
        [Range(0, 4)] public int rarity;
    }

    [Serializable]
    public sealed class ClassContent
    {
        public ArcanaClass classId;
        public string icon;
        public string koreanName;
        [Range(1, 5)] public int difficulty;
        [TextArea] public string description;
    }

    [CreateAssetMenu(fileName = "NeonArcanaContent", menuName = "Neon Arcana/Content Catalog")]
    public sealed class GameContentCatalog : ScriptableObject
    {
        public List<UpgradeContent> upgrades = new();
        public List<RelicContent> relics = new();
        public List<EnemyContent> enemies = new();
        public List<BossContent> bosses = new();
        public List<BossOptionContent> bossOptions = new();
        public List<ClassContent> classes = new();
    }

    public static class ContentDatabase
    {
        private static GameContentCatalog catalog;

        public static GameContentCatalog Catalog
        {
            get
            {
                if (catalog == null)
                {
                    catalog = Resources.Load<GameContentCatalog>("Data/NeonArcanaContent");
                    if (catalog == null) catalog = CreateDefault();
                }
                return catalog;
            }
        }

        public static GameContentCatalog CreateDefault()
        {
            var result = ScriptableObject.CreateInstance<GameContentCatalog>();
            AddUpgrades(result.upgrades);
            AddRelics(result.relics);
            AddEnemies(result.enemies);
            AddBosses(result.bosses);
            AddBossOptions(result.bossOptions);
            AddClasses(result.classes);
            return result;
        }

        public static float RelicSalvageRatio(int rarity)
        {
            var values = new[] { 0.2f, 0.36f, 0.58f, 0.86f, 1.25f };
            return values[Mathf.Clamp(rarity, 0, values.Length - 1)];
        }

        public static string RarityName(int rarity)
        {
            var values = new[] { "일반", "레어", "유니크", "전설", "신화" };
            return values[Mathf.Clamp(rarity, 0, values.Length - 1)];
        }

        public static Color RarityColor(int rarity)
        {
            var html = new[] { "#B8C4D8", "#4DFFA4", "#51BFFF", "#C46CFF", "#FFBE38" };
            ColorUtility.TryParseHtmlString(html[Mathf.Clamp(rarity, 0, html.Length - 1)], out var color);
            return color;
        }

        private static void AddUpgrades(List<UpgradeContent> list)
        {
            AddUpgrade(list, "power", "◆", "룬 증폭", "모든 공격 피해량 +12%", 10);
            AddUpgrade(list, "haste", "⌁", "영창 가속", "성좌탄 공격 간격 13% 감소", 7);
            AddUpgrade(list, "multishot", "≋", "쌍성 궤도", "동시에 발사하는 성좌탄 +1", 7);
            AddUpgrade(list, "pierce", "↠", "위상 관통", "성좌탄 관통 횟수 +1", 6);
            AddUpgrade(list, "critical", "✦", "운명 간섭", "치명타 확률 +8%, 배율 +0.18", 6);
            AddUpgrade(list, "blast", "✺", "붕괴 잔향", "명중 폭발 반경 +22, 주변 피해 35%", 6);
            AddUpgrade(list, "chain", "ϟ", "연쇄 낙뢰", "명중 시 연쇄 대상 +1, 피해 28%", 5);
            AddUpgrade(list, "size", "◉", "거대 성핵", "성좌탄 크기 +18%, 피해 +10%", 6);
            AddUpgrade(list, "orbit", "☄", "수호 위성", "공격 위성 +1, 위성 빌드 개방", 7);
            AddUpgrade(list, "orbit_speed", "⟳", "초고속 공전", "위성 회전 속도 +24%", 5, "orbit");
            AddUpgrade(list, "orbit_size", "⊚", "거대 위성핵", "위성 크기 +20%, 피해 +16%", 5, "orbit");
            AddUpgrade(list, "orbit_range", "◎", "이중 공전면", "공전 반경 +16, 위성 피해 +10%", 4, "orbit");
            AddUpgrade(list, "orbit_shock", "✹", "초신성 방전", "위성 명중 시 방전 확률 +12%p", 4, "orbit");
            AddUpgrade(list, "orbit_guard", "⬡", "성환 요격막", "위성의 적 탄환 요격 확률 +6%p", 5, "orbit");
            AddUpgrade(list, "orbit_pulse", "◌", "맥동 성환", "주기적으로 모든 위성이 충격파 방출", 3, "orbit");
            AddUpgrade(list, "saber", "╱", "아스트랄 광검", "광검 레벨 +1, 피해 +25%", 7);
            AddUpgrade(list, "saber_reach", "⌒", "월광 검로", "광검 사거리 +20, 베기 각도 확대", 5, "saber");
            AddUpgrade(list, "saber_haste", "≪", "찰나 발도", "광검 공격 간격 17% 감소", 5, "saber");
            AddUpgrade(list, "saber_echo", "〽", "잔상 연격", "광검 추가 잔상 베기 +1", 3, "saber");
            AddUpgrade(list, "saber_guard", "◇", "검막 반사", "광검 사용 중 방어 확률 +7%p", 4, "saber");
            AddUpgrade(list, "speed", "≫", "공간 도약", "이동 속도 +11%", 6);
            AddUpgrade(list, "magnet", "⌾", "중력 우물", "경험치 흡수 범위 +85", 6);
            AddUpgrade(list, "vital", "♥", "생명 결계", "최대 체력 +8, 체력 10 회복", 7);
            AddUpgrade(list, "regen", "♧", "재생 술식", "초당 체력 회복 +0.35", 6);
            AddUpgrade(list, "guard", "⬡", "성좌 방벽", "피격 무효 확률 +6%p", 6);
            AddUpgrade(list, "fortune", "♢", "마력 정제", "획득 경험치 +22%", 5);
            AddUpgrade(list, "relic_slot", "▣", "차원 수납 확장", "유물 슬롯 +1 (최대 7)", 4, "", 8, 2.4f);
            AddUpgrade(list, "limit_master_projectile", "∞", "성좌포 한계돌파", "마스터 성좌포 피해와 범위 강화", 999, "projectile", 30, 0.9f);
            AddUpgrade(list, "limit_master_saber", "∞", "광검 한계돌파", "마스터 광검 피해와 범위 강화", 999, "saber", 30, 0.9f);
            AddUpgrade(list, "limit_master_orbit", "∞", "위성 한계돌파", "마스터 위성 피해와 범위 강화", 999, "orbit", 30, 0.9f);
            AddUpgrade(list, "limit_master_thor", "∞", "토르의 망치 한계돌파", "망치 피해와 범위 강화", 999, "", 30, 0.9f);
            AddUpgrade(list, "limit_power", "∞", "한계 돌파 · 힘", "모든 공격 피해량 점진 증가", 999, "", 35, 0.12f);
            AddUpgrade(list, "limit_vital", "∞", "한계 돌파 · 생명", "최대 체력 +5, 체력 5 회복", 999, "", 35, 0.12f);
            AddUpgrade(list, "limit_growth", "∞", "한계 돌파 · 공명", "경험치 +7%, 흡수 범위 +20", 999, "", 35, 0.1f);
        }

        private static void AddUpgrade(List<UpgradeContent> list, string id, string icon, string name, string description, int maxRank, string prerequisite = "", int unlockLevel = 0, float weight = 1f)
        {
            list.Add(new UpgradeContent { id = id, icon = icon, name = name, description = description, maxRank = maxRank, prerequisite = prerequisite, unlockLevel = unlockLevel, weight = weight });
        }

        private static void AddRelics(List<RelicContent> list)
        {
            AddRelic(list, "arc_cell", "◆", "증폭 아크 셀", "모든 공격 피해 +10%", 0);
            AddRelic(list, "blood_cap", "♥", "혈류 축전지", "최대 체력 +12, 최초 획득 시 12 회복", 0);
            AddRelic(list, "magnet_prism", "⌾", "자력 프리즘", "흡수 범위 +30%, 경험치 +10%", 0);
            AddRelic(list, "hunter_lens", "✦", "사냥꾼의 렌즈", "치명타 +8%, 치명 피해 +0.2", 0);
            AddRelic(list, "split_core", "≋", "분열 코어", "4번째 성좌탄 일제사격마다 투사체 +2", 1);
            AddRelic(list, "orbit_gear", "⟳", "성환 가속기", "위성 +1, 속도 +30%, 피해 +30%", 1);
            AddRelic(list, "edge_lens", "╱", "근접 초점 렌즈", "광검 피해 +45%, 사거리 +18", 1);
            AddRelic(list, "nano_shunt", "♧", "나노 회복 분기기", "재생 +0.45, 20킬마다 체력 3 회복", 1);
            AddRelic(list, "execution", "†", "처형 프로토콜", "일반 적 체력 15% 미만 즉시 처형", 2);
            AddRelic(list, "echo_chamber", "〽", "공명 탄실", "6번째 일제사격이 70% 피해로 반복", 2);
            AddRelic(list, "gravity_halo", "◉", "중력 후광", "주변 일반 적 이동 속도 24% 감소", 2);
            AddRelic(list, "soul_battery", "♠", "영혼 배터리", "12킬마다 체력 2 회복, 모든 피해 +8%", 2);
            AddRelic(list, "event_horizon", "◎", "사건의 지평선", "위성 +2, 크기 +45%, 피해 +40%, 충격파", 3);
            AddRelic(list, "zero_edge", "⌁", "제로 엣지", "광검 피해 +50%, 속도 +33%, 잔상 +1", 3);
            AddRelic(list, "phoenix", "♨", "불사조 커널", "치명상 1회 무시, 체력 40% 부활", 3);
            AddRelic(list, "rift_crown", "♛", "균열 왕관", "모든 피해 +22%, 경험치 +25%", 3);
            AddRelic(list, "chain_detonator", "☢", "연쇄 기폭 코어", "자폭 폭발이 주변 적에게 피해", 3);
            AddRelic(list, "tamer_core", "⛓", "조련의 코어", "보스 처치 시 확률적으로 아군화", 3);
            AddRelic(list, "singularity", "✺", "아르카나 특이점", "모든 피해 +35%, 빌드별 피해 +15%", 4);
            AddRelic(list, "immortal", "∞", "불멸 회로", "최대 체력 +30, 재생 +1, 8킬마다 회복", 4);
            AddRelic(list, "godspeed", "»", "신속 연산기관", "이동·성좌탄·광검·위성 속도 증가", 4);
        }

        private static void AddRelic(List<RelicContent> list, string id, string icon, string name, string description, int rarity)
        {
            list.Add(new RelicContent { id = id, icon = icon, name = name, description = description, rarity = rarity });
        }

        private static void AddEnemies(List<EnemyContent> list)
        {
            list.Add(new EnemyContent { archetype = EnemyArchetype.Stalker, koreanName = "추적자", unlockTime = 0f, maximumChance = 1f, hpMultiplier = 1f, speedMultiplier = 1f, color = new Color(0.9f, 0.24f, 1f) });
            list.Add(new EnemyContent { archetype = EnemyArchetype.Gunner, koreanName = "사수", unlockTime = 45f, maximumChance = 0.13f, hpMultiplier = 1.25f, speedMultiplier = 1f, color = new Color(0.27f, 0.87f, 1f) });
            list.Add(new EnemyContent { archetype = EnemyArchetype.Charger, koreanName = "돌격병", unlockTime = 110f, maximumChance = 0.12f, hpMultiplier = 1.45f, speedMultiplier = 1f, color = new Color(1f, 0.7f, 0.26f) });
            list.Add(new EnemyContent { archetype = EnemyArchetype.Warder, koreanName = "방벽병", unlockTime = 230f, maximumChance = 0.08f, hpMultiplier = 1.35f, speedMultiplier = 0.82f, color = new Color(0.39f, 0.96f, 1f) });
            list.Add(new EnemyContent { archetype = EnemyArchetype.Bomber, koreanName = "자폭 드론", unlockTime = 340f, maximumChance = 0.09f, hpMultiplier = 1.08f, speedMultiplier = 1.52f, color = new Color(1f, 0.27f, 0.43f) });
            list.Add(new EnemyContent { archetype = EnemyArchetype.Splitter, koreanName = "분열체", unlockTime = 440f, maximumChance = 0.08f, hpMultiplier = 1.6f, speedMultiplier = 1f, color = new Color(0.6f, 0.45f, 1f) });
        }

        private static void AddBosses(List<BossContent> list)
        {
            list.Add(new BossContent { kind = BossKind.Oni, koreanName = "오니", spriteColumn = 0, spriteRow = 0, color = new Color(1f, 0.25f, 0.42f) });
            list.Add(new BossContent { kind = BossKind.Seraph, koreanName = "세라프", spriteColumn = 1, spriteRow = 0, color = new Color(0.35f, 0.9f, 1f) });
            list.Add(new BossContent { kind = BossKind.Witch, koreanName = "균열 마녀", spriteColumn = 0, spriteRow = 1, color = new Color(0.75f, 0.35f, 1f) });
            list.Add(new BossContent { kind = BossKind.Dragon, koreanName = "사이버 드래곤", spriteColumn = 1, spriteRow = 1, color = new Color(1f, 0.72f, 0.2f) });
        }

        private static void AddBossOptions(List<BossOptionContent> list)
        {
            AddBossOption(list, "swift", "신속", 0);
            AddBossOption(list, "unstable", "불안정", 0);
            AddBossOption(list, "hunter", "추적자", 1);
            AddBossOption(list, "echo", "메아리", 1);
            AddBossOption(list, "armored", "중장갑", 2);
            AddBossOption(list, "overclock", "과부하", 2);
            AddBossOption(list, "minefield", "지뢰밭", 3);
            AddBossOption(list, "regen", "재생", 4);
            AddBossOption(list, "shock_aura", "감전 오라", 4);
        }

        private static void AddBossOption(List<BossOptionContent> list, string id, string name, int rarity)
        {
            list.Add(new BossOptionContent { id = id, koreanName = name, rarity = rarity });
        }

        private static void AddClasses(List<ClassContent> list)
        {
            AddClass(list, ArcanaClass.SilverBullet, "🔫", "실버불렛", 2, "가장 가까운 적을 향해 가속 은탄을 연사합니다.");
            AddClass(list, ArcanaClass.ShadowMaster, "🥷", "쉐도우마스터", 2, "어둠의 쌍검과 주기적 은신을 사용합니다.");
            AddClass(list, ArcanaClass.Mechanic, "🛰", "메카닉", 4, "위성이 보스를 우선 추적해 레이저를 발사합니다.");
            AddClass(list, ArcanaClass.Thor, "⚡", "토르", 4, "모든 공격에 강화된 연쇄 낙뢰가 적용됩니다.");
            AddClass(list, ArcanaClass.Wanderer, "⬛", "방랑자", 5, "기존 빌드를 유지하고 최대 체력 +5를 얻습니다.");
        }

        private static void AddClass(List<ClassContent> list, ArcanaClass id, string icon, string name, int difficulty, string description)
        {
            list.Add(new ClassContent { classId = id, icon = icon, koreanName = name, difficulty = difficulty, description = description });
        }
    }
}

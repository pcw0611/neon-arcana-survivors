using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeonArcana
{
    public sealed class EnemyController : MonoBehaviour
    {
        private const float CellSize = 2f;
        private static readonly List<EnemyController> Active = new();
        private static readonly Queue<EnemyController> Pool = new();
        private static readonly Dictionary<long, List<EnemyController>> Grid = new();
        private static readonly Queue<List<EnemyController>> GridListPool = new();

        public static int ActiveCount => Active.Count;
        public static int CreatedCount { get; private set; }
        public bool IsBoss { get; private set; }
        public float Hp => hp;
        public float MaxHp => maxHp;
        public EnemyArchetype Archetype { get; private set; }
        public BossKind BossKind { get; private set; }
        public int BossTier => tier;
        public IReadOnlyList<BossOptionContent> BossOptions => bossOptions;
        public float BossTimeRemaining => Mathf.Max(0f, deadline - (GameManager.Instance?.Elapsed ?? 0f));

        private float hp;
        private float maxHp;
        private float shield;
        private float maxShield;
        private float speed;
        private float damage;
        private float contactCooldown;
        private float actionCooldown;
        private float deadline;
        private float regenCooldown;
        private float stunTimer;
        private float shockTimer;
        private int tier;
        private bool child;
        private bool elite;
        private bool charging;
        private Vector2 chargeDirection;
        private readonly List<BossOptionContent> bossOptions = new();
        [SerializeField] private SpriteRenderer spriteRenderer;
        private Vector3 baseScale;
        private float animationSeed;
        private SpriteRenderer hpBackRenderer;
        private SpriteRenderer hpFillRenderer;
        private SpriteRenderer shieldBackRenderer;
        private SpriteRenderer shieldFillRenderer;
        private SpriteRenderer archetypeIconRenderer;
        private SpriteRenderer glowRenderer;
        private float visualRadius;

        /// <summary>
        /// 웹 원본은 캔버스 픽셀 좌표로 그린다. 카메라 orthographicSize 5.6은 세로 11.2유닛이고
        /// 원본 기준 해상도는 1080px이므로 1유닛 = 96.4px이다. 원본의 픽셀 수치를 그대로 옮기기 위한 환산 상수.
        /// </summary>
        public const float WebPixelsPerUnit = 96.4f;

        public static EnemyController Spawn(Vector3 position, float difficulty, EnemyArchetype? forcedType = null, bool isChild = false)
        {
            var enemy = Take();
            var type = forcedType ?? ChooseArchetype(GameManager.Instance?.Elapsed ?? 0f);
            var content = ContentDatabase.Catalog.enemies.Find(item => item.archetype == type);
            enemy.IsBoss = false;
            enemy.Archetype = type;
            enemy.child = isChild;
            enemy.transform.position = position;
            // 웹 원본: 20초 이후 서서히 엘리트 등장 확률 상승(최대 48%), 엘리트는 체력 2.8배
            var eliteChance = Mathf.Clamp(((GameManager.Instance?.Elapsed ?? 0f) - 20f) / 620f, 0f, 0.48f);
            var elite = !isChild && UnityEngine.Random.value < eliteChance;
            enemy.maxHp = Mathf.Ceil(Mathf.Max(2f, 3.2f * difficulty) * content.hpMultiplier * (elite ? 2.8f : 1f) * (isChild ? 0.42f : 1f));
            enemy.hp = enemy.maxHp;
            enemy.shield = type == EnemyArchetype.Warder ? Mathf.Ceil(enemy.maxHp * 0.75f) : 0f;
            enemy.maxShield = enemy.shield;
            enemy.stunTimer = enemy.shockTimer = 0f;
            var elapsed = GameManager.Instance?.Elapsed ?? 0f;
            var baseSpeed = Mathf.Min(3f, 1.22f + elapsed * 0.0015f);
            enemy.speed = baseSpeed * content.speedMultiplier * (isChild ? 1.18f : 1f);
            enemy.damage = GameBalance.EnemyDamageScale(elapsed) * 0.52f;
            enemy.contactCooldown = 0f;
            enemy.actionCooldown = UnityEngine.Random.Range(1.4f, 3.4f);
            enemy.charging = false;
            enemy.spriteRenderer.sprite = type == EnemyArchetype.Bomber
                ? NeonAssets.FullSprite("Art/bomber-drone", 120f)
                : NeonAssets.SpriteFrame("Art/shade-sd", (int)type % 2, (int)type / 2 % 2);
            enemy.spriteRenderer.color = content.color;
            enemy.ApplyArchetypeIcon(type);
            // 웹 원본: r = 자식 13 / 엘리트 28 / 일반 18~23, 그리는 크기 = r * (엘리트 4.2 : 3.8)
            enemy.visualRadius = isChild ? 13f : elite ? 28f : UnityEngine.Random.Range(18f, 23f);
            var webSize = enemy.visualRadius * (elite ? 4.2f : 3.8f);
            enemy.transform.localScale = Vector3.one * (webSize / WebPixelsPerUnit);
            enemy.elite = elite;
            enemy.Activate();
            return enemy;
        }

        public static EnemyController SpawnBoss(Vector3 position, int bossIndex, float elapsed)
        {
            var enemy = Take();
            enemy.IsBoss = true;
            enemy.child = false;
            enemy.tier = bossIndex % 3 + 1;
            var cycle = bossIndex / 3;
            var bossPool = enemy.tier == 3
                ? new[] { BossKind.Witch, BossKind.Dragon }
                : new[] { BossKind.Oni, BossKind.Seraph };
            enemy.BossKind = bossPool[UnityEngine.Random.Range(0, bossPool.Length)];
            var content = ContentDatabase.Catalog.bosses.Find(item => item.kind == enemy.BossKind);
            enemy.bossOptions.Clear();
            RollBossOptions(elapsed, enemy.bossOptions);
            var baseHp = new[] { 0f, 170f, 440f, 1050f }[enemy.tier];
            var lateBoss = elapsed <= 600f ? 1f : Mathf.Pow(1f + (elapsed - 600f) / 600f, 0.9f);
            enemy.maxHp = Mathf.Round(baseHp * Mathf.Pow(1.42f, cycle) * (1f + elapsed / 900f) * lateBoss * (enemy.HasOption("armored") ? 1.25f : 1f));
            enemy.hp = enemy.maxHp;
            enemy.shield = 0f;
            enemy.maxShield = 0f;
            enemy.stunTimer = enemy.shockTimer = 0f;
            enemy.speed = (enemy.tier == 3 ? 1.02f : 1.16f) * (enemy.HasOption("swift") ? 1.18f : 1f) * Mathf.Min(1.35f, 1f + cycle * 0.05f);
            enemy.damage = Mathf.Max(2f + Mathf.Floor((bossIndex + 1) / 2f), GameBalance.EnemyDamageScale(elapsed) * 0.75f);
            enemy.deadline = elapsed + Mathf.Max(30f, new[] { 0f, 45f, 52f, 60f }[enemy.tier] - cycle * 2f);
            enemy.contactCooldown = 0f;
            enemy.actionCooldown = 1.15f;
            enemy.regenCooldown = 1f;
            enemy.transform.position = position;
            enemy.spriteRenderer.sprite = NeonAssets.SpriteFrame("Art/bosses", content.spriteColumn, content.spriteRow, 2, 2, 260f);
            enemy.spriteRenderer.color = Color.white;
            if (enemy.archetypeIconRenderer != null) enemy.archetypeIconRenderer.enabled = false;
            // 웹 원본 보스 크기: 3티어 245px, 그 외 178px
            enemy.visualRadius = enemy.tier == 3 ? 122f : 89f;
            enemy.elite = false;
            enemy.transform.localScale = Vector3.one * ((enemy.tier == 3 ? 245f : 178f) / WebPixelsPerUnit);
            enemy.Activate();
            GameManager.Instance?.RegisterBossSpawn(enemy);
            return enemy;
        }

        private static EnemyController Take()
        {
            return Pool.Count > 0 ? Pool.Dequeue() : Create();
        }

        private static EnemyController Create()
        {
            CreatedCount++;
            var prefab = Resources.Load<GameObject>("Prefabs/Enemy");
            var gameObject = prefab != null ? Instantiate(prefab) : CreateTemplate();
            gameObject.name = "Shade";
            var enemy = gameObject.GetComponent<EnemyController>();
            enemy.ResolveVisuals();
            gameObject.SetActive(false);
            return enemy;
        }

        public static GameObject CreateTemplate()
        {
            var gameObject = new GameObject("Enemy", typeof(SpriteRenderer), typeof(EnemyController));
            var enemy = gameObject.GetComponent<EnemyController>();
            enemy.spriteRenderer = gameObject.GetComponent<SpriteRenderer>();
            enemy.spriteRenderer.sprite = NeonAssets.SpriteFrame("Art/shade-sd", 0, 0);
            enemy.spriteRenderer.sortingOrder = 10;
            var glow = new GameObject("Threat Glow", typeof(SpriteRenderer));
            glow.transform.SetParent(gameObject.transform, false);
            // 웹 원본은 적마다 두꺼운 마젠타 오라가 넓게 번진다. 기존 1.35배는 너무 좁아 실루엣에 묻혔다.
            glow.transform.localScale = Vector3.one * 2.1f;
            var glowRenderer = glow.GetComponent<SpriteRenderer>();
            glowRenderer.sprite = NeonAssets.GlowSprite();
            glowRenderer.color = new Color(0.9f, 0.1f, 0.75f, 0.3f);
            glowRenderer.sortingOrder = 9;

            // 웹 원본의 적 상단 HP 바(배경 + 채움)와 쉴드 바, 그리고 종류 아이콘.
            CreateBarPiece(gameObject.transform, "HP Back", new Color(0.09f, 0.075f, 0.157f, 0.94f), 24);
            CreateBarPiece(gameObject.transform, "HP Fill", new Color(1f, 0.404f, 0.6f), 25);
            CreateBarPiece(gameObject.transform, "Shield Back", new Color(0.043f, 0.137f, 0.2f, 0.94f), 24);
            CreateBarPiece(gameObject.transform, "Shield Fill", new Color(0.396f, 0.965f, 1f), 25);

            var icon = new GameObject("Archetype Icon", typeof(SpriteRenderer));
            icon.transform.SetParent(gameObject.transform, false);
            var iconRenderer = icon.GetComponent<SpriteRenderer>();
            iconRenderer.sortingOrder = 26;
            iconRenderer.enabled = false;
            return gameObject;
        }

        private static void CreateBarPiece(Transform parent, string name, Color color, int sortingOrder)
        {
            var piece = new GameObject(name, typeof(SpriteRenderer));
            piece.transform.SetParent(parent, false);
            var renderer = piece.GetComponent<SpriteRenderer>();
            renderer.sprite = NeonAssets.SolidSprite(Color.white);
            renderer.color = color;
            renderer.sortingOrder = sortingOrder;
        }

        private void Awake()
        {
            ResolveVisuals();
        }

        private void ResolveVisuals()
        {
            if (spriteRenderer == null) spriteRenderer = GetComponent<SpriteRenderer>();
            if (spriteRenderer != null)
            {
                if (spriteRenderer.sprite == null) spriteRenderer.sprite = NeonAssets.SpriteFrame("Art/shade-sd", 0, 0);
                spriteRenderer.sortingOrder = 10;
            }
            var glow = transform.Find("Threat Glow");
            if (glow != null)
            {
                glowRenderer = glow.GetComponent<SpriteRenderer>();
                if (glowRenderer != null && glowRenderer.sprite == null) glowRenderer.sprite = NeonAssets.GlowSprite();
            }

            hpBackRenderer = ResolveBar("HP Back", new Color(0.09f, 0.075f, 0.157f, 0.94f), 24);
            hpFillRenderer = ResolveBar("HP Fill", new Color(1f, 0.404f, 0.6f), 25);
            shieldBackRenderer = ResolveBar("Shield Back", new Color(0.043f, 0.137f, 0.2f, 0.94f), 24);
            shieldFillRenderer = ResolveBar("Shield Fill", new Color(0.396f, 0.965f, 1f), 25);

            var icon = transform.Find("Archetype Icon");
            if (icon == null)
            {
                var created = new GameObject("Archetype Icon", typeof(SpriteRenderer));
                created.transform.SetParent(transform, false);
                icon = created.transform;
            }
            archetypeIconRenderer = icon.GetComponent<SpriteRenderer>();
            archetypeIconRenderer.sortingOrder = 26;
        }

        /// <summary>
        /// 웹 원본은 스토커를 제외한 몹 머리 위에 종류 아이콘을 띄운다.
        /// 아이콘 시트는 2×2 그리드이며 거너/차저/워더가 각각 다른 칸을 쓴다.
        /// </summary>
        private void ApplyArchetypeIcon(EnemyArchetype type)
        {
            if (archetypeIconRenderer == null) return;
            if (type == EnemyArchetype.Stalker)
            {
                archetypeIconRenderer.enabled = false;
                return;
            }
            var column = 1;
            var row = 1;
            if (type == EnemyArchetype.Gunner) { column = 0; row = 0; }
            else if (type == EnemyArchetype.Charger) { column = 1; row = 0; }
            else if (type == EnemyArchetype.Warder) { column = 0; row = 1; }
            archetypeIconRenderer.sprite = NeonAssets.SpriteFrame("Art/archetype-icons", column, row, 2, 2);
            archetypeIconRenderer.enabled = true;
        }

        private SpriteRenderer ResolveBar(string name, Color color, int sortingOrder)
        {
            var found = transform.Find(name);
            if (found == null)
            {
                CreateBarPiece(transform, name, color, sortingOrder);
                found = transform.Find(name);
            }
            var renderer = found.GetComponent<SpriteRenderer>();
            if (renderer.sprite == null) renderer.sprite = NeonAssets.SolidSprite(Color.white);
            renderer.color = color;
            renderer.sortingOrder = sortingOrder;
            return renderer;
        }

        /// <summary>
        /// 웹 원본 drawMob()의 체력/쉴드 바와 종류 아이콘을 그대로 옮긴다.
        /// 부모 스케일이 적 종류마다 다르므로, 바는 월드 크기가 일정하도록 부모 스케일로 나눠 보정한다.
        /// </summary>
        private void UpdateStatusBars()
        {
            if (hpFillRenderer == null) return;

            var parentScale = Mathf.Max(0.0001f, transform.localScale.x);
            var barHalf = (IsBoss ? Mathf.Max(54f, visualRadius) : visualRadius) / WebPixelsPerUnit;
            var barHeight = 4f / WebPixelsPerUnit;
            // 웹 캔버스는 Y가 아래로 증가하므로 원본의 '-'는 위쪽을 뜻한다. Unity는 반대라 부호를 뒤집는다.
            var barY = (IsBoss ? visualRadius + 34f : visualRadius + 13f) / WebPixelsPerUnit;

            // 부모가 flipX로 뒤집혀도 바는 영향받지 않도록 로컬 스케일로만 제어한다.
            var localHalf = barHalf / parentScale;
            var localHeight = barHeight / parentScale;
            var localY = barY / parentScale;

            var ratio = maxHp <= 0f ? 0f : Mathf.Clamp01(hp / maxHp);
            hpBackRenderer.transform.localPosition = new Vector3(0f, localY, 0f);
            hpBackRenderer.transform.localScale = new Vector3(localHalf * 2f, localHeight, 1f);
            hpFillRenderer.transform.localPosition = new Vector3(-localHalf * (1f - ratio), localY, 0f);
            hpFillRenderer.transform.localScale = new Vector3(localHalf * 2f * ratio, localHeight, 1f);
            // 웹 원본 색: 보스 #ff4f9d, 엘리트 #c977ff, 일반 #ff6799
            hpFillRenderer.color = IsBoss
                ? new Color(1f, 0.31f, 0.616f)
                : elite
                    ? new Color(0.788f, 0.467f, 1f)
                    : new Color(1f, 0.404f, 0.6f);

            var hasShield = maxShield > 0f && shield > 0f;
            shieldBackRenderer.enabled = hasShield;
            shieldFillRenderer.enabled = hasShield;
            if (hasShield)
            {
                var shieldRatio = Mathf.Clamp01(shield / maxShield);
                var shieldY = localY + 5f / WebPixelsPerUnit / parentScale;  // 쉴드 바는 HP 바 바로 위
                var shieldHeight = 3f / WebPixelsPerUnit / parentScale;
                shieldBackRenderer.transform.localPosition = new Vector3(0f, shieldY, 0f);
                shieldBackRenderer.transform.localScale = new Vector3(localHalf * 2f, shieldHeight, 1f);
                shieldFillRenderer.transform.localPosition = new Vector3(-localHalf * (1f - shieldRatio), shieldY, 0f);
                shieldFillRenderer.transform.localScale = new Vector3(localHalf * 2f * shieldRatio, shieldHeight, 1f);
            }

            if (archetypeIconRenderer != null && archetypeIconRenderer.enabled)
            {
                var iconSize = 22f / WebPixelsPerUnit / parentScale;
                archetypeIconRenderer.transform.localPosition =
                    new Vector3(0f, (visualRadius + 17f) / WebPixelsPerUnit / parentScale, 0f);
                archetypeIconRenderer.transform.localScale = Vector3.one * iconSize;
            }
        }

        private void Activate()
        {
            gameObject.name = IsBoss ? $"Boss {BossKind}" : $"Enemy {Archetype}";
            baseScale = transform.localScale;
            animationSeed = UnityEngine.Random.value * Mathf.PI * 2f;
            gameObject.SetActive(true);
            Active.Add(this);
        }

        private void Update()
        {
            var manager = GameManager.Instance;
            var player = manager?.Player;
            if (player == null || player.IsDead || manager.IsAwaitingStart) return;
            if (IsBoss && manager.Elapsed >= deadline)
            {
                manager.RegisterBossTimeout(this);
                Recycle();
                return;
            }

            var delta = player.transform.position - transform.position;
            var distance = delta.magnitude;
            actionCooldown -= Time.deltaTime;
            contactCooldown -= Time.deltaTime;

            // 웹 원본의 stunned/shocked 상태. 기절 중에는 이동·행동이 모두 멈춘다.
            if (shockTimer > 0f) shockTimer -= Time.deltaTime;
            if (stunTimer > 0f)
            {
                stunTimer -= Time.deltaTime;
                spriteRenderer.color = new Color(1f, 0.95f, 0.35f);
                return;
            }

            if (IsBoss) UpdateBoss(player, delta, distance);
            else UpdateArchetype(player, delta, distance);

            if (delta.x != 0f) spriteRenderer.flipX = delta.x < 0f;
            transform.localScale = baseScale * (1f + Mathf.Sin(Time.time * (IsBoss ? 2.1f : 4.2f) + animationSeed) * (IsBoss ? 0.025f : 0.045f));
            UpdateStatusBars();
            if (distance <= (IsBoss ? 0.8f : 0.55f) && contactCooldown <= 0f)
            {
                contactCooldown = IsBoss ? 0.7f : 0.9f;
                player.TakeDamage(damage);
            }
        }

        private void UpdateArchetype(PlayerController player, Vector3 delta, float distance)
        {
            var actualSpeed = speed;
            if (GameManager.Instance.HasRelic("gravity_halo") && distance < 3.6f) actualSpeed *= 0.76f;
            switch (Archetype)
            {
                case EnemyArchetype.Gunner:
                    if (distance > 4.2f) Move(delta, actualSpeed);
                    else if (distance < 3.2f) Move(-delta, actualSpeed * 0.7f);
                    if (actionCooldown <= 0f)
                    {
                        EnemyProjectile.Spawn(transform.position, delta.normalized, 4.6f, damage);
                        actionCooldown = 2.3f;
                    }
                    break;
                case EnemyArchetype.Charger:
                    if (charging)
                    {
                        transform.position += (Vector3)(chargeDirection * actualSpeed * 3.4f * Time.deltaTime);
                        if (actionCooldown <= 0f) charging = false;
                    }
                    else
                    {
                        Move(delta, actualSpeed);
                        if (actionCooldown <= 0f && distance < 5.5f)
                        {
                            charging = true;
                            chargeDirection = delta.normalized;
                            actionCooldown = 0.55f;
                        }
                    }
                    break;
                case EnemyArchetype.Bomber:
                    Move(delta, actualSpeed);
                    if (distance < 0.9f) Explode();
                    break;
                default:
                    Move(delta, actualSpeed);
                    break;
            }
        }

        private void UpdateBoss(PlayerController player, Vector3 delta, float distance)
        {
            Move(delta, speed);
            if (HasOption("regen"))
            {
                regenCooldown -= Time.deltaTime;
                if (regenCooldown <= 0f)
                {
                    regenCooldown = 1f;
                    hp = Mathf.Min(maxHp, hp + maxHp * 0.006f);
                }
            }
            if (HasOption("shock_aura") && distance < 2.4f && contactCooldown <= 0f) player.TakeDamage(damage * 0.7f);
            if (actionCooldown > 0f) return;

            var count = BossKind == BossKind.Seraph ? 9 : BossKind == BossKind.Witch ? 12 : BossKind == BossKind.Dragon ? 15 : 7;
            if (HasOption("echo")) count += 4;
            var offset = UnityEngine.Random.value * Mathf.PI * 2f;
            for (var i = 0; i < count; i++)
            {
                var angle = offset + i * Mathf.PI * 2f / count;
                EnemyProjectile.Spawn(transform.position, new Vector2(Mathf.Cos(angle), Mathf.Sin(angle)), HasOption("overclock") ? 5.6f : 4.2f, damage, false, true);
            }
            if (HasOption("minefield"))
            {
                for (var i = 0; i < 3; i++)
                    EnemyProjectile.Spawn(player.transform.position + (Vector3)UnityEngine.Random.insideUnitCircle * 2.2f, Vector2.zero, 0f, damage * 1.1f, true, true);
            }
            actionCooldown = BossKind == BossKind.Dragon ? 1.7f : 2.3f;
        }

        private void Move(Vector3 delta, float moveSpeed)
        {
            if (delta.sqrMagnitude > 0.0001f) transform.position += delta.normalized * moveSpeed * Time.deltaTime;
        }

        private void Explode()
        {
            var player = GameManager.Instance.Player;
            if (Vector3.Distance(player.transform.position, transform.position) < 1.45f) player.TakeDamage(damage * 1.4f);
            if (GameManager.Instance.HasRelic("chain_detonator"))
            {
                var targets = ListPool.Take();
                Nearby(transform.position, 2.2f, targets);
                foreach (var target in targets)
                    if (target != this) target.TakeDamage(player.Damage * player.DamageMultiplier * 0.85f, false);
                ListPool.Return(targets);
            }
            CombatPulse.Spawn(transform.position, 1.45f, new Color(1f, 0.2f, 0.35f, 0.6f));
            hp = 0f;
            Die();
        }

        /// <summary>웹 원본의 <c>mob.stunned</c>/<c>mob.shocked</c> 대응 상태 부여.</summary>
        public void ApplyStunAndShock(float seconds)
        {
            stunTimer = Mathf.Max(stunTimer, seconds);
            shockTimer = Mathf.Max(shockTimer, seconds);
        }

        public bool IsStunned => stunTimer > 0f;

        public void TakeDamage(float amount, bool critical) => TakeDamage(amount, critical, false);

        /// <summary>
        /// <paramref name="ignoreShield"/>가 true면 웹 원본의 토르의 망치처럼 쉴드를 통과해 본체에 피해를 준다.
        /// </summary>
        public void TakeDamage(float amount, bool critical, bool ignoreShield)
        {
            if (!gameObject.activeSelf) return;
            if (shield > 0f && !ignoreShield)
            {
                var absorbed = Mathf.Min(shield, amount);
                shield -= absorbed;
                amount -= absorbed;
            }
            if (amount > 0f) hp -= amount;
            if (!IsBoss && GameManager.Instance.HasRelic("execution") && hp > 0f && hp / maxHp < 0.15f) hp = 0f;
            spriteRenderer.color = critical ? new Color(1f, 0.9f, 0.2f) : Color.white;
            CancelInvoke(nameof(RestoreColor));
            Invoke(nameof(RestoreColor), 0.07f);
            if (hp <= 0f) Die();
        }

        private void RestoreColor()
        {
            if (IsBoss)
            {
                spriteRenderer.color = Color.white;
                return;
            }
            var content = ContentDatabase.Catalog.enemies.Find(item => item.archetype == Archetype);
            spriteRenderer.color = content.color;
        }

        private void Die()
        {
            var deathPosition = transform.position;
            if (IsBoss)
            {
                GameManager.Instance.RegisterBossKill(this);
            }
            else
            {
                GameManager.Instance.RegisterKill(deathPosition, child ? 1 : 1);
                if (Archetype == EnemyArchetype.Splitter && !child)
                {
                    Spawn(deathPosition + Vector3.left * 0.2f, GameBalance.DifficultyScale(GameManager.Instance.Elapsed), EnemyArchetype.Stalker, true);
                    Spawn(deathPosition + Vector3.right * 0.2f, GameBalance.DifficultyScale(GameManager.Instance.Elapsed), EnemyArchetype.Stalker, true);
                }
            }
            Recycle();
        }

        private void Recycle()
        {
            if (!gameObject.activeSelf) return;
            Active.Remove(this);
            gameObject.SetActive(false);
            Pool.Enqueue(this);
        }

        private bool HasOption(string id) => bossOptions.Exists(option => option.id == id);

        public static EnemyController Nearest(Vector3 position)
        {
            var results = ListPool.Take();
            Nearby(position, 16f, results);
            EnemyController best = null;
            var bestDistance = float.MaxValue;
            foreach (var enemy in results)
            {
                var distance = (enemy.transform.position - position).sqrMagnitude;
                if (distance >= bestDistance) continue;
                bestDistance = distance;
                best = enemy;
            }
            ListPool.Return(results);
            return best;
        }

        public static EnemyController HighestHp()
        {
            EnemyController best = null;
            foreach (var enemy in Active)
                if (best == null || enemy.hp > best.hp) best = enemy;
            return best;
        }

        public static EnemyController FirstWithin(Vector3 position, float radius, HashSet<EnemyController> excluded = null)
        {
            var cellRadius = Mathf.CeilToInt(radius / CellSize);
            var centerX = Mathf.FloorToInt(position.x / CellSize);
            var centerY = Mathf.FloorToInt(position.y / CellSize);
            var radiusSquared = radius * radius;
            for (var x = centerX - cellRadius; x <= centerX + cellRadius; x++)
            for (var y = centerY - cellRadius; y <= centerY + cellRadius; y++)
            {
                if (!Grid.TryGetValue(GridKey(x, y), out var cell)) continue;
                foreach (var enemy in cell)
                    if ((excluded == null || !excluded.Contains(enemy)) && (enemy.transform.position - position).sqrMagnitude <= radiusSquared) return enemy;
            }
            return null;
        }

        public static void Nearby(Vector3 position, float radius, List<EnemyController> results)
        {
            results.Clear();
            var cellRadius = Mathf.CeilToInt(radius / CellSize);
            var centerX = Mathf.FloorToInt(position.x / CellSize);
            var centerY = Mathf.FloorToInt(position.y / CellSize);
            var radiusSquared = radius * radius;
            for (var x = centerX - cellRadius; x <= centerX + cellRadius; x++)
            for (var y = centerY - cellRadius; y <= centerY + cellRadius; y++)
            {
                if (!Grid.TryGetValue(GridKey(x, y), out var cell)) continue;
                foreach (var enemy in cell)
                    if ((enemy.transform.position - position).sqrMagnitude <= radiusSquared) results.Add(enemy);
            }
        }

        public static void FillMinimap(Vector3 center, float range, List<Vector2> results)
        {
            results.Clear();
            var inverseRange = 1f / Mathf.Max(0.01f, range);
            foreach (var enemy in Active)
            {
                var relative = (Vector2)(enemy.transform.position - center) * inverseRange;
                if (relative.sqrMagnitude > 1.15f) continue;
                results.Add(Vector2.ClampMagnitude(relative, 1f));
                if (results.Count >= 96) break;
            }
        }

        public static void RebuildSpatialHash()
        {
            foreach (var list in Grid.Values)
            {
                list.Clear();
                GridListPool.Enqueue(list);
            }
            Grid.Clear();
            foreach (var enemy in Active)
            {
                var x = Mathf.FloorToInt(enemy.transform.position.x / CellSize);
                var y = Mathf.FloorToInt(enemy.transform.position.y / CellSize);
                var key = GridKey(x, y);
                if (!Grid.TryGetValue(key, out var list))
                {
                    list = GridListPool.Count > 0 ? GridListPool.Dequeue() : new List<EnemyController>(8);
                    Grid[key] = list;
                }
                list.Add(enemy);
            }
        }

        private static long GridKey(int x, int y) => ((long)x << 32) ^ (uint)y;

        public static EnemyArchetype ChooseArchetype(float time, float roll = -1f)
        {
            if (roll < 0f) roll = UnityEngine.Random.value;
            var gunner = time > 45f ? Mathf.Min(0.13f, (time - 45f) / 400f) : 0f;
            var charger = time > 110f ? Mathf.Min(0.12f, (time - 110f) / 400f) : 0f;
            var warder = time > 230f ? Mathf.Min(0.08f, (time - 230f) / 400f) : 0f;
            var bomber = time > 340f ? Mathf.Min(0.09f, (time - 340f) / 400f) : 0f;
            var splitter = time > 440f ? Mathf.Min(0.08f, (time - 440f) / 500f) : 0f;
            if (roll < gunner) return EnemyArchetype.Gunner;
            if (roll < gunner + charger) return EnemyArchetype.Charger;
            if (roll < gunner + charger + warder) return EnemyArchetype.Warder;
            if (roll < gunner + charger + warder + bomber) return EnemyArchetype.Bomber;
            if (roll < gunner + charger + warder + bomber + splitter) return EnemyArchetype.Splitter;
            return EnemyArchetype.Stalker;
        }

        public static void RollBossOptions(float time, List<BossOptionContent> output, System.Random random = null)
        {
            output.Clear();
            var available = new List<BossOptionContent>(ContentDatabase.Catalog.bossOptions);
            var count = Mathf.Clamp(1 + Mathf.FloorToInt(time / 180f), 1, 5);
            var lateBias = Mathf.Clamp01(time / 900f);
            random ??= new System.Random();
            while (output.Count < count && available.Count > 0)
            {
                var total = 0f;
                foreach (var option in available) total += 1f + option.rarity * 1.8f * lateBias;
                var roll = (float)random.NextDouble() * total;
                for (var i = 0; i < available.Count; i++)
                {
                    roll -= 1f + available[i].rarity * 1.8f * lateBias;
                    if (roll > 0f) continue;
                    output.Add(available[i]);
                    available.RemoveAt(i);
                    break;
                }
            }
        }

        public static void ClearAll()
        {
            foreach (var enemy in new List<EnemyController>(Active)) enemy.Recycle();
            RebuildSpatialHash();
        }

        private static class ListPool
        {
            private static readonly Queue<List<EnemyController>> Lists = new();
            public static List<EnemyController> Take() => Lists.Count > 0 ? Lists.Dequeue() : new List<EnemyController>(64);
            public static void Return(List<EnemyController> list)
            {
                list.Clear();
                Lists.Enqueue(list);
            }
        }
    }

    public sealed class EnemySpawner : MonoBehaviour
    {
        private float spawnTimer;
        private float bossTimer = 48f;
        private int bossIndex;

        private void Update()
        {
            var manager = GameManager.Instance;
            if (manager == null || manager.IsGameOver || manager.IsChoosingUpgrade || manager.IsAwaitingStart) return;

            if (manager.ActiveBoss == null)
            {
                bossTimer -= Time.deltaTime;
                if (bossTimer <= 0f)
                {
                    SpawnBossAtEdge();
                    bossTimer = UnityEngine.Random.Range(58f, 72f) + (bossIndex % 3 + 1) * 4f;
                }
            }

            if (EnemyController.ActiveCount >= GameBalance.EnemyCap) return;
            spawnTimer -= Time.deltaTime;
            if (spawnTimer > 0f) return;

            var opening = Mathf.Lerp(0.7f, 1f, Mathf.Clamp01(manager.Elapsed / 60f));
            var targetDensity = Mathf.Min(190, Mathf.RoundToInt((36f + Mathf.Floor(manager.Elapsed * 0.24f)) * opening));
            var deficit = Mathf.Max(0, targetDensity - EnemyController.ActiveCount);
            var baseInterval = Mathf.Max(0.09f, 0.5f / Mathf.Pow(1f + manager.Elapsed / 210f, 0.76f));
            spawnTimer = EnemyController.ActiveCount == 0 ? 0.12f : deficit > 0 ? Mathf.Min(0.11f, baseInterval) : baseInterval;
            var batch = EnemyController.ActiveCount == 0 ? 4 : deficit > 50 ? 5 : deficit > 28 ? 4 : deficit > 12 ? 3 : deficit > 0 ? 2 : 1;
            for (var i = 0; i < batch; i++) SpawnAtEdge();
        }

        private void LateUpdate() => EnemyController.RebuildSpatialHash();

        private static void SpawnAtEdge()
        {
            var player = GameManager.Instance.Player;
            var angle = UnityEngine.Random.value * Mathf.PI * 2f;
            var distance = UnityEngine.Random.Range(7.5f, 9.5f);
            var position = player.transform.position + new Vector3(Mathf.Cos(angle), Mathf.Sin(angle)) * distance;
            EnemyController.Spawn(position, GameBalance.DifficultyScale(GameManager.Instance.Elapsed));
        }

        private void SpawnBossAtEdge()
        {
            var player = GameManager.Instance.Player;
            var angle = UnityEngine.Random.value * Mathf.PI * 2f;
            var position = player.transform.position + new Vector3(Mathf.Cos(angle), Mathf.Sin(angle)) * 8f;
            EnemyController.SpawnBoss(position, bossIndex++, GameManager.Instance.Elapsed);
        }
    }
}

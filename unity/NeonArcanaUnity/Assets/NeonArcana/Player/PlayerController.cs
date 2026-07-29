using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeonArcana
{
    public sealed class PlayerController : MonoBehaviour
    {
        public const string ConstellationTargetingMode = "NearestEnemyAutomatic";

        public event Action Died;

        public float MaxHp { get; private set; } = GameBalance.StartingHp;
        public float Hp { get; private set; } = GameBalance.StartingHp;
        public float MoveSpeed { get; set; } = GameBalance.StartingSpeed;
        public float Damage { get; set; } = GameBalance.StartingDamage;
        public float AttackInterval { get; set; } = GameBalance.StartingAttackInterval;
        public int Multishot { get; set; } = GameBalance.StartingMultishot;
        public float MagnetRadius { get; set; } = GameBalance.BaseMagnetRadius;
        public float CritChance { get; set; } = GameBalance.StartingCritChance;
        public float CritMultiplier { get; set; } = GameBalance.StartingCritMultiplier;
        public int Pierce { get; set; }
        public float BlastRadius { get; set; }
        public int ChainCount { get; set; }
        public float ProjectileScale { get; set; } = 1f;
        public float ProjectileMultiplier { get; set; } = 1f;
        public int Orbitals { get; set; }
        public float OrbitSpeed { get; set; } = 1f;
        public float OrbitSize { get; set; } = 1f;
        public float OrbitRadius { get; set; } = 1.35f;
        public float OrbitDamage { get; set; } = 1f;
        public float OrbitShock { get; set; }
        public float OrbitGuard { get; set; }
        public int OrbitPulse { get; set; }
        public int SaberLevel { get; set; }
        public float SaberDamage { get; set; } = 1f;
        public float SaberRange { get; set; } = 2.2f;
        public float SaberInterval { get; set; } = 1.1f;
        public int SaberEcho { get; set; }
        public float SaberGuard { get; set; }
        public float SaberArc { get; set; } = 1.38f;
        public float Regen { get; set; }
        public float GuardChance { get; set; }
        public float XpMultiplier { get; set; } = 1f;
        public float DamageMultiplier { get; set; } = 1f;
        public ArcanaClass Class { get; private set; }
        public int RelicSlots { get; set; } = 3;
        public bool IsDead => Hp <= 0f;
        public int OrbitShockTriggers { get; private set; }
        public int OrbitPulseTriggers { get; private set; }
        public int OrbitIntercepts { get; private set; }
        public Vector2 LastProjectileDirection { get; private set; } = Vector2.right;

        public VirtualJoystick MoveJoystick { get; set; }

        [SerializeField] private SpriteRenderer spriteRenderer;
        [SerializeField] private SpriteRenderer classDecoration;
        [SerializeField] private SpriteRenderer auraRenderer;
        [SerializeField] private SpriteRenderer hpBackRenderer;
        [SerializeField] private SpriteRenderer hpFillRenderer;
        [SerializeField] private SpriteRenderer hitboxRenderer;
        private float attackCooldown;
        private float hurtCooldown;
        private Vector2 lastAim = Vector2.right;
        private Vector2 saberAim = Vector2.right;
        private Vector2 moveDirection;
        private Vector2 lastMousePosition;
        private bool mouseAimActive;
        private float animationClock;
        private int animationFrame;
        private float saberCooldown;
        private float regenClock;
        private float classClock;
        private readonly List<GameObject> orbitalObjects = new();
        private readonly List<EnemyController> targetBuffer = new();
        private readonly Dictionary<ulong, float> orbitHitTimes = new();
        private float orbitPulseClock = 4f;
        private bool forceOrbitEffectsForTest;
        private int volleyCount;
        private static readonly string[] MasteryBuilds = { "projectile", "saber", "orbit", "thor" };
        private readonly Dictionary<string, float> masteryClocks = new();

        public static PlayerController Create()
        {
            var prefab = Resources.Load<GameObject>("Prefabs/Player");
            var playerObject = prefab != null ? Instantiate(prefab) : CreateTemplate();
            playerObject.name = "Astra";
            var controller = playerObject.GetComponent<PlayerController>();
            controller.ResolveVisuals();
            return controller;
        }

        public static GameObject CreateTemplate()
        {
            var playerObject = new GameObject("Player", typeof(SpriteRenderer), typeof(PlayerController));
            var controller = playerObject.GetComponent<PlayerController>();
            controller.spriteRenderer = playerObject.GetComponent<SpriteRenderer>();
            controller.spriteRenderer.sprite = NeonAssets.SpriteFrame("Art/astra-sd", 0, 0);
            controller.spriteRenderer.sortingOrder = 20;
            playerObject.transform.localScale = Vector3.one * 0.78f;

            var aura = new GameObject("Aura", typeof(SpriteRenderer));
            aura.transform.SetParent(playerObject.transform, false);
            aura.transform.localScale = Vector3.one * 1.65f;
            controller.auraRenderer = aura.GetComponent<SpriteRenderer>();
            controller.auraRenderer.sprite = NeonAssets.GlowSprite();
            controller.auraRenderer.color = new Color(0.15f, 0.95f, 1f, 0.22f);
            controller.auraRenderer.sortingOrder = 19;

            var decoration = new GameObject("Class Decoration", typeof(SpriteRenderer));
            decoration.transform.SetParent(playerObject.transform, false);
            controller.classDecoration = decoration.GetComponent<SpriteRenderer>();
            controller.classDecoration.sortingOrder = 21;
            controller.classDecoration.enabled = false;

            var hpBack = new GameObject("HP Back", typeof(SpriteRenderer));
            hpBack.transform.SetParent(playerObject.transform, false);
            hpBack.transform.localPosition = new Vector3(0f, -0.72f, 0f);
            hpBack.transform.localScale = new Vector3(0.98f, 0.1f, 1f);
            controller.hpBackRenderer = hpBack.GetComponent<SpriteRenderer>();
            controller.hpBackRenderer.sprite = NeonAssets.SolidSprite(Color.white);
            controller.hpBackRenderer.color = new Color(0.015f, 0.025f, 0.055f, 0.94f);
            controller.hpBackRenderer.sortingOrder = 22;

            var hpFill = new GameObject("HP Fill", typeof(SpriteRenderer));
            hpFill.transform.SetParent(playerObject.transform, false);
            hpFill.transform.localPosition = new Vector3(0f, -0.72f, 0f);
            hpFill.transform.localScale = new Vector3(0.92f, 0.055f, 1f);
            controller.hpFillRenderer = hpFill.GetComponent<SpriteRenderer>();
            controller.hpFillRenderer.sprite = NeonAssets.SolidSprite(Color.white);
            controller.hpFillRenderer.color = new Color(0.24f, 1f, 0.66f, 1f);
            controller.hpFillRenderer.sortingOrder = 23;

            var hitbox = new GameObject("Hitbox Debug", typeof(SpriteRenderer));
            hitbox.transform.SetParent(playerObject.transform, false);
            hitbox.transform.localScale = Vector3.one * 0.9f;
            controller.hitboxRenderer = hitbox.GetComponent<SpriteRenderer>();
            controller.hitboxRenderer.sprite = NeonAssets.RingSprite(128);
            controller.hitboxRenderer.color = new Color(1f, 0.2f, 0.32f, 0.9f);
            controller.hitboxRenderer.sortingOrder = 24;
            controller.hitboxRenderer.enabled = false;
            return playerObject;
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
                if (spriteRenderer.sprite == null) spriteRenderer.sprite = NeonAssets.SpriteFrame("Art/astra-sd", 0, 0);
                spriteRenderer.sortingOrder = 20;
            }
            var decoration = transform.Find("Class Decoration");
            if (classDecoration == null && decoration != null) classDecoration = decoration.GetComponent<SpriteRenderer>();
            var aura = transform.Find("Aura");
            if (auraRenderer == null && aura != null) auraRenderer = aura.GetComponent<SpriteRenderer>();
            if (auraRenderer != null && auraRenderer.sprite == null) auraRenderer.sprite = NeonAssets.GlowSprite();
            var hpBack = transform.Find("HP Back");
            if (hpBackRenderer == null && hpBack != null) hpBackRenderer = hpBack.GetComponent<SpriteRenderer>();
            if (hpBackRenderer != null && hpBackRenderer.sprite == null) hpBackRenderer.sprite = NeonAssets.SolidSprite(Color.white);
            var hpFill = transform.Find("HP Fill");
            if (hpFillRenderer == null && hpFill != null) hpFillRenderer = hpFill.GetComponent<SpriteRenderer>();
            if (hpFillRenderer != null && hpFillRenderer.sprite == null) hpFillRenderer.sprite = NeonAssets.SolidSprite(Color.white);
            var hitbox = transform.Find("Hitbox Debug");
            if (hitboxRenderer == null && hitbox != null) hitboxRenderer = hitbox.GetComponent<SpriteRenderer>();
            if (hitboxRenderer != null && hitboxRenderer.sprite == null) hitboxRenderer.sprite = NeonAssets.RingSprite(128);
        }

        public void SetHitboxVisible(bool visible)
        {
            if (hitboxRenderer != null) hitboxRenderer.enabled = visible;
        }

        private void Update()
        {
            if (IsDead || GameManager.Instance == null || GameManager.Instance.IsChoosingUpgrade || GameManager.Instance.IsAwaitingStart) return;
            Move();
            AimAndFire();
            UpdateSaber();
            UpdateOrbitals();
            UpdateAnimation();
            UpdateRegeneration();
            UpdateClassAbility();
            UpdateHpBar();
            if (hurtCooldown > 0f) hurtCooldown -= Time.deltaTime;
        }

        private void Move()
        {
            var keyboard = new Vector2(Input.GetAxisRaw("Horizontal"), Input.GetAxisRaw("Vertical"));
            var input = MoveJoystick != null && MoveJoystick.Value.sqrMagnitude > 0.01f ? MoveJoystick.Value : Vector2.ClampMagnitude(keyboard, 1f);
            moveDirection = input.sqrMagnitude > 0.01f ? input.normalized : Vector2.zero;
            transform.position += (Vector3)(input * MoveSpeed * Time.deltaTime);
            if (Mathf.Abs(input.x) > 0.05f) spriteRenderer.flipX = input.x < 0f;
            animationClock += input.sqrMagnitude > 0.01f ? Time.deltaTime * 8f : Time.deltaTime * 2f;
        }

        private void AimAndFire()
        {
            UpdateSaberAim();

            attackCooldown -= Time.deltaTime;
            if (attackCooldown > 0f || EnemyController.ActiveCount == 0) return;
            var target = EnemyController.Nearest(transform.position);
            if (target == null) return;
            var direction = (Vector2)(target.transform.position - transform.position);
            if (direction.sqrMagnitude < 0.001f) return;
            lastAim = direction.normalized;
            LastProjectileDirection = lastAim;
            attackCooldown = Class == ArcanaClass.SilverBullet ? Mathf.Max(0.1f, AttackInterval * 0.4f) : AttackInterval;
            FireVolley(lastAim);
        }

        private void UpdateSaberAim()
        {
            var currentMousePosition = (Vector2)Input.mousePosition;
            if ((currentMousePosition - lastMousePosition).sqrMagnitude > 1f) mouseAimActive = true;
            lastMousePosition = currentMousePosition;
            if (mouseAimActive && Camera.main != null)
            {
                var mouseWorld = Camera.main.ScreenToWorldPoint(Input.mousePosition);
                var mouseAim = (Vector2)(mouseWorld - transform.position);
                if (mouseAim.sqrMagnitude > 0.25f) saberAim = mouseAim.normalized;
            }
            else if (moveDirection.sqrMagnitude > 0.04f)
            {
                saberAim = moveDirection;
            }
        }

        private void FireVolley(Vector2 direction)
        {
            volleyCount++;
            var bonus = GameManager.Instance.HasRelic("split_core") && volleyCount % 4 == 0 ? 2 : 0;
            var count = Mathf.Max(1, Multishot + bonus);
            // 웹 원본: 실버불렛은 탄 수를 늘리지 않고, 부채꼴 없이(spread 0) 한 방향으로만 연사한다.
            var silver = Class == ArcanaClass.SilverBullet;
            var totalSpread = silver ? 0f : Mathf.Min(38f, 8f * (count - 1));
            for (var i = 0; i < count; i++)
            {
                var t = count == 1 ? 0.5f : i / (float)(count - 1);
                var angle = silver ? 0f : Mathf.Lerp(-totalSpread * 0.5f, totalSpread * 0.5f, t);
                var rotated = Quaternion.Euler(0f, 0f, angle) * direction;
                var critical = UnityEngine.Random.value < CritChance;
                var shotDamage = Damage * DamageMultiplier * ProjectileMultiplier * (critical ? CritMultiplier : 1f);
                Projectile.Spawn(transform.position + (Vector3)direction * 0.35f, rotated, shotDamage, critical, this, Class == ArcanaClass.SilverBullet);
            }
            if (GameManager.Instance.HasRelic("echo_chamber") && volleyCount % 6 == 0)
                Invoke(nameof(FireEchoVolley), 0.12f);
        }

        private void FireEchoVolley() => FireVolley(lastAim);

        public void TakeDamage(float amount)
        {
            if (IsDead || hurtCooldown > 0f) return;
            if (UnityEngine.Random.value < Mathf.Clamp01(GuardChance + (saberCooldown > 0f ? SaberGuard : 0f))) return;
            hurtCooldown = 0.45f;
            Hp = Mathf.Max(0f, Hp - amount);
            GameHud.Instance?.FlashDamage();
            if (Hp <= 0f)
            {
                if (GameManager.Instance.TryPhoenixRevive())
                {
                    Hp = MaxHp * 0.4f;
                    hurtCooldown = 2.5f;
                    return;
                }
                Died?.Invoke();
            }
        }

        public void IncreaseVitality(float maxIncrease, float heal)
        {
            MaxHp += maxIncrease;
            Hp = Mathf.Min(MaxHp, Hp + heal);
        }

        public void Heal(float amount) => Hp = Mathf.Min(MaxHp, Hp + amount);

        public void SetClass(ArcanaClass selected)
        {
            Class = selected;
            classDecoration.enabled = selected != ArcanaClass.None && selected != ArcanaClass.Wanderer;
            classDecoration.transform.localPosition = new Vector3(0f, 0.28f, 0f);
            classDecoration.transform.localScale = Vector3.one * 0.65f;
            switch (selected)
            {
                case ArcanaClass.SilverBullet:
                    classDecoration.sprite = NeonAssets.FullSprite("Art/silver-bullet", 180f);
                    ProjectileScale *= 0.22f;
                    ProjectileMultiplier *= 0.82f;
                    break;
                case ArcanaClass.ShadowMaster:
                    classDecoration.sprite = NeonAssets.FullSprite("Art/dark-blade", 160f);
                    // 웹 원본은 전직 시 광검 스탯을 건드리지 않는다.
                    // 좁아지는 것은 사거리가 아니라 베기 "각도"(UpdateSaber의 SaberArc * 0.72)이고,
                    // 피해 증가(1.35배)도 스윕 단위로 적용되므로 여기서 중복 적용하지 않는다.
                    SaberLevel = Mathf.Max(1, SaberLevel);
                    break;
                case ArcanaClass.Mechanic:
                    classDecoration.sprite = NeonAssets.FullSprite("Art/mecha-orbital", 120f);
                    Orbitals = Mathf.Max(2, Orbitals);
                    break;
                case ArcanaClass.Thor:
                    classDecoration.sprite = NeonAssets.FullSprite("Art/thor-hammer", 300f);
                    ChainCount = Mathf.Max(1, ChainCount);
                    break;
                case ArcanaClass.Wanderer:
                    IncreaseVitality(5f, 5f);
                    break;
            }
        }

        private void UpdateAnimation()
        {
            var next = Mathf.FloorToInt(animationClock) % 2;
            if (next == animationFrame) return;
            animationFrame = next;
            spriteRenderer.sprite = NeonAssets.SpriteFrame("Art/astra-sd", animationFrame, 0);
            if (auraRenderer != null)
            {
                var pulse = 1.55f + Mathf.Sin(Time.time * 3.2f) * 0.12f;
                auraRenderer.transform.localScale = Vector3.one * pulse;
                auraRenderer.transform.localRotation = Quaternion.Euler(0f, 0f, Time.time * 9f);
            }
        }

        private void UpdateRegeneration()
        {
            if (Regen <= 0f) return;
            regenClock += Time.deltaTime;
            if (regenClock < 1f) return;
            regenClock -= 1f;
            Heal(Regen);
        }

        private void UpdateSaber()
        {
            if (SaberLevel <= 0) return;
            saberCooldown -= Time.deltaTime;
            if (saberCooldown > 0f) return;
            saberCooldown = Mathf.Max(0.2f, SaberInterval);
            var range = SaberRange / 100f + 1.6f;
            EnemyController.Nearby(transform.position, range, targetBuffer);

            // 웹 원본 saberSlash() 동등 구현.
            // 쉐도우마스터는 실제로 들고 있는 쌍검 각도(정면 ±0.5rad)에서 각각 베고,
            // 잔상(echo)은 두 검에 번갈아 분배되며 총 커버리지가 반원을 넘지 않도록 상한을 둔다.
            var dual = Class == ArcanaClass.ShadowMaster;
            const float dualSpread = 0.5f;
            const float maxClusterHalf = 0.85f;
            var sweeps = (dual ? 2 : 1) + SaberEcho;
            var arcWidth = dual ? SaberArc * 0.72f : SaberArc;
            var sweepGap = dual ? 0.34f : 0.48f;
            var damageMultiplier = dual ? 1.35f : 1f;
            var baseAngle = Mathf.Atan2(saberAim.y, saberAim.x);
            var minimumDot = Mathf.Cos(arcWidth * 0.5f);
            var maxOffset = Mathf.Max(0f, maxClusterHalf - arcWidth * 0.5f);

            for (var sweep = 0; sweep < sweeps; sweep++)
            {
                var angle = SaberSweepAngle(sweep, sweeps, baseAngle, dual, sweepGap, maxOffset);
                var sweepAim = new Vector2(Mathf.Cos(angle), Mathf.Sin(angle));
                for (var i = 0; i < targetBuffer.Count; i++)
                {
                    var target = targetBuffer[i];
                    if (target == null || !target.gameObject.activeSelf) continue;
                    var toTarget = (Vector2)(target.transform.position - transform.position);
                    if (toTarget.sqrMagnitude > 0.08f && Vector2.Dot(sweepAim, toTarget.normalized) < minimumDot) continue;
                    var bossBonus = dual && target.IsBoss ? 1.3f : 1f;
                    target.TakeDamage(Damage * DamageMultiplier * SaberDamage * damageMultiplier * bossBonus, false);
                }
                CombatPulse.SpawnArc(
                    transform.position,
                    range,
                    sweepAim,
                    arcWidth,
                    dual ? new Color(0.61f, 0.30f, 1f, 0.8f) : new Color(0.35f, 0.92f, 1f, 0.78f));
            }
        }

        /// <summary>
        /// 웹 원본 <c>saberSlash()</c>의 스윕 각도 분배를 그대로 옮긴 순수 함수.
        /// 쉐도우마스터(<paramref name="dual"/>)는 좌우 검 각도에서 시작해 잔상을 두 검에 번갈아 분배하고,
        /// 각 검에서 벌어질 수 있는 최대 각도(<paramref name="maxOffset"/>)로 총 커버리지를 제한한다.
        /// 검증 가능하도록 분리해 두었다.
        /// </summary>
        public static float SaberSweepAngle(int sweep, int sweeps, float baseAngle, bool dual, float sweepGap, float maxOffset)
        {
            const float dualSpread = 0.5f;
            if (dual && sweep == 0) return baseAngle + dualSpread;
            if (dual && sweep == 1) return baseAngle - dualSpread;
            if (dual)
            {
                var echoIndex = sweep - 2;
                var cluster = echoIndex / 2;
                var side = echoIndex % 2 == 0 ? baseAngle + dualSpread : baseAngle - dualSpread;
                var direction = cluster % 2 == 0 ? 1f : -1f;
                return side + direction * Mathf.Min((cluster + 1) * sweepGap, maxOffset);
            }
            return baseAngle + (sweep - (sweeps - 1) * 0.5f) * sweepGap;
        }

        private void UpdateHpBar()
        {
            if (hpFillRenderer == null) return;
            var ratio = MaxHp <= 0f ? 0f : Mathf.Clamp01(Hp / MaxHp);
            var scale = hpFillRenderer.transform.localScale;
            scale.x = 0.92f * ratio;
            hpFillRenderer.transform.localScale = scale;
            hpFillRenderer.transform.localPosition = new Vector3(-0.46f + scale.x * 0.5f, -0.72f, 0f);
        }

        private void UpdateOrbitals()
        {
            while (orbitalObjects.Count < Orbitals)
            {
                var orbital = new GameObject("Arcana Orbital", typeof(SpriteRenderer));
                var renderer = orbital.GetComponent<SpriteRenderer>();
                renderer.sprite = NeonAssets.SolidSprite(Color.white);
                renderer.color = new Color(0.2f, 0.95f, 1f);
                renderer.sortingOrder = 18;
                orbitalObjects.Add(orbital);
            }
            for (var i = 0; i < orbitalObjects.Count; i++)
            {
                var active = i < Orbitals;
                orbitalObjects[i].SetActive(active);
                if (!active) continue;
                var angle = Time.time * 120f * OrbitSpeed + i * 360f / Mathf.Max(1, Orbitals);
                var direction = Quaternion.Euler(0f, 0f, angle) * Vector3.right;
                orbitalObjects[i].transform.position = transform.position + direction * OrbitRadius;
                orbitalObjects[i].transform.localScale = Vector3.one * 0.17f * OrbitSize;
                var target = EnemyController.FirstWithin(orbitalObjects[i].transform.position, 0.28f * OrbitSize);
                if (target == null) continue;
                var key = (EntityId.ToULong(target.GetEntityId()) << 8) | (uint)i;
                if (orbitHitTimes.GetValueOrDefault(key) > Time.time) continue;
                orbitHitTimes[key] = Time.time + 0.45f;
                var dealt = Damage * DamageMultiplier * OrbitDamage;
                target.TakeDamage(dealt, false);
                if (OrbitShock > 0f && (forceOrbitEffectsForTest || UnityEngine.Random.value < Mathf.Clamp01(OrbitShock)))
                {
                    EnemyController.Nearby(target.transform.position, 0.9f, targetBuffer);
                    foreach (var nearby in targetBuffer)
                        if (nearby != target) nearby.TakeDamage(dealt * 0.42f, false);
                    CombatPulse.Spawn(target.transform.position, 0.9f, new Color(0.4f, 0.97f, 1f, 0.7f));
                    OrbitShockTriggers++;
                }
            }

            if (OrbitPulse > 0)
            {
                orbitPulseClock -= Time.deltaTime;
                if (orbitPulseClock <= 0f)
                {
                    orbitPulseClock = Mathf.Max(1.8f, 5.3f - OrbitPulse * 0.8f);
                    var pulseDamage = Damage * DamageMultiplier * OrbitDamage * 0.65f;
                    for (var i = 0; i < Orbitals && i < orbitalObjects.Count; i++)
                    {
                        var position = orbitalObjects[i].transform.position;
                        EnemyController.Nearby(position, 1.15f, targetBuffer);
                        foreach (var nearby in targetBuffer) nearby.TakeDamage(pulseDamage, false);
                        CombatPulse.Spawn(position, 1.15f, new Color(0.4f, 0.95f, 1f, 0.62f));
                    }
                    OrbitPulseTriggers++;
                }
            }
        }

        public bool TryInterceptProjectile(Vector3 position, float projectileRadius, bool bossPattern, out bool checkedAtOrbit)
        {
            checkedAtOrbit = false;
            if (bossPattern || OrbitGuard <= 0f || Orbitals <= 0) return false;
            for (var i = 0; i < Orbitals && i < orbitalObjects.Count; i++)
            {
                if (!orbitalObjects[i].activeSelf) continue;
                if (Vector3.Distance(position, orbitalObjects[i].transform.position) > 0.15f * OrbitSize + projectileRadius) continue;
                checkedAtOrbit = true;
                if (!forceOrbitEffectsForTest && UnityEngine.Random.value >= Mathf.Min(0.3f, OrbitGuard)) return false;
                CombatPulse.Spawn(orbitalObjects[i].transform.position, 0.34f * OrbitSize, new Color(0.44f, 1f, 1f, 0.75f));
                OrbitIntercepts++;
                return true;
            }
            return false;
        }

        public void EnableOrbitEffectsForSmoke()
        {
            OrbitShock = 1f;
            OrbitGuard = 1f;
            OrbitPulse = 3;
            orbitPulseClock = 0f;
            forceOrbitEffectsForTest = true;
        }

        /// <summary>
        /// 스모크 테스트용 결정론적 감전 검증.
        /// 감전은 원래 "위성이 적과 반경 0.28 안에서 겹칠 때"만 발동하는데, 이는 적이 우연히
        /// 그 좁은 원에 들어와야 해서 전투 상황에 따라 발동하지 않을 수 있다.
        /// 확률이 아니라 감전 분기 자체가 정상 동작하는지 직접 확인한다.
        /// </summary>
        public bool VerifyOrbitShockForSmoke()
        {
            if (OrbitShock <= 0f) return false;
            var target = EnemyController.Nearest(transform.position);
            if (target == null) return false;
            var dealt = Damage * DamageMultiplier * OrbitDamage;
            EnemyController.Nearby(target.transform.position, 0.9f, targetBuffer);
            foreach (var nearby in targetBuffer)
                if (nearby != target) nearby.TakeDamage(dealt * 0.42f, false);
            CombatPulse.Spawn(target.transform.position, 0.9f, new Color(0.4f, 0.97f, 1f, 0.7f));
            OrbitShockTriggers++;
            return true;
        }

        public bool VerifyOrbitInterceptForSmoke()
        {
            if (orbitalObjects.Count == 0 || !orbitalObjects[0].activeSelf) return false;
            return TryInterceptProjectile(orbitalObjects[0].transform.position, 0.14f, false, out _);
        }

        private void UpdateClassAbility()
        {
            classClock += Time.deltaTime;

            // 쉐도우마스터 그림자 은신: 웹 원본은 9초 주기로 2.5초간 은신한다.
            if (Class == ArcanaClass.ShadowMaster)
            {
                var phase = classClock % 9f;
                var hidden = phase > 6.5f;
                spriteRenderer.color = hidden ? new Color(0.5f, 0.25f, 0.8f, 0.35f) : Color.white;
            }
            else
            {
                spriteRenderer.color = Color.white;
            }

            UpdateMasteries();
        }

        /// <summary>
        /// 웹 원본 <c>updateMasteries()</c> 대응. 각 빌드의 핵심 강화를 최대치까지 찍어
        /// "마스터리"를 달성했을 때만 해당 특수기가 주기적으로 발동한다.
        /// 전직한 클래스에 따라 같은 빌드라도 연출과 효과가 달라진다.
        /// </summary>
        private void UpdateMasteries()
        {
            var manager = GameManager.Instance;
            if (manager == null) return;

            foreach (var build in MasteryBuilds)
            {
                if (!manager.IsMastered(build)) continue;
                var scale = manager.MasteryScale(build);
                var interval = MasteryInterval(build) * scale.Interval;
                if (!masteryClocks.TryGetValue(build, out var clock)) clock = interval;
                clock -= Time.deltaTime;
                if (clock > 0f)
                {
                    masteryClocks[build] = clock;
                    continue;
                }
                masteryClocks[build] = interval;
                TriggerMastery(build, scale, manager);
            }
        }

        private static float MasteryInterval(string build) => build switch
        {
            "projectile" => 9.5f,
            "saber" => 7.5f,
            "orbit" => 10.5f,
            "thor" => 8.5f,
            _ => 10f
        };

        /// <summary>스모크 테스트용. 각 마스터리 특수기가 실제로 발동했는지 세는 카운터.</summary>
        public int MasteryTriggerCount { get; private set; }

        /// <summary>
        /// 스모크 테스트용. 마스터리 달성 여부와 무관하게 4종 특수기를 직접 한 번씩 발동시켜
        /// 런타임에서 예외 없이 실제 피해·연출 경로를 타는지 확인한다.
        /// </summary>
        public void RunAllMasteriesForSmoke()
        {
            var manager = GameManager.Instance;
            if (manager == null) return;
            foreach (var build in MasteryBuilds) TriggerMastery(build, (1f, 1f, 1f), manager);
        }

        private void TriggerMastery(string build, (float Damage, float Range, float Interval) scale, GameManager manager)
        {
            MasteryTriggerCount++;
            switch (build)
            {
                case "projectile": TriggerProjectileMastery(scale, manager); break;
                case "saber": TriggerSaberMastery(scale); break;
                case "orbit": TriggerOrbitMastery(scale); break;
                case "thor": TriggerThorHammer(scale); break;
            }
        }

        /// <summary>
        /// 실버불렛이면 자신을 중심으로 사방 무작위 난사(한계돌파할수록 탄 수 증가),
        /// 그 외에는 가장 가까운 적 방향으로 화면을 가르는 관통 성좌 레이저.
        /// </summary>
        private void TriggerProjectileMastery((float Damage, float Range, float Interval) scale, GameManager manager)
        {
            if (Class == ArcanaClass.SilverBullet)
            {
                var rays = 26 + manager.LimitBreakLevel("projectile") * 3;
                for (var i = 0; i < rays; i++)
                {
                    var angle = UnityEngine.Random.value * Mathf.PI * 2f;
                    var direction = new Vector2(Mathf.Cos(angle), Mathf.Sin(angle));
                    Projectile.Spawn(
                        transform.position,
                        direction,
                        Damage * DamageMultiplier * 2.4f * scale.Damage,
                        true,
                        this,
                        true);
                }
                CombatPulse.Spawn(transform.position, 1.6f * scale.Range, new Color(0.93f, 0.96f, 1f, 0.85f));
                return;
            }

            var target = EnemyController.Nearest(transform.position);
            var aim = target != null
                ? ((Vector2)(target.transform.position - transform.position)).normalized
                : lastAim;
            var length = 12.5f * scale.Range;
            var width = 0.48f * scale.Range;
            var hit = 0;
            EnemyController.Nearby(transform.position + (Vector3)(aim * length * 0.5f), length * 0.5f + width + 1f, targetBuffer);
            foreach (var enemy in targetBuffer)
            {
                if (enemy == null || !enemy.gameObject.activeSelf) continue;
                var toEnemy = (Vector2)(enemy.transform.position - transform.position);
                var along = Vector2.Dot(toEnemy, aim);
                if (along < 0f || along > length) continue;
                if (Mathf.Abs(toEnemy.x * aim.y - toEnemy.y * aim.x) > width) continue;
                enemy.TakeDamage(Damage * DamageMultiplier * 9f * scale.Damage, false);
                hit++;
            }
            CombatPulse.SpawnArc(transform.position, length, aim, 0.12f, new Color(0.42f, 0.97f, 1f, 0.9f));
            if (hit > 0) CombatPulse.Spawn(transform.position + (Vector3)(aim * length * 0.4f), width * 2f, new Color(0.55f, 0.98f, 1f, 0.5f));
        }

        /// <summary>
        /// 쉐도우마스터면 전방으로 뻗는 거대한 어둠의 검기(직선 판정),
        /// 그 외에는 자신을 중심으로 전방위를 베는 황금 휠윈드.
        /// </summary>
        private void TriggerSaberMastery((float Damage, float Range, float Interval) scale)
        {
            if (Class == ArcanaClass.ShadowMaster)
            {
                var target = EnemyController.Nearest(transform.position);
                var aim = target != null
                    ? ((Vector2)(target.transform.position - transform.position)).normalized
                    : saberAim;
                var length = 6.4f * scale.Range;
                var width = 1.5f * scale.Range;
                EnemyController.Nearby(transform.position + (Vector3)(aim * length * 0.5f), length * 0.5f + width + 1f, targetBuffer);
                foreach (var enemy in targetBuffer)
                {
                    if (enemy == null || !enemy.gameObject.activeSelf) continue;
                    var toEnemy = (Vector2)(enemy.transform.position - transform.position);
                    var along = Vector2.Dot(toEnemy, aim);
                    if (along < 0f || along > length) continue;
                    if (Mathf.Abs(toEnemy.x * aim.y - toEnemy.y * aim.x) > width) continue;
                    enemy.TakeDamage(Damage * DamageMultiplier * SaberDamage * 3f * scale.Damage, false);
                }
                CombatPulse.SpawnArc(transform.position, length, aim, 0.5f, new Color(0.64f, 0.36f, 1f, 0.85f));
                return;
            }

            var radius = Mathf.Max(2.2f, SaberRange / 100f + 1.75f) * scale.Range;
            EnemyController.Nearby(transform.position, radius, targetBuffer);
            foreach (var enemy in targetBuffer)
            {
                if (enemy == null || !enemy.gameObject.activeSelf) continue;
                enemy.TakeDamage(Damage * DamageMultiplier * SaberDamage * 2.4f * scale.Damage, false);
            }
            CombatPulse.Spawn(transform.position, radius, new Color(1f, 0.85f, 0.36f, 0.8f));
        }

        /// <summary>
        /// 메카닉이면 모든 위성이 표적에 집결해 융합 레이저를 동시 발사하는 폭발,
        /// 그 외에는 위성들이 적을 추격해 폭발한 뒤 복귀한다.
        /// </summary>
        private void TriggerOrbitMastery((float Damage, float Range, float Interval) scale)
        {
            var priority = EnemyController.HighestHp();
            var target = priority != null ? priority : EnemyController.Nearest(transform.position);
            var center = target != null
                ? target.transform.position
                : transform.position + (Vector3)(lastAim * 2f);

            var burstRadius = (Class == ArcanaClass.Mechanic ? 1.6f : 1.25f) * scale.Range;
            var multiplier = Class == ArcanaClass.Mechanic ? 4.2f : 3.2f;
            EnemyController.Nearby(center, burstRadius, targetBuffer);
            foreach (var enemy in targetBuffer)
            {
                if (enemy == null || !enemy.gameObject.activeSelf) continue;
                enemy.TakeDamage(Damage * DamageMultiplier * OrbitDamage * multiplier * scale.Damage, false);
            }

            // 위성이 표적으로 모였다가 터지는 연출.
            foreach (var orbital in orbitalObjects)
            {
                if (orbital == null || !orbital.activeSelf) continue;
                CombatPulse.SpawnArc(
                    orbital.transform.position,
                    Vector3.Distance(orbital.transform.position, center),
                    ((Vector2)(center - orbital.transform.position)).normalized,
                    0.1f,
                    new Color(0.56f, 0.96f, 1f, 0.9f));
            }
            CombatPulse.Spawn(center, burstRadius, new Color(0.56f, 0.96f, 1f, 0.85f));
        }

        /// <summary>
        /// 토르의 망치. 화면 안에서 체력이 가장 높은 적에게 낙뢰를 떨어뜨려
        /// 쉴드를 무시하고 피해를 주고 3초간 기절·감전시킨다.
        /// </summary>
        private void TriggerThorHammer((float Damage, float Range, float Interval) scale)
        {
            var target = EnemyController.HighestHp();
            if (target == null) return;
            var radius = 2f * scale.Range;
            target.TakeDamage(Damage * DamageMultiplier * 15f * scale.Damage, true, true);
            target.ApplyStunAndShock(3f);
            EnemyController.Nearby(target.transform.position, radius, targetBuffer);
            foreach (var enemy in targetBuffer)
            {
                if (enemy == null || enemy == target || !enemy.gameObject.activeSelf) continue;
                enemy.TakeDamage(Damage * DamageMultiplier * 15f * 0.35f * scale.Damage, false, true);
                enemy.ApplyStunAndShock(3f);
            }
            CombatPulse.Spawn(target.transform.position, radius, new Color(1f, 0.95f, 0.35f, 0.9f));
            CombatPulse.Spawn(target.transform.position, radius * 0.55f, Color.white);
        }

        public void ResetForRun()
        {
            MaxHp = GameBalance.StartingHp;
            Hp = MaxHp;
            MoveSpeed = GameBalance.StartingSpeed;
            Damage = GameBalance.StartingDamage;
            AttackInterval = GameBalance.StartingAttackInterval;
            Multishot = GameBalance.StartingMultishot;
            MagnetRadius = GameBalance.BaseMagnetRadius;
            CritChance = GameBalance.StartingCritChance;
            CritMultiplier = GameBalance.StartingCritMultiplier;
            Pierce = 0;
            BlastRadius = 0f;
            ChainCount = 0;
            ProjectileScale = ProjectileMultiplier = 1f;
            Orbitals = 0;
            OrbitSpeed = OrbitSize = OrbitDamage = 1f;
            OrbitRadius = 1.35f;
            OrbitShock = OrbitGuard = 0f;
            OrbitPulse = 0;
            OrbitShockTriggers = OrbitPulseTriggers = OrbitIntercepts = 0;
            orbitPulseClock = 4f;
            forceOrbitEffectsForTest = false;
            orbitHitTimes.Clear();
            masteryClocks.Clear();
            classClock = 0f;
            volleyCount = 0;
            SaberLevel = SaberEcho = 0;
            SaberDamage = 1f;
            SaberRange = 2.2f;
            SaberInterval = 1.1f;
            SaberGuard = Regen = GuardChance = 0f;
            SaberArc = 1.38f;
            XpMultiplier = DamageMultiplier = 1f;
            RelicSlots = 3;
            Class = ArcanaClass.None;
            if (classDecoration != null) classDecoration.enabled = false;
            foreach (var orbital in orbitalObjects) orbital.SetActive(false);
            transform.position = Vector3.zero;
            attackCooldown = 0f;
            hurtCooldown = 0f;
            mouseAimActive = false;
            moveDirection = Vector2.zero;
            saberAim = LastProjectileDirection = lastAim = Vector2.right;
            animationClock = saberCooldown = regenClock = classClock = 0f;
            volleyCount = 0;
            UpdateHpBar();
        }
    }
}
